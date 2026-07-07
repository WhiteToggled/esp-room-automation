import pytest
from unittest.mock import MagicMock, patch

# Start patching paho.mqtt.client.Client before importing FastAPI app
patcher = patch("paho.mqtt.client.Client")
mock_client_class = patcher.start()
mock_client = MagicMock()
mock_client_class.return_value = mock_client

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, Device, get_db

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
    token = get_token("admin", "1234")
    response = client.get("/states", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "r1/l1" in response.json()["states"]


def test_toggle_device_authorized():
    token = get_token("admin", "1234")
    response = client.post("/toggle/r1/l1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["new_state"] == 1

    response = client.get("/states", headers={"Authorization": f"Bearer {token}"})
    assert response.json()["states"]["r1/l1"] == 1


def test_toggle_all_admin():
    token = get_token("admin", "1234")
    response = client.post("/toggle-all", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["new_state"] == 1


def test_mqtt_sync_group():
    # Set up group mapping
    from app.state import group_to_devices, device_to_group, device_states
    from app.mqtt import _on_message, MQTT_SYNC_TOPIC
    
    group_to_devices["r3:5:6/f1"] = ["r3/f1", "r5/f1", "r6/f1"]
    for d in ["r3/f1", "r5/f1", "r6/f1"]:
        device_to_group[d] = "r3:5:6/f1"
        device_states[d] = 1 # Start as ON
        
    class MockMsg:
        def __init__(self, topic, payload):
            self.topic = topic
            self.payload = payload

    # Simulate ESP sending sync message r3:5:6/f1=0
    msg = MockMsg(MQTT_SYNC_TOPIC, b"r3:5:6/f1=0")
    _on_message(None, None, msg)
    
    # Check states updated to 0
    assert device_states["r3/f1"] == 0
    assert device_states["r5/f1"] == 0
    assert device_states["r6/f1"] == 0


def test_mqtt_sync_individual_device():
    from app.state import device_states
    from app.mqtt import _on_message, MQTT_SYNC_TOPIC
    
    device_states["r1/l2"] = 1 # Start as ON
    
    class MockMsg:
        def __init__(self, topic, payload):
            self.topic = topic
            self.payload = payload

    # Simulate ESP sending sync message r1/l2=0
    msg = MockMsg(MQTT_SYNC_TOPIC, b"r1/l2=0")
    _on_message(None, None, msg)
    
    # Check state updated to 0
    assert device_states["r1/l2"] == 0


def test_frontend_toggle_group_mapping():
    # Set up group mapping
    from app.state import group_to_devices, device_to_group, device_states
    
    group_to_devices["r3:5:6/f1"] = ["r3/f1", "r5/f1", "r6/f1"]
    for d in ["r3/f1", "r5/f1", "r6/f1"]:
        device_to_group[d] = "r3:5:6/f1"
        device_states[d] = 0 # Start as OFF

    token = get_token("admin", "1234")
    # Make sure devices are in db
    db = TestingSessionLocal()
    for d in ["r3/f1", "r5/f1", "r6/f1"]:
        if not db.query(Device).filter(Device.id == d).first():
            db.add(Device(id=d))
    db.commit()
    db.close()

    mock_client.publish.reset_mock()
    response = client.post("/toggle/r3/f1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    
    # Verify response structure
    res_data = response.json()
    assert res_data["new_state"] == 1
    assert set(res_data["affected_ids"]) == {"r3/f1", "r5/f1", "r6/f1"}

    # Verify MQTT publish went to the group topic, not the device ID
    mock_client.publish.assert_called_once_with("r3:5:6/f1", "1", qos=1, retain=True)
