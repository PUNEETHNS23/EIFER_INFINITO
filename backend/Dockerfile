FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt from the backend directory
COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt

# Copy the backend directory contents to /app
COPY . /app

# Ensure we have the right start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]