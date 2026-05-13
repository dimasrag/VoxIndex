import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import get_db
from app.models.user import User
from app.models.voice_ref import VoiceReference
from app.models.synthesis import SynthesisJob
from app.services.auth import get_current_user

router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "../storage")
OUTPUTS_PATH = os.path.join(STORAGE_PATH, "outputs")
VOICE_REFS_PATH = os.path.join(STORAGE_PATH, "voice_refs")

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    result = []
    for user in users:
        count = db.query(func.count(SynthesisJob.id)).filter(SynthesisJob.user_id == user.id).scalar()
        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "created_at": user.created_at,
            "synthesis_count": count,
        })
    return result

@router.get("/activity")
def list_activity(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    jobs = db.query(SynthesisJob).order_by(SynthesisJob.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "user_id": j.user_id,
            "voice_ref_id": j.voice_ref_id,
            "input_text": j.input_text,
            "status": j.status,
            "output_filename": j.output_filename,
            "created_at": j.created_at,
        }
        for j in jobs
    ]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if admin.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own admin account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    jobs = db.query(SynthesisJob).filter(SynthesisJob.user_id == user_id).all()
    for job in jobs:
        if job.output_path and os.path.exists(job.output_path):
            os.remove(job.output_path)
        db.delete(job)

    voice_refs = db.query(VoiceReference).filter(VoiceReference.user_id == user_id).all()
    for voice_ref in voice_refs:
        if voice_ref.file_path and os.path.exists(voice_ref.file_path):
            os.remove(voice_ref.file_path)
        else:
            fallback_path = os.path.join(VOICE_REFS_PATH, voice_ref.filename)
            if os.path.exists(fallback_path):
                os.remove(fallback_path)
        db.delete(voice_ref)

    db.delete(user)
    db.commit()

    return None
