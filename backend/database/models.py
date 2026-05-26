# models.py
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String, Column,ForeignKey,Float # (plus whatever else is already there)
from sqlalchemy.dialects.postgresql import JSONB

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    password: Mapped[str] = mapped_column(String, nullable=False)    
    
class GradingJob(Base):
    __tablename__ = "grading_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, ForeignKey("users.username"), index=True)
    exam_name: Mapped[str] = mapped_column(String, nullable=False)
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Store the entire complex JSON tree (rationale, deductions, transcripts) right here!
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)