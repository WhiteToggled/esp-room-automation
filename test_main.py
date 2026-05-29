import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from server import app, get_db, Base, Device

# Setup test database with encryption
SQLALCHEMY_DATABASE_URL = "sqlite+pysqlcipher://:testpass@/./test_automation.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Seed test data
    if db.query(Device).count() == 0:
        db.add_all([Device(id=str(i), state=0) for i in range(1, 4)])
        db.commit()
    yield
    Base.metadata.drop_all(bind=engine)

def test_get_states():
    response = client.get("/states")
    assert response.status_code == 200
    assert response.json() == {"1": 0, "2": 0, "3": 0}

def test_toggle_device():
    # Toggle device 1: 0 -> 1
    response = client.post("/toggle/1")
    assert response.status_code == 200
    assert response.json()["new_state"] == 1
    
    # Check states again
    response = client.get("/states")
    assert response.json() == {"1": 1, "2": 0, "3": 0}
    
    # Toggle device 1 again: 1 -> 0
    response = client.post("/toggle/1")
    assert response.json()["new_state"] == 0
    assert client.get("/states").json() == {"1": 0, "2": 0, "3": 0}

def test_toggle_nonexistent_device():
    response = client.post("/toggle/99")
    assert response.status_code == 404
    assert response.json()["detail"] == "Device '99' not found"
