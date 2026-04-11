FROM python:3.10-slim

WORKDIR /app

# Install system dependencies needed for psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements (assuming they are in the parent directory logically, 
# but docker context should be root, so we copy requirements.txt from root context)
# We will use the root of the project as the build context for this Dockerfile.
COPY ./requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt

COPY ./backend /app

# Ensure we have the right start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
