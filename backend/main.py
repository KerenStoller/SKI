from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

import os

from backend.api import auth, admin, projects
from backend.database import models
from backend.database.database import engine, AsyncSessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Add role column to existing users table if this is an upgrade from a prior version
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'teacher'")
        )
        # Create new tables (spaces, projects, grading_runs) — safe to run repeatedly
        await conn.run_sync(models.Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Ensure admin user exists with correct credentials
        result = await session.execute(select(models.User).where(models.User.username == "admin"))
        admin_user = result.scalar_one_or_none()
        admin_password = os.getenv("ADMIN_PASSWORD", "admin")
        if not admin_user:
            session.add(models.User(username="admin", password=admin_password, role="admin"))
        else:
            admin_user.role = "admin"
            admin_user.password = admin_password
        await session.commit()

    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(projects.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
