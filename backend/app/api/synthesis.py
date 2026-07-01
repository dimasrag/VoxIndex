import os
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.models import get_db
from app.models.synthesis import SynthesisJob
from app.models.voice_ref import VoiceReference
from app.models.user import User
from app.services.auth import get_current_user
from app.services.tts import TTSServiceError, synthesize, warmup as tts_warmup

logger = logging.getLogger(__name__)

router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "../storage")
OUTPUTS_PATH = os.path.join(STORAGE_PATH, "outputs")

def _normalize_text(text: str) -> str:
    cleaned = text.replace("/", " slash ").replace("\\", " slash ")
    return " ".join(cleaned.split())

class SynthesisRequest(BaseModel):
    voice_ref_id: int
    text: str
    language: Optional[str] = None
    emo_voice_ref_id: Optional[int] = None
    emo_vector: Optional[list] = None  # 8-float emotion vector [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]
    emo_alpha: float = 1.0  # emotion strength: 0.0 to 1.0
    use_emo_text: bool = False  # enable emotion from emo_text
    emo_text: Optional[str] = None  # text describing desired emotion
    use_random: bool = False  # randomize generation aspects
    max_text_tokens_per_segment: int = 160  # larger chunks reduce pauses between segments
    interval_silence: int = 200  # silence between segments (ms)

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_synthesis(
    req: SynthesisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(f"Synthesis request received: text='{req.text}' voice_ref_id={req.voice_ref_id}")
    logger.info(f"TTS_PROVIDER env={os.getenv('TTS_PROVIDER', 'NOT SET')}")
    
    cleaned_text = _normalize_text(req.text.strip())
    if not cleaned_text:
        raise HTTPException(status_code=422, detail="Text must not be empty")
    if len(cleaned_text) > 2000:
        raise HTTPException(status_code=422, detail="Text length must be 2000 characters or fewer")

    language = (req.language or "en").strip().lower() or "en"

    voice_ref = db.query(VoiceReference).filter(
        VoiceReference.id == req.voice_ref_id,
        VoiceReference.user_id == current_user.id,
    ).first()
    if not voice_ref:
        raise HTTPException(status_code=404, detail="Voice reference not found")

    emo_voice_ref = None
    if req.emo_voice_ref_id is not None:
        emo_voice_ref = db.query(VoiceReference).filter(
            VoiceReference.id == req.emo_voice_ref_id,
            VoiceReference.user_id == current_user.id,
        ).first()
        if not emo_voice_ref:
            raise HTTPException(status_code=404, detail="Emotion reference not found")

    output_filename = f"{current_user.id}_{uuid.uuid4().hex}_output.wav"
    output_path = os.path.join(OUTPUTS_PATH, output_filename)
    os.makedirs(OUTPUTS_PATH, exist_ok=True)

    job = SynthesisJob(
        user_id=current_user.id,
        voice_ref_id=voice_ref.id,
        input_text=cleaned_text,
        language=language,
        output_filename=output_filename,
        output_path=output_path,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    error_message = None
    try:
        logger.info(f"Calling synthesize with voice_ref={voice_ref.file_path}, emo_alpha={req.emo_alpha}, use_random={req.use_random}")
        synthesize(
            cleaned_text,
            voice_ref.file_path,
            output_path,
            language=language,
            emo_audio_prompt=emo_voice_ref.file_path if emo_voice_ref else None,
            emo_vector=req.emo_vector,
            emo_alpha=req.emo_alpha,
            use_emo_text=req.use_emo_text,
            emo_text=req.emo_text,
            use_random=req.use_random,
            max_text_tokens_per_segment=req.max_text_tokens_per_segment,
            interval_silence=req.interval_silence,
        )

        logger.info(f"Synthesis succeeded, status=completed")
        job.status = "completed"
    except TTSServiceError as exc:
        logger.error(f"TTSServiceError: {exc}")
        error_message = str(exc)
        job.status = "failed"
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        error_message = "Unexpected synthesis error"
        job.status = "failed"

    db.commit()
    db.refresh(job)

    return {
        "id": job.id,
        "status": job.status,
        "language": job.language,
        "output_filename": job.output_filename,
        "input_text": job.input_text,
        "created_at": job.created_at,
        "error_message": error_message,
    }


@router.post("/warmup")
def warmup_synthesis_engine():
    """Load the TTS engine and its model weights without synthesizing audio."""
    try:
        tts_warmup()
        provider = os.getenv("TTS_PROVIDER", "indextts2").strip().lower()
        if provider == "auto":
            provider_name = "IndexTTS2 + Confucius4-TTS"
        else:
            provider_name = "Confucius4-TTS" if provider == "confucius4" else "IndexTTS2"
        return {"status": "ok", "message": f"{provider_name} warmup completed"}
    except TTSServiceError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.get("/")
def list_synthesis_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    jobs = db.query(SynthesisJob).filter(SynthesisJob.user_id == current_user.id).order_by(SynthesisJob.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "status": j.status,
            "language": j.language,
            "output_filename": j.output_filename,
            "input_text": j.input_text,
            "voice_ref_id": j.voice_ref_id,
            "created_at": j.created_at,
        }
        for j in jobs
    ]

@router.get("/{job_id}/audio")
def get_audio(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(SynthesisJob).filter(SynthesisJob.id == job_id, SynthesisJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Synthesis job not found")
    if job.status != "completed" or not job.output_path or not os.path.exists(job.output_path):
        raise HTTPException(status_code=404, detail="Audio not available")
    return FileResponse(job.output_path, media_type="audio/wav", filename=job.output_filename)
