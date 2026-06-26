from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..auth import create_access_token, get_current_user, get_user, pwd_context
from ..config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(tags=["Auth"])


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not pwd_context.verify(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
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


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user.get("username"),
        "role": current_user.get("role", "user"),
        "rooms": current_user.get("rooms", []),
    }
