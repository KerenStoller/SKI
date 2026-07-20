from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.database import get_db
from backend.database import models

security_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> models.User:
    username = credentials.credentials
    if not username:
        raise HTTPException(status_code=401, detail="Please log in first.")

    result = await db.execute(select(models.User).where(models.User.username == username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return user


async def get_current_admin(
    user: models.User = Depends(get_current_user),
) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


async def get_current_teacher(
    user: models.User = Depends(get_current_user),
) -> models.User:
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required.")
    return user
