import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.models import get_db
from app.models.synthesis import SynthesisJob
from app.models.voice_ref import VoiceReference
from app.models.user import User
from app.services.auth import get_current_user
from app.services.tts import TTSServiceError, synthesize

router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "../storage")
OUTPUTS_PATH = os.path.join(STORAGE_PATH, "outputs")

class SynthesisRequest(BaseModel):
    voice_ref_id: int
    text: str

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_synthesis(
    req: SynthesisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cleaned_text = req.text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=422, detail="Text must not be empty")
    if len(cleaned_text) > 2000:
        raise HTTPException(status_code=422, detail="Text length must be 2000 characters or fewer")

    voice_ref = db.query(VoiceReference).filter(
        VoiceReference.id == req.voice_ref_id,
        VoiceReference.user_id == current_user.id,
    ).first()
    if not voice_ref:
        raise HTTPException(status_code=404, detail="Voice reference not found")

    output_filename = f"{current_user.id}_{uuid.uuid4().hex}_output.wav"
    output_path = os.path.join(OUTPUTS_PATH, output_filename)
    os.makedirs(OUTPUTS_PATH, exist_ok=True)

    job = SynthesisJob(
        user_id=current_user.id,
        voice_ref_id=voice_ref.id,
        input_text=cleaned_text,
        output_filename=output_filename,
        output_path=output_path,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    error_message = None
    try:
        synthesize(cleaned_text, voice_ref.file_path, output_path)
        job.status = "completed"
    except TTSServiceError as exc:
        error_message = str(exc)
        job.status = "failed"
    except Exception:
        error_message = "Unexpected synthesis error"
        job.status = "failed"

    db.commit()
    db.refresh(job)

    return {
        "id": job.id,
        "status": job.status,
        "output_filename": job.output_filename,
        "input_text": job.input_text,
        "created_at": job.created_at,
        "error_message": error_message,
    }

@router.get("/")
def list_synthesis_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    jobs = db.query(SynthesisJob).filter(SynthesisJob.user_id == current_user.id).order_by(SynthesisJob.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "status": j.status,
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
