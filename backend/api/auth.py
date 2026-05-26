# backend/api/auth.py

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import models
from backend.database.database import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])


class SignInRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    is_new_user: bool


@router.post("/signin", response_model=TokenResponse)
async def sign_in_or_register(
    payload: SignInRequest,
    db: AsyncSession = Depends(get_db)
):
    username = payload.username.strip().lower()
    password = payload.password

    stmt = select(models.User).where(models.User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    is_new_user = False

    if not user:
        user = models.User(username=username, password=password)
        db.add(user)
        is_new_user = True
    else:
        user.password = password

    await db.commit()

    return {
        "access_token": user.username,
        "token_type": "bearer",
        "username": user.username,
        "is_new_user": is_new_user
    }