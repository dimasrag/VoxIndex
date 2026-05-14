import os
from typing import Optional
from datetime import datetime, timedelta
import time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, func, or_
from app.models import get_db
from app.models.user import User
from app.models.voice_ref import VoiceReference
from app.models.synthesis import SynthesisJob
from app.services.auth import get_current_user

router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "../storage")
OUTPUTS_PATH = os.path.join(STORAGE_PATH, "outputs")
VOICE_REFS_PATH = os.path.join(STORAGE_PATH, "voice_refs")

# Simple in-memory cache for stats (5 min TTL)
_stats_cache = {}
_cache_ttl = 300  # 5 minutes

def get_cached_stats(key: str):
    if key in _stats_cache:
        value, timestamp = _stats_cache[key]
        if time.time() - timestamp < _cache_ttl:
            return value
    return None

def set_cached_stats(key: str, value):
    _stats_cache[key] = (value, time.time())

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

@router.get("/users")
def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    sort: str = Query("newest"),
    search: Optional[str] = Query(None),
    is_admin: Optional[bool] = Query(None),
):
    synthesis_counts = (
        db.query(
            SynthesisJob.user_id.label("user_id"),
            func.count(SynthesisJob.id).label("synthesis_count"),
        )
        .group_by(SynthesisJob.user_id)
        .subquery()
    )

    query = (
        db.query(User, func.coalesce(synthesis_counts.c.synthesis_count, 0).label("synthesis_count"))
        .outerjoin(synthesis_counts, synthesis_counts.c.user_id == User.id)
    )

    if search:
        pattern = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(User.username).like(pattern),
                func.lower(User.email).like(pattern),
            )
        )

    if is_admin is not None:
        query = query.filter(User.is_admin == is_admin)

    sort_map = {
        "newest": desc(User.created_at),
        "oldest": asc(User.created_at),
        "username_asc": asc(User.username),
        "username_desc": desc(User.username),
        "email_asc": asc(User.email),
        "email_desc": desc(User.email),
        "admin_first": desc(User.is_admin),
        "user_first": asc(User.is_admin),
    }
    query = query.order_by(sort_map.get(sort, desc(User.created_at)), desc(User.id))

    total = query.count()
    users = query.offset((page - 1) * limit).limit(limit).all()

    items = []
    for user, synthesis_count in users:
        items.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "created_at": user.created_at,
            "synthesis_count": synthesis_count,
        })

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": (total + limit - 1) // limit if total else 0,
    }

@router.get("/activity")
def list_activity(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    days: int = Query(30, ge=1),
    status: str = Query("all"),
):
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(SynthesisJob).filter(SynthesisJob.created_at >= cutoff_date)
    
    if status != "all":
        query = query.filter(SynthesisJob.status == status)
    
    query = query.order_by(desc(SynthesisJob.created_at))
    
    total = query.count()
    jobs = query.offset((page - 1) * limit).limit(limit).all()
    
    items = []
    for job in jobs:
        items.append({
            "id": job.id,
            "user_id": job.user_id,
            "voice_ref_id": job.voice_ref_id,
            "status": job.status,
            "created_at": job.created_at,
            "duration": job.duration_seconds,
        })
    
    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": (total + limit - 1) // limit if total else 0,
    }


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
    db.flush()

    voice_refs = db.query(VoiceReference).filter(VoiceReference.user_id == user_id).all()
    for voice_ref in voice_refs:
        if voice_ref.file_path and os.path.exists(voice_ref.file_path):
            os.remove(voice_ref.file_path)
        else:
            fallback_path = os.path.join(VOICE_REFS_PATH, voice_ref.filename)
            if os.path.exists(fallback_path):
                os.remove(fallback_path)
        db.delete(voice_ref)
    db.flush()

    db.delete(user)
    db.commit()

    return None

