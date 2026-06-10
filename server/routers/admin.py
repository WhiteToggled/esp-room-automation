from fastapi import APIRouter, Depends, HTTPException

from auth import USERS_DB, pwd_context, require_admin
from schemas import UserCreate, UserRoomsUpdate
from users_db import (
    get_persisted_user,
    list_all_users,
    persist_user,
    remove_user,
    update_user_rooms,
)

router = APIRouter(tags=["Admin"])


@router.post("/users", status_code=201)
def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_admin),
):
    """Admin only: create a user account and assign it to one or more rooms."""
    uname = user_data.username.strip()
    if len(uname) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(user_data.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if uname in USERS_DB or get_persisted_user(uname) is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = pwd_context.hash(user_data.password)
    try:
        persist_user(uname, hashed, role="user", rooms=user_data.rooms)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create user: {e}")

    return {"username": uname, "role": "user", "rooms": user_data.rooms}


@router.get("/users")
def list_users(current_user: dict = Depends(require_admin)):
    """Admin only: list all user accounts with their assigned rooms."""
    return list_all_users()


@router.put("/users/{username}/rooms")
def assign_user_rooms(
    username: str,
    data: UserRoomsUpdate,
    current_user: dict = Depends(require_admin),
):
    """Admin only: replace a user's room assignments."""
    if not get_persisted_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    if not update_user_rooms(username, data.rooms):
        raise HTTPException(status_code=500, detail="Failed to update rooms")
    return {"username": username, "rooms": data.rooms}


@router.delete("/users/{username}")
def delete_user(
    username: str,
    current_user: dict = Depends(require_admin),
):
    """Admin only: delete a user account."""
    if not get_persisted_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    remove_user(username)
    return {"message": f"User '{username}' deleted"}
