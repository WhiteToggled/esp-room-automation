import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from server import app, get_db, Base, Device, USERS_DB

# Setup test database - using standard sqlite for tests to avoid sqlcipher complexity in CI
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_automation.db"
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
        db.add_all([Device(id=f"r1/l{i}") for i in range(1, 4)])
        db.commit()
    yield
    Base.metadata.drop_all(bind=engine)

def get_token(username, password):
    response = client.post("/login", data={"username": username, "password": password})
    return response.json()["access_token"]

def test_get_states_unauthorized():
    response = client.get("/states")
    assert response.status_code == 401

def test_get_states_authorized():
    token = get_token("admin", "admin123")
    response = client.get("/states", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "r1/l1" in response.json()

def test_toggle_device_authorized():
    token = get_token("owner", "owner123")
    response = client.post("/toggle/r1/l1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["new_state"] == 1
    
    # Check states again
    response = client.get("/states", headers={"Authorization": f"Bearer {token}"})
    assert response.json()["r1/l1"] == 1

def test_toggle_all_admin():
    token = get_token("admin", "admin123")
    response = client.post("/toggle-all", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["new_state"] == 1

def test_toggle_all_forbidden_for_owner():
    token = get_token("owner", "owner123")
    response = client.post("/toggle-all", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
