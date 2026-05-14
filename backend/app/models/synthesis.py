from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from app.models import Base

class SynthesisJob(Base):
    __tablename__ = "synthesis_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    voice_ref_id = Column(Integer, ForeignKey("voice_references.id"), nullable=False)
    input_text = Column(Text, nullable=False)
    output_filename = Column(String, nullable=True)
    output_path = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending/completed/failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
