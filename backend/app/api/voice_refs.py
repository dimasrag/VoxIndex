import os
import uuid
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

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_voice_ref(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unique_filename = f"{current_user.id}_{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(VOICE_REFS_PATH, unique_filename)
    os.makedirs(VOICE_REFS_PATH, exist_ok=True)
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
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
