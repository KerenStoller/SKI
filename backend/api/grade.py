# backend/api/grade.py
from typing import List
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.grading.grader import grade_exam
from backend.ocr.extractor import extract_exam_transcripts
from backend.api.deps import get_current_user  # Your local token identity fetcher
from backend.database.database import get_db
from backend.database import models
from sqlalchemy import select

router = APIRouter()

# --- Existing Response Validation Schemas ---
class Deduction(BaseModel):
    question_number: int
    reason: str
    points: float

class OcrTranscripts(BaseModel):
    questions_markdown: str
    answers_markdown: str

class GradeExamResponse(BaseModel):
    id: int  # Added the DB generated ID to the response contract
    final_score: float
    max_score: float
    rationale: str
    deductions: List[Deduction]
    ocr_transcripts: OcrTranscripts


@router.post("/grade", response_model=GradeExamResponse)
async def grade_exam_endpoint(
    empty_exam: UploadFile = File(...),
    solved_exam: UploadFile = File(...),
    rubric: str = Form(...),
    exam_name: str = Form("Untitled Exam"), # Added name capture for the cloud folder asset
    db: AsyncSession = Depends(get_db),      # PostgreSQL Connection Session
    current_user: str = Depends(get_current_user) # Auto-identifies user via header token
):
    # 1. Validation Checks
    if empty_exam.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="empty_exam must be a PDF")
    if solved_exam.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="solved_exam must be a PDF")
    if not rubric.strip():
        raise HTTPException(status_code=400, detail="rubric must not be empty")

    empty_bytes = await empty_exam.read()
    solved_bytes = await solved_exam.read()

    # 2. Trigger Document AI Pipelines
    try:
        transcripts = extract_exam_transcripts(empty_bytes, solved_bytes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR failed: {e}")

    try:
        grading = grade_exam(
            rubric,
            transcripts["questions_markdown"],
            transcripts["answers_markdown"],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Grading failed: {e}")

    # Build the full response tree
    full_result = {**grading, "ocr_transcripts": transcripts}

    # 3. Persistent Database Archive
    # Create the hardcoded row object to save this job under the correct user
    db_job = models.GradingJob(
        username=current_user,
        exam_name=exam_name,
        final_score=float(full_result.get("final_score", 0.0)),
        max_score=float(full_result.get("max_score", 100.0)),
        payload=full_result # Dumps deductions, rationale, and transcripts into JSONB
    )
    
    db.add(db_job)
    await db.commit()      # Flush data out to local Postgres engine
    await db.refresh(db_job) # Populate our db_job instance with the new serial PK 'id'

    # Return everything back to the UI, appending the database record id
    return {
        "id": db_job.id,
        **full_result
    }
    
@router.get("/items", response_model=List[dict])
async def get_user_cloud_items(
    db: AsyncSession = Depends(get_db), 
    current_user: str = Depends(get_current_user)
):
    """Retrieves every historic exam matching the user logged into the browser."""
    stmt = select(models.GradingJob).where(models.GradingJob.username == current_user).order_by(models.GradingJob.id.desc())
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    
    # Flatten the DB format back to direct UI schemas
    return [
        {
            "id": job.id,
            "exam_name": job.exam_name,
            "final_score": job.final_score,
            "max_score": job.max_score,
            **job.payload
        }
        for job in jobs
    ]