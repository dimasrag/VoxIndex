import os
import uuid
import subprocess
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.models import get_db
from app.models.voice_ref import VoiceReference
from app.models.user import User
from app.services.auth import get_current_user
import aiofiles

router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "../storage")
VOICE_REFS_PATH = os.path.join(STORAGE_PATH, "voice_refs")


def _convert_uploaded_audio_to_wav(input_path: str, output_path: str) -> None:
    """Normalize uploaded voice references to mono WAV for runtime compatibility."""
    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input_path,
        "-ac",
        "1",
        "-ar",
        "16000",
        output_path,
    ]
    try:
        subprocess.run(command, check=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="ffmpeg is required to convert uploaded audio to WAV.") from exc
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=400, detail="Uploaded audio could not be converted to WAV.") from exc

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_voice_ref(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    os.makedirs(VOICE_REFS_PATH, exist_ok=True)
    unique_filename = f"{current_user.id}_{uuid.uuid4().hex}.wav"
    file_path = os.path.join(VOICE_REFS_PATH, unique_filename)

    temp_suffix = os.path.splitext(file.filename or "")[1] or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=temp_suffix, dir=VOICE_REFS_PATH) as temp_input:
        temp_input_path = temp_input.name

    try:
        async with aiofiles.open(temp_input_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        _convert_uploaded_audio_to_wav(temp_input_path, file_path)
    finally:
        if os.path.exists(temp_input_path):
            os.remove(temp_input_path)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Voice reference upload failed.")

    voice_ref = VoiceReference(
        user_id=current_user.id,
        filename=unique_filename,
        original_name=file.filename,
        file_path=file_path,
    )
    db.add(voice_ref)
    db.commit()
    db.refresh(voice_ref)
    return {"id": voice_ref.id, "filename": voice_ref.filename, "original_name": voice_ref.original_name, "created_at": voice_ref.created_at}

@router.get("/")
def list_voice_refs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    refs = db.query(VoiceReference).filter(VoiceReference.user_id == current_user.id).all()
    return [{"id": r.id, "filename": r.filename, "original_name": r.original_name, "created_at": r.created_at} for r in refs]

@router.delete("/{voice_ref_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voice_ref(
    voice_ref_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ref = db.query(VoiceReference).filter(VoiceReference.id == voice_ref_id, VoiceReference.user_id == current_user.id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Voice reference not found")
    if os.path.exists(ref.file_path):
        os.remove(ref.file_path)
    db.delete(ref)
    db.commit()
