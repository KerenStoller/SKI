"""# auth_utils.py
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_scheme = HTTPBearer(auto_error=True)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> str:
    
    #Super simple token checker for local dev.
    #It takes whatever string the frontend sent and treats it directly as the username!
    username = credentials.credentials
    
    if not username:
        raise HTTPException(status_code=401, detail="Please log in first.")
        
    # Return it directly. The user is instantly "logged in".
    return username
"""