@router.get("/stats/overview")
def get_stats_overview(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    cached = get_cached_stats("overview")
    if cached:
        return cached
    
    now = datetime.utcnow()
    month_ago = now - timedelta(days=30)
    month_before = month_ago - timedelta(days=30)
    
    # Active users (users who have synthesis jobs in the last 30 days)
    active_users = db.query(func.count(func.distinct(SynthesisJob.user_id))).filter(
        SynthesisJob.created_at >= month_ago
    ).scalar() or 0
    
    # Active users in previous month
    prev_active_users = db.query(func.count(func.distinct(SynthesisJob.user_id))).filter(
        SynthesisJob.created_at >= month_before,
        SynthesisJob.created_at < month_ago
    ).scalar() or 0
    
    active_users_change_percent = 0
    if prev_active_users > 0:
        active_users_change_percent = round(((active_users - prev_active_users) / prev_active_users) * 100, 1)
    
    # Total syntheses this month
    total_syntheses_month = db.query(func.count(SynthesisJob.id)).filter(
        SynthesisJob.created_at >= month_ago
    ).scalar() or 0
    
    # Average duration
    avg_duration = db.query(func.avg(SynthesisJob.duration_seconds)).filter(
        SynthesisJob.duration_seconds.isnot(None),
        SynthesisJob.created_at >= month_ago
    ).scalar() or 0
    avg_duration_seconds = round(avg_duration) if avg_duration else 0
    
    # Error rate
    failed_count = db.query(func.count(SynthesisJob.id)).filter(
        SynthesisJob.status == "failed",
        SynthesisJob.created_at >= month_ago
    ).scalar() or 0
    error_rate_percent = 0
    if total_syntheses_month > 0:
        error_rate_percent = round((failed_count / total_syntheses_month) * 100, 1)
    
    result = {
        "active_users": active_users,
        "active_users_change_percent": active_users_change_percent,
        "total_syntheses_month": total_syntheses_month,
        "avg_duration_seconds": avg_duration_seconds,
        "error_rate_percent": error_rate_percent,
    }
    
    set_cached_stats("overview", result)
    return result


@router.get("/stats/users/growth")
def get_users_growth(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    period: str = Query("monthly"),
):
    cache_key = f"users_growth_{period}"
    cached = get_cached_stats(cache_key)
    if cached:
        return cached
    
    now = datetime.utcnow()
    
    if period == "daily":
        # Last 7 days
        points = []
        for offset in range(6, -1, -1):
            date = (now - timedelta(days=offset)).date()
            date_start = datetime.combine(date, datetime.min.time())
            date_end = datetime.combine(date, datetime.max.time())
            
            total_users = db.query(func.count(func.distinct(User.id))).filter(
                User.created_at <= date_end
            ).scalar() or 0
            
            new_users = db.query(func.count(User.id)).filter(
                User.created_at >= date_start,
                User.created_at <= date_end
            ).scalar() or 0
            
            points.append({
                "date": date.isoformat(),
                "user_count": total_users,
                "new_users": new_users,
            })
    elif period == "weekly":
        # Last 12 weeks
        points = []
        for offset in range(11, -1, -1):
            week_start = now - timedelta(weeks=offset+1)
            week_end = now - timedelta(weeks=offset)
            
            total_users = db.query(func.count(func.distinct(User.id))).filter(
                User.created_at <= week_end
            ).scalar() or 0
            
            new_users = db.query(func.count(User.id)).filter(
                User.created_at >= week_start,
                User.created_at < week_end
            ).scalar() or 0
            
            points.append({
                "date": week_start.date().isoformat(),
                "user_count": total_users,
                "new_users": new_users,
            })
    else:  # monthly
        # Last 12 months
        points = []
        for offset in range(11, -1, -1):
            month_start = now - timedelta(days=30*(offset+1))
            month_end = now - timedelta(days=30*offset)
            
            total_users = db.query(func.count(func.distinct(User.id))).filter(
                User.created_at <= month_end
            ).scalar() or 0
            
            new_users = db.query(func.count(User.id)).filter(
                User.created_at >= month_start,
                User.created_at < month_end
            ).scalar() or 0
            
            points.append({
                "date": month_start.date().isoformat(),
                "user_count": total_users,
                "new_users": new_users,
            })
    
    set_cached_stats(cache_key, points)
    return points
