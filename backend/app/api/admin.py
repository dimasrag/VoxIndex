from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import get_db
from app.models.user import User
from app.models.synthesis import SynthesisJob
from app.services.auth import get_current_user

router = APIRouter()

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
