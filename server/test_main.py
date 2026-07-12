import pytest
import os
from unittest.mock import MagicMock, patch

# Set DATABASE_URL env var to SQLite for testing before imports
os.environ["DATABASE_URL"] = "sqlite:///./test_automation.db"

# Start patching paho.mqtt.client.Client before importing FastAPI app
patcher = patch("paho.mqtt.client.Client")
mock_client_class = patcher.start()
mock_client = MagicMock()
mock_client_class.return_value = mock_client

# Mock app.users_db methods to bypass PostgreSQL during tests
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
mock_users = {
    "admin": {
        "username": "admin",
        "hashed_password": pwd_context.hash("1234"),
        "role": "admin",
        "rooms": []
    }
}

mock_biometric_keys = {}  # (username, device_id) -> public_key
mock_biometric_challenges = {}  # challenge -> {username, device_id, expires_at}

def mock_save_biometric_key(username, device_id, public_key):
    mock_biometric_keys[(username, device_id)] = public_key

def mock_get_biometric_key(username, device_id):
    return mock_biometric_keys.get((username, device_id))

def mock_get_biometric_keys_by_device(device_id):
    return [
        {"username": u, "public_key": pk}
        for (u, d), pk in mock_biometric_keys.items()
        if d == device_id
    ]

def mock_create_biometric_challenge(challenge, username, device_id, expires_in_seconds=300):
    from datetime import datetime, timedelta
    mock_biometric_challenges[challenge] = {
        "username": username,
        "device_id": device_id,
        "expires_at": datetime.utcnow() + timedelta(seconds=expires_in_seconds)
    }

def mock_consume_biometric_challenge(challenge):
    return mock_biometric_challenges.pop(challenge, None)

patch("app.users_db.init_users_db", return_value=None).start()
patch("app.users_db.get_persisted_user", side_effect=mock_users.get).start()
patch("app.users_db.persist_user", side_effect=lambda u, h, r="user", rms=None: mock_users.update({u: {"username": u, "hashed_password": h, "role": r, "rooms": rms or []}})).start()
patch("app.users_db.save_biometric_key", side_effect=mock_save_biometric_key).start()
patch("app.users_db.get_biometric_key", side_effect=mock_get_biometric_key).start()
patch("app.users_db.get_biometric_keys_by_device", side_effect=mock_get_biometric_keys_by_device).start()
patch("app.users_db.create_biometric_challenge", side_effect=mock_create_biometric_challenge).start()
patch("app.users_db.consume_biometric_challenge", side_effect=mock_consume_biometric_challenge).start()

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
    response = client.post("/set/r1/l1?state=1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["new_state"] == 1

    response = client.get("/states", headers={"Authorization": f"Bearer {token}"})
    assert response.json()["states"]["r1/l1"] == 1


def test_toggle_all_admin():
    token = get_token("admin", "1234")
    response = client.post("/set-all?state=1", headers={"Authorization": f"Bearer {token}"})
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
    response = client.post("/set/r3/f1?state=1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    
    # Verify response structure
    res_data = response.json()
    assert res_data["new_state"] == 1
    assert set(res_data["affected_ids"]) == {"r3/f1", "r5/f1", "r6/f1"}

    # Verify MQTT publish went to the group topic, not the device ID
    mock_client.publish.assert_called_once_with("r3:5:6/f1", "1", qos=1, retain=True)


def test_biometric_auth_flow():
    import base64
    import time
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import hashes, serialization

    # 1. Generate EC key pair for testing
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    pem_pub = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode("utf-8")

    # 2. Get login token for admin to enroll device
    token = get_token("admin", "1234")
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Enroll biometric key
    device_id = "android_device_99"
    response = client.post(
        f"/devices/{device_id}/biometric-key",
        json={"public_key": pem_pub},
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["detail"] == "Biometric public key registered successfully"

    # Enroll with invalid key format should fail
    response_fail = client.post(
        f"/devices/{device_id}/biometric-key",
        json={"public_key": "not-a-valid-key"},
        headers=headers
    )
    assert response_fail.status_code == 400

    # 4. Request challenge
    # Try with device_id only
    response_challenge = client.post(
        "/auth/biometric/challenge",
        json={"device_id": device_id}
    )
    assert response_challenge.status_code == 200
    challenge_data = response_challenge.json()
    assert "challenge" in challenge_data
    assert challenge_data["username"] == "admin"
    nonce = challenge_data["challenge"]

    # 5. Sign the challenge with a timestamp (binding both)
    timestamp = int(time.time() * 1000)
    signed_message = f"{nonce}:{timestamp}".encode("utf-8")
    
    signature = private_key.sign(signed_message, ec.ECDSA(hashes.SHA256()))
    signature_b64 = base64.b64encode(signature).decode("utf-8")

    # 6. Verify biometric login
    response_verify = client.post(
        "/auth/biometric/verify",
        json={
            "device_id": device_id,
            "nonce": nonce,
            "signature": signature_b64,
            "timestamp": timestamp
        }
    )
    assert response_verify.status_code == 200
    verify_data = response_verify.json()
    assert "access_token" in verify_data
    assert verify_data["username"] == "admin"

    # 7. Reusing the same challenge should fail (single-use constraint)
    response_verify_reuse = client.post(
        "/auth/biometric/verify",
        json={
            "device_id": device_id,
            "nonce": nonce,
            "signature": signature_b64,
            "timestamp": timestamp
        }
    )
    assert response_verify_reuse.status_code == 401
    
    # 8. Mismatched device ID should fail
    response_challenge2 = client.post(
        "/auth/biometric/challenge",
        json={"device_id": device_id}
    )
    nonce2 = response_challenge2.json()["challenge"]
    signed_message2 = nonce2.encode("utf-8")
    signature2 = private_key.sign(signed_message2, ec.ECDSA(hashes.SHA256()))
    signature_b64_2 = base64.b64encode(signature2).decode("utf-8")
    
    response_verify_mismatch = client.post(
        "/auth/biometric/verify",
        json={
            "device_id": "different_device",
            "nonce": nonce2,
            "signature": signature_b64_2
        }
    )
    assert response_verify_mismatch.status_code == 401
