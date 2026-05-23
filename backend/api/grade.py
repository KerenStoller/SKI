from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.grading.grader import grade_exam
from backend.ocr.extractor import extract_exam_transcripts

router = APIRouter()


class Deduction(BaseModel):
    question_number: int
    reason: str
    points: float


class OcrTranscripts(BaseModel):
    questions_markdown: str
    answers_markdown: str


class GradeExamResponse(BaseModel):
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
):
    if empty_exam.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="empty_exam must be a PDF")
    if solved_exam.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="solved_exam must be a PDF")
    if not rubric.strip():
        raise HTTPException(status_code=400, detail="rubric must not be empty")

    empty_bytes = await empty_exam.read()
    solved_bytes = await solved_exam.read()

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

    return {**grading, "ocr_transcripts": transcripts}
