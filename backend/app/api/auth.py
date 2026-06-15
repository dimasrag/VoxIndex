from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.models import get_db
from typing import Optional
from app.models.user import User
from app.api.admin import clear_cached_stats
from app.services.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    create_password_reset_token,
    verify_password_reset_token,
)
from app.services.email import send_password_reset_email
import shutil
import uuid
import os

router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "../storage")
AVATARS_PATH = os.path.join(STORAGE_PATH, "avatars")
os.makedirs(AVATARS_PATH, exist_ok=True)

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    is_admin: bool


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    avatar_filename: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    clear_cached_stats("users_growth_")
    clear_cached_stats("overview")
    return {"id": user.id, "username": user.username, "email": user.email}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        frontend_url = os.getenv("FRONTEND_APP_URL", "http://localhost:5173").rstrip("/")
        reset_token = create_password_reset_token(user.email)
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        try:
            delivery_result = send_password_reset_email(user.email, reset_url)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Could not send reset email. Configure EMAIL_PROVIDER and, for SMTP, "
                    "SMTP_HOST, SMTP_PORT, SMTP_USERNAME, and SMTP_PASSWORD in backend/.env. "
                    f"Original error: {exc}"
                ),
            ) from exc

        response = {"message": "If the email exists, a password reset link has been sent."}
        if isinstance(delivery_result, dict) and delivery_result.get("reset_url"):
            response["reset_url"] = delivery_result["reset_url"]
            response["delivery_provider"] = delivery_result.get("provider", "local")
        return response

    return {"message": "If the email exists, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        email = verify_password_reset_token(req.token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")

    if verify_password(req.new_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password cannot be the same as the old password")

    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password reset successfully"}

@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_access_token({"sub": user.username, "is_admin": user.is_admin})
    return {"access_token": token, "token_type": "bearer", "is_admin": user.is_admin}


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
        "avatar_filename": current_user.avatar_filename,
    }

@router.patch("/me", response_model=UserResponse)
def update_current_user(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.username and req.username != current_user.username:
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = req.username

    if req.email and req.email != current_user.email:
        if db.query(User).filter(User.email == req.email).first():
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = req.email

    if req.password:
        if len(req.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        if verify_password(req.password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="New password cannot be the same as the old password")
        current_user.hashed_password = get_password_hash(req.password)

    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
        "avatar_filename": current_user.avatar_filename,
    }

@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are allowed")
    
    if current_user.avatar_filename:
        old_path = os.path.join(AVATARS_PATH, current_user.avatar_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = file.filename.rsplit(".", 1)[-1].lower()
    filename = f"{current_user.id}_{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(AVATARS_PATH, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_user.avatar_filename = filename
    db.commit()
    db.refresh(current_user)
    return {"avatar_filename": filename}

@router.delete("/me/avatar")
def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.avatar_filename:
        raise HTTPException(status_code=404, detail="No avatar to delete")
    
    file_path = os.path.join(AVATARS_PATH, current_user.avatar_filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    current_user.avatar_filename = None
    db.commit()
    return {"message": "Avatar removed"}