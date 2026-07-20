from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.sql import func

from backend.database.database import get_db
from backend.database import models
from backend.api.deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


class CreateTeacherRequest(BaseModel):
    username: str
    password: str


@router.post("/teachers", status_code=201)
async def create_teacher(
    payload: CreateTeacherRequest,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    username = payload.username.strip().lower()

    existing = await db.execute(select(models.User).where(models.User.username == username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="שם משתמש כבר קיים.")

    teacher = models.User(username=username, password=payload.password, role="teacher")
    db.add(teacher)
    await db.flush()

    space = models.Space(teacher_username=username, name=f"הסביבה של {username}")
    db.add(space)
    await db.commit()

    return {"username": username, "role": "teacher"}


@router.get("/teachers")
async def list_teachers(
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    result = await db.execute(select(models.User).where(models.User.role == "teacher"))
    teachers = result.scalars().all()

    teacher_list = []
    for t in teachers:
        space_result = await db.execute(
            select(models.Space).where(models.Space.teacher_username == t.username)
        )
        space = space_result.scalar_one_or_none()

        project_count = 0
        if space:
            count_result = await db.execute(
                select(func.count(models.Project.id)).where(models.Project.space_id == space.id)
            )
            project_count = count_result.scalar_one()

        teacher_list.append({
            "username": t.username,
            "space_id": space.id if space else None,
            "space_name": space.name if space else None,
            "project_count": project_count,
        })

    return teacher_list


@router.get("/spaces/{space_id}/projects")
async def admin_get_space_projects(
    space_id: int,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    space_result = await db.execute(select(models.Space).where(models.Space.id == space_id))
    space = space_result.scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=404, detail="Space not found.")

    result = await db.execute(
        select(models.Project)
        .where(models.Project.space_id == space_id)
        .order_by(models.Project.created_at.desc())
    )
    projects = result.scalars().all()

    project_list = []
    for p in projects:
        run_count_result = await db.execute(
            select(func.count(models.GradingRun.id)).where(models.GradingRun.project_id == p.id)
        )
        run_count = run_count_result.scalar_one()
        project_list.append({
            "id": p.id,
            "name": p.name,
            "rubric": p.rubric,
            "empty_exam_path": p.empty_exam_path,
            "run_count": run_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return project_list


@router.get("/all-projects")
async def get_all_projects(
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    teachers_result = await db.execute(select(models.User).where(models.User.role == "teacher"))
    teachers = teachers_result.scalars().all()

    result = []
    for t in teachers:
        space_result = await db.execute(
            select(models.Space).where(models.Space.teacher_username == t.username)
        )
        space = space_result.scalar_one_or_none()
        if not space:
            continue

        projects_result = await db.execute(
            select(models.Project)
            .where(models.Project.space_id == space.id)
            .order_by(models.Project.created_at.desc())
        )
        teacher_projects = projects_result.scalars().all()

        project_list = []
        for p in teacher_projects:
            run_count_result = await db.execute(
                select(func.count(models.GradingRun.id)).where(models.GradingRun.project_id == p.id)
            )
            run_count = run_count_result.scalar_one()
            project_list.append({
                "id": p.id,
                "name": p.name,
                "rubric": p.rubric,
                "run_count": run_count,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

        result.append({
            "teacher_username": t.username,
            "space_id": space.id,
            "space_name": space.name,
            "projects": project_list,
        })

    return result


@router.delete("/teachers/{username}", status_code=204)
async def delete_teacher(
    username: str,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    user_result = await db.execute(select(models.User).where(models.User.username == username))
    user = user_result.scalar_one_or_none()
    if not user or user.role == "admin":
        raise HTTPException(status_code=404, detail="Teacher not found.")

    space_result = await db.execute(select(models.Space).where(models.Space.teacher_username == username))
    space = space_result.scalar_one_or_none()

    if space:
        project_result = await db.execute(
            select(models.Project.id).where(models.Project.space_id == space.id)
        )
        project_ids = [row[0] for row in project_result.all()]
        if project_ids:
            await db.execute(delete(models.GradingRun).where(models.GradingRun.project_id.in_(project_ids)))
            await db.execute(delete(models.Project).where(models.Project.id.in_(project_ids)))
        await db.execute(delete(models.Space).where(models.Space.id == space.id))

    await db.execute(delete(models.User).where(models.User.username == username))
    await db.commit()


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    project_result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    await db.execute(delete(models.GradingRun).where(models.GradingRun.project_id == project_id))
    await db.execute(delete(models.Project).where(models.Project.id == project_id))
    await db.commit()


