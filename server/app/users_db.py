import os
from typing import Dict, List, Optional

import psycopg2
import psycopg2.extras
from passlib.context import CryptContext

from .config import DATABASE_URL

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _parse_rooms(room_str: Optional[str]) -> List[str]:
    if not room_str:
        return []
    return [r.strip() for r in room_str.split(",") if r.strip()]


def _serialize_rooms(rooms: List[str]) -> str:
    return ",".join(rooms)


def _connect():
    return psycopg2.connect(DATABASE_URL)


def init_users_db():
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                room TEXT
            )
            """
        )
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS room TEXT")

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS biometric_keys (
                username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                device_id TEXT NOT NULL,
                public_key TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (username, device_id)
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS biometric_challenges (
                challenge TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                device_id TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL
            )
            """
        )

        cur.execute("SELECT 1 FROM users WHERE username = 'admin'")
        if not cur.fetchone():
            admin_password = os.getenv("ADMIN_PASSWORD", "1234")
            cur.execute(
                "INSERT INTO users (username, password_hash, role, room) VALUES (%s, %s, %s, %s)",
                ("admin", _pwd_context.hash(admin_password), "admin", ""),
            )

        con.commit()
    finally:
        con.close()


def get_persisted_user(username: str) -> Optional[Dict]:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT username, password_hash, role, room FROM users WHERE username = %s",
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
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO users (username, password_hash, role, room) VALUES (%s, %s, %s, %s)",
            (username, password_hash, role, _serialize_rooms(rooms or [])),
        )
        con.commit()
    finally:
        con.close()


def update_user_rooms(username: str, rooms: List[str]) -> bool:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            "UPDATE users SET room = %s WHERE username = %s",
            (_serialize_rooms(rooms), username),
        )
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def update_user_password(username: str, new_password_hash: str) -> bool:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE username = %s",
            (new_password_hash, username),
        )
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def list_all_users() -> List[Dict]:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute("SELECT username, role, room FROM users ORDER BY username")
        return [
            {"username": r[0], "role": r[1], "rooms": _parse_rooms(r[2])}
            for r in cur.fetchall()
        ]
    finally:
        con.close()


def remove_user(username: str) -> bool:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM users WHERE username = %s", (username,))
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


def save_biometric_key(username: str, device_id: str, public_key: str) -> None:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            """
            INSERT INTO biometric_keys (username, device_id, public_key)
            VALUES (%s, %s, %s)
            ON CONFLICT (username, device_id) 
            DO UPDATE SET public_key = EXCLUDED.public_key, created_at = CURRENT_TIMESTAMP
            """,
            (username, device_id, public_key),
        )
        con.commit()
    finally:
        con.close()


def get_biometric_key(username: str, device_id: str) -> Optional[str]:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT public_key FROM biometric_keys WHERE username = %s AND device_id = %s",
            (username, device_id),
        )
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        con.close()


def get_biometric_keys_by_device(device_id: str) -> List[Dict]:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT username, public_key FROM biometric_keys WHERE device_id = %s",
            (device_id,),
        )
        return [{"username": row[0], "public_key": row[1]} for row in cur.fetchall()]
    finally:
        con.close()


def create_biometric_challenge(challenge: str, username: str, device_id: str, expires_in_seconds: int = 300) -> None:
    con = _connect()
    try:
        cur = con.cursor()
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        # Cleanup expired challenges
        cur.execute("DELETE FROM biometric_challenges WHERE expires_at < %s", (now,))
        
        expires_at = now + timedelta(seconds=expires_in_seconds)
        cur.execute(
            """
            INSERT INTO biometric_challenges (challenge, username, device_id, expires_at)
            VALUES (%s, %s, %s, %s)
            """,
            (challenge, username, device_id, expires_at),
        )
        con.commit()
    finally:
        con.close()


def consume_biometric_challenge(challenge: str) -> Optional[Dict]:
    con = _connect()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT username, device_id, expires_at FROM biometric_challenges WHERE challenge = %s",
            (challenge,),
        )
        row = cur.fetchone()
        if not row:
            return None
        cur.execute("DELETE FROM biometric_challenges WHERE challenge = %s", (challenge,))
        con.commit()
        return {
            "username": row[0],
            "device_id": row[1],
            "expires_at": row[2],
        }
    finally:
        con.close()
