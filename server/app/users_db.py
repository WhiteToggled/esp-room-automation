import os
import sqlite3
from typing import Dict, List, Optional

from passlib.context import CryptContext

from .config import DATA_DIR

USERS_DB_PATH = os.path.join(DATA_DIR, "users.db")
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _parse_rooms(room_str: Optional[str]) -> List[str]:
    if not room_str:
        return []
    return [r.strip() for r in room_str.split(",") if r.strip()]


def _serialize_rooms(rooms: List[str]) -> str:
    return ",".join(rooms)


def init_users_db():
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                room TEXT
            )
            """
        )
        try:
            cur.execute("ALTER TABLE users ADD COLUMN room TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists

        cur.execute("SELECT 1 FROM users WHERE username = 'admin'")
        if not cur.fetchone():
            admin_password = os.getenv("ADMIN_PASSWORD", "1234")
            cur.execute(
                "INSERT INTO users (username, password_hash, role, room) VALUES (?, ?, ?, ?)",
                ("admin", _pwd_context.hash(admin_password), "admin", ""),
            )

        con.commit()
    finally:
        con.close()


def get_persisted_user(username: str) -> Optional[Dict]:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT username, password_hash, role, room FROM users WHERE username = ?",
            (username,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "username": row[0],
            "hashed_password": row[1],
            "role": row[2],
            "rooms": _parse_rooms(row[3]),
        }
    finally:
        con.close()


def persist_user(
    username: str,
    password_hash: str,
    role: str = "user",
    rooms: Optional[List[str]] = None,
) -> None:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO users (username, password_hash, role, room) VALUES (?, ?, ?, ?)",
            (username, password_hash, role, _serialize_rooms(rooms or [])),
        )
        con.commit()
    finally:
        con.close()


def update_user_rooms(username: str, rooms: List[str]) -> bool:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "UPDATE users SET room = ? WHERE username = ?",
            (_serialize_rooms(rooms), username),
        )
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def list_all_users() -> List[Dict]:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute("SELECT username, role, room FROM users ORDER BY username")
        return [
            {"username": r[0], "role": r[1], "rooms": _parse_rooms(r[2])}
            for r in cur.fetchall()
        ]
    finally:
        con.close()


def update_user_password(username: str, new_password_hash: str) -> bool:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (new_password_hash, username),
        )
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def remove_user(username: str) -> bool:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM users WHERE username = ?", (username,))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()
