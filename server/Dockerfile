FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (none required for current setup)
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# For simplicity, we can install directly or copy the file
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the application
CMD ["python", "main.py"]
