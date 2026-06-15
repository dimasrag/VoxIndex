import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models import get_db
from app.models.synthesis import SynthesisJob
from app.models.user import User

router = APIRouter()


@router.get("/history")
def get_sample_history(db: Session = Depends(get_db)):
	sample_username = os.getenv("SAMPLE_USERNAME", "sample").strip()
	user = None

	if sample_username:
		user = db.query(User).filter(User.username == sample_username).first()

	if not user:
		user = (
			db.query(User)
			.join(SynthesisJob, SynthesisJob.user_id == User.id)
			.group_by(User.id)
			.order_by(desc(func.max(SynthesisJob.created_at)))
			.first()
		)

	if not user:
		user = db.query(User).order_by(User.created_at.desc()).first()

	if not user:
		raise HTTPException(status_code=404, detail="No users available for sample history")

	jobs = (
		db.query(SynthesisJob)
		.filter(SynthesisJob.user_id == user.id)
		.order_by(SynthesisJob.created_at.desc())
		.all()
	)

	return {
		"user": {
			"id": user.id,
			"username": user.username,
			"email": user.email,
			"avatar_filename": user.avatar_filename,
			"total_jobs": len(jobs),
			"completed_jobs": sum(1 for job in jobs if job.status == "completed"),
			"last_active": jobs[0].created_at if jobs else None,
		},
		"jobs": [
			{
				"id": job.id,
				"input_text": job.input_text,
				"status": job.status,
				"created_at": job.created_at,
				"output_filename": job.output_filename,
				"duration_seconds": job.duration_seconds,
			}
			for job in jobs
		],
	}
