from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from backend.api.gpt.gpt_grader import grade_answer

router = APIRouter()

class GradeRequest(BaseModel):
    rubric: str
    student_answer: str

class GradeResponse(BaseModel):
    score: float
    max_score: float
    rationale: str
    error: str = None

@router.post("/grade", response_model=GradeResponse)
def grade_endpoint(request: GradeRequest):
    result = grade_answer(request.rubric, request.student_answer)
    if 'error' in result:
        raise HTTPException(status_code=500, detail=result['error'])
    return result
