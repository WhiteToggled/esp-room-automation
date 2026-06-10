from main import app
from database import Base, Device, get_db
from auth import USERS_DB

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
