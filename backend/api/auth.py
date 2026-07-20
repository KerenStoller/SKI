from fastapi import APIRouter, Depends, HTTPException
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
    role: str


@router.post("/signin", response_model=TokenResponse)
async def sign_in(
    payload: SignInRequest,
    db: AsyncSession = Depends(get_db),
):
    username = payload.username.strip().lower()

    result = await db.execute(select(models.User).where(models.User.username == username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="משתמש לא קיים במערכת. יש לפנות למנהל המערכת.",
        )

    if user.password != payload.password:
        raise HTTPException(status_code=401, detail="סיסמה שגויה")

    return {
        "access_token": user.username,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
    }
