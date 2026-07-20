import os
import uuid
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.sql import func
from supabase import create_client, Client

from backend.grading.grader import grade_exam
from backend.ocr.extractor import ocr_single_pdf
from backend.api.deps import get_current_teacher, get_current_user
from backend.database.database import get_db
from backend.database import models

router = APIRouter(tags=["Projects"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_KEY or SUPABASE_URL in .env")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Space ─────────────────────────────────────────────────────────────────────

@router.get("/spaces/me")
async def get_my_space(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_teacher),
):
    result = await db.execute(
        select(models.Space).where(models.Space.teacher_username == current_user.username)
    )
    space = result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found.")
    return {
        "id": space.id,
        "name": space.name,
        "teacher_username": space.teacher_username,
    }


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/spaces/{space_id}/projects")
async def list_projects(
    space_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_teacher),
):
    space_result = await db.execute(
        select(models.Space).where(
            models.Space.id == space_id,
            models.Space.teacher_username == current_user.username,
        )
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied.")

    result = await db.execute(
        select(models.Project)
        .where(models.Project.space_id == space_id)
        .order_by(models.Project.created_at.desc())
    )
    projects = result.scalars().all()

    project_list = []
    for p in projects:
        count_result = await db.execute(
            select(func.count(models.GradingRun.id)).where(models.GradingRun.project_id == p.id)
        )
        run_count = count_result.scalar_one()
        project_list.append({
            "id": p.id,
            "name": p.name,
            "rubric": p.rubric,
            "empty_exam_path": p.empty_exam_path,
            "run_count": run_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return project_list


@router.post("/spaces/{space_id}/projects", status_code=201)
async def create_project(
    space_id: int,
    name: str = Form(...),
    rubric: str = Form(...),
    empty_exam: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_teacher),
):
    space_result = await db.execute(
        select(models.Space).where(
            models.Space.id == space_id,
            models.Space.teacher_username == current_user.username,
        )
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied.")

    if empty_exam.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="empty_exam must be a PDF")
    if not rubric.strip():
        raise HTTPException(status_code=400, detail="rubric must not be empty")
    if not name.strip():
        raise HTTPException(status_code=400, detail="name must not be empty")

    empty_bytes = await empty_exam.read()

    folder_id = str(uuid.uuid4())
    storage_path = f"{current_user.username}/projects/{space_id}/{folder_id}/empty_exam.pdf"
    try:
        supabase.storage.from_("workspace-files").upload(
            file=empty_bytes,
            path=storage_path,
            file_options={"content-type": "application/pdf"},
        )
        public_url = supabase.storage.from_("workspace-files").get_public_url(storage_path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {e}")

    try:
        questions_markdown = ocr_single_pdf(empty_bytes, "empty_exam")
    except Exception as e:
        supabase.storage.from_("workspace-files").remove([storage_path])
        raise HTTPException(status_code=502, detail=f"OCR failed: {e}")

    project = models.Project(
        space_id=space_id,
        name=name.strip(),
        rubric=rubric,
        empty_exam_path=public_url,
        questions_markdown=questions_markdown,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return {
        "id": project.id,
        "name": project.name,
        "rubric": project.rubric,
        "empty_exam_path": project.empty_exam_path,
        "run_count": 0,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


# ── Project detail ────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project_result = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    if current_user.role == "teacher":
        space_result = await db.execute(
            select(models.Space).where(
                models.Space.id == project.space_id,
                models.Space.teacher_username == current_user.username,
            )
        )
        if not space_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied.")

    runs_result = await db.execute(
        select(models.GradingRun)
        .where(models.GradingRun.project_id == project_id)
        .order_by(models.GradingRun.created_at.desc())
    )
    runs = runs_result.scalars().all()

    return {
        "id": project.id,
        "name": project.name,
        "rubric": project.rubric,
        "empty_exam_path": project.empty_exam_path,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "runs": [
            {
                **r.payload,
                "id": r.id,
                "student_number": r.student_number,
                "file_path": r.file_path,
                "final_score": r.final_score,
                "max_score": r.max_score,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in runs
        ],
    }


# ── Update Project ────────────────────────────────────────────────────────────

@router.patch("/projects/{project_id}")
async def update_project(
    project_id: int,
    name: str | None = Form(default=None),
    rubric: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_teacher),
):
    project_result = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    space_result = await db.execute(
        select(models.Space).where(
            models.Space.id == project.space_id,
            models.Space.teacher_username == current_user.username,
        )
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied.")

    if name is not None:
        if not name.strip():
            raise HTTPException(status_code=400, detail="name must not be empty")
        project.name = name.strip()
    if rubric is not None:
        if not rubric.strip():
            raise HTTPException(status_code=400, detail="rubric must not be empty")
        project.rubric = rubric

    await db.commit()
    await db.refresh(project)

    return {
        "id": project.id,
        "name": project.name,
        "rubric": project.rubric,
        "empty_exam_path": project.empty_exam_path,
    }


# ── Grading ───────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/grade")
async def grade_student(
    project_id: int,
    student_number: str = Form(...),
    solved_exam: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_teacher),
):
    project_result = await db.execute(
        select(models.Project).where(models.Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    space_result = await db.execute(
        select(models.Space).where(
            models.Space.id == project.space_id,
            models.Space.teacher_username == current_user.username,
        )
    )
    if not space_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied.")

    if solved_exam.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="solved_exam must be a PDF")
    if not student_number.strip():
        raise HTTPException(status_code=400, detail="student_number must not be empty")

    solved_bytes = await solved_exam.read()

    run_id = str(uuid.uuid4())
    storage_path = f"{current_user.username}/projects/{project_id}/{run_id}_solved.pdf"
    try:
        supabase.storage.from_("workspace-files").upload(
            file=solved_bytes,
            path=storage_path,
            file_options={"content-type": "application/pdf"},
        )
        public_url = supabase.storage.from_("workspace-files").get_public_url(storage_path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {e}")

    try:
        answers_markdown = ocr_single_pdf(solved_bytes, "solved_exam")
    except Exception as e:
        supabase.storage.from_("workspace-files").remove([storage_path])
        raise HTTPException(status_code=502, detail=f"OCR failed: {e}")

    try:
        grading = grade_exam(project.rubric, project.questions_markdown, answers_markdown)
    except Exception as e:
        supabase.storage.from_("workspace-files").remove([storage_path])
        raise HTTPException(status_code=502, detail=f"Grading failed: {e}")

    payload = {
        **grading,
        "ocr_transcripts": {
            "questions_markdown": project.questions_markdown,
            "answers_markdown": answers_markdown,
        },
    }

    run = models.GradingRun(
        project_id=project_id,
        student_number=student_number.strip(),
        file_path=public_url,
        final_score=float(grading.get("final_score", 0.0)),
        max_score=float(grading.get("max_score", 100.0)),
        payload=payload,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    return {
        **payload,
        "id": run.id,
        "student_number": run.student_number,
        "file_path": run.file_path,
        "final_score": run.final_score,
        "max_score": run.max_score,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }
