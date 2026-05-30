# database.py
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


# Load the secrets from the .env file
load_dotenv(".env")

# Pull the string securely from the environment
DATABASE_URL = os.getenv("DATABASE_URL")

# If the URL is missing, crash the app so you know the .env file isn't set up right
if not DATABASE_URL:
    raise ValueError("No DATABASE_URL found in .env file")
engine = create_async_engine(DATABASE_URL)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()