from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from ..auth import create_access_token, get_current_user, get_user, pwd_context, require_admin
from ..config import ACCESS_TOKEN_EXPIRE_MINUTES
from ..users_db import update_user_password

router = APIRouter(tags=["Auth"])


class ChangePasswordRequest(BaseModel):
    username: str
    new_password: str


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not pwd_context.verify(form_data.password, user["hashed_password"]):
        print(f"login FAIL: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    print(f"login OK: {user['username']} ({user.get('role', 'user')})")
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user["username"],
        "role": user.get("role", "user"),
        "rooms": user.get("rooms", []),
    }


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    admin: dict = Depends(require_admin),
):
    if not get_user(body.username):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    new_hash = pwd_context.hash(body.new_password)
    update_user_password(body.username, new_hash)
    return {"detail": f"Password updated for '{body.username}'."}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user.get("username"),
        "role": current_user.get("role", "user"),
        "rooms": current_user.get("rooms", []),
    }
