# backend/api/deps.py

from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme)
) -> str:
    username = credentials.credentials

    if not username:
        raise HTTPException(status_code=401, detail="Please log in first.")

    return username