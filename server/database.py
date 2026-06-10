import re
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text
from sqlalchemy.orm import sessionmaker, declarative_base
import sqlalchemy.dialects.sqlite.pysqlite as pysqlite
import sqlalchemy.dialects.sqlite.pysqlcipher as pysqlcipher
from sqlalchemy.dialects.sqlite.pysqlite import SQLiteDialect_pysqlite
from config import DATABASE_URL


# --- SQLAlchemy SQLite monkeypatch for pysqlcipher3 compatibility ---

def _custom_regexp(pattern, item):
    if item is None:
        return False
    try:
        return re.search(pattern, str(item), re.I) is not None
    except Exception:
        return False


def _set_regexp(dbapi_connection):
    try:
        dbapi_connection.create_function("REGEXP", 2, _custom_regexp, deterministic=True)
    except TypeError:
        dbapi_connection.create_function("REGEXP", 2, _custom_regexp)


pysqlite.set_regexp = _set_regexp
pysqlcipher.set_regexp = _set_regexp
SQLiteDialect_pysqlite.on_connect = lambda self: _set_regexp


# --- Engine & Session ---

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- ORM Models ---

class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)


class StateLog(Base):
    __tablename__ = "state_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    snapshot = Column(Text, nullable=False)


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String, nullable=False)
    action = Column(Integer, nullable=False)        # 0 = off, 1 = on
    hour = Column(Integer, nullable=False)          # 0–23
    minute = Column(Integer, nullable=False)        # 0–59
    days = Column(String, nullable=False)           # comma-separated: "mon,tue,wed"
    enabled = Column(Integer, default=1, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


Base.metadata.create_all(bind=engine)


# --- DB Session Dependency ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
