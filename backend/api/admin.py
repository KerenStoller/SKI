# backend/api/admin.py

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.database.database import get_db
from backend.database.models import User

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/user-count")
async def get_user_count(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(User.username)))
    count = result.scalar_one()

    return {"total_users": count}