# ESP Room Automation Server

A FastAPI-based backend for managing device states via SQLite and MQTT.

## Features
- **Device Management**: Tracks device states (ON/OFF) in a SQLite database.
- **MQTT Integration**: Automatically publishes state changes to MQTT topics matching the device ID (e.g., `r1/l1`).
- **REST API**: 
  - `GET /states`: Returns a dictionary of all device states.
  - `POST /toggle/{id}`: Toggles a device and triggers an MQTT message.
- **Automatic Seeding**: Seeds the database with devices like `r1/l1` (Room 1 Light 1) and `r2/f2` (Room 2 Fan 2) on first startup.

## Prerequisites
- Python 3.9+
- MQTT Broker (e.g., Mosquitto)

## Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the server:
   ```bash
   python main.py
   ```

## API Usage

### Get all states
```bash
curl http://localhost:8000/states
# Response: {"r1/l1": 0, "r2/f2": 1, ...}
```

### Toggle a device
```bash
curl -X POST http://localhost:8000/toggle/r1/l1
# Response: {"id": "r1/l1", "new_state": 1}
```

## Deployment (Docker Compose)
The easiest way to run the entire stack (Server + MQTT Broker) is using Docker Compose.

**To start fresh and ensure everything works:**
```bash
docker compose down && docker compose up --build
```

2. The server will be available at `http://localhost:8000`.
3. **Swagger UI**: Access `http://localhost:8000/docs` to see the interactive documentation and test the API.

## Configuration
The following environment variables can be used:
- `MQTT_BROKER`: Address of the MQTT broker (default: `localhost`).
- `MQTT_PORT`: Port of the MQTT broker (default: `1883`).
- `DATABASE_URL`: SQLAlchemy database URL (default: `sqlite:///./automation.db`).

## Deployment (Docker)
1. Build the image:
   ```bash
   docker build -t automation-server .
   ```
2. Run the container:
   ```bash
   docker run -p 8000:8000 -e MQTT_BROKER=your-broker-ip automation-server
   ```
