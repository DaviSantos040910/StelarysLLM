# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
# PYTHONDONTWRITEBYTECODE: Prevents Python from writing pyc files to disc
# PYTHONUNBUFFERED: Prevents Python from buffering stdout and stderr
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT 8080

# Install system dependencies
# ffmpeg: For pydub/audio processing
# libpango/libcairo/libgdk-pixbuf: For weasyprint (PDF generation)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project
COPY . /app/

# Collect static files
# Note: This might require valid storage credentials if using GCS for static files during build.
# For Cloud Run, usually we run this via a separate job or use whitenoise if simple.
# Here we assume collectstatic is run or handled by storage provider.
# RUN python manage.py collectstatic --noinput

# Run the application
# CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 config.wsgi:application
CMD exec gunicorn --bind :$PORT --workers 2 --threads 8 --timeout 0 config.wsgi:application
