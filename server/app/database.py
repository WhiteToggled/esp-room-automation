from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text
from sqlalchemy.orm import Session, sessionmaker, declarative_base
from .config import DATABASE_URL


engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)


class DeviceState(Base):
    __tablename__ = "device_states"
    device_id = Column(String, primary_key=True)
    state = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


def save_device_state(db: Session, device_id: str, state: int) -> None:
    db.merge(DeviceState(device_id=device_id, state=state, updated_at=datetime.utcnow()))
    db.commit()


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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
