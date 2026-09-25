# ==============================================================================
# Dockerfile - Bitirme Projesi Takip (Capstone Project Tracking System)
# Multi-stage production build (Node 20 Alpine frontend build + Python 3.11-slim runtime)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React Frontend
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Leverage Docker layer caching for node dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy frontend source and build production bundle
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Python Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS production

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install minimal system dependencies (curl for healthcheck, sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies first (leveraging Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Copy compiled frontend distribution from Stage 1 builder
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create persistent storage directories and assign to non-root appuser
RUN mkdir -p /app/data /app/uploads \
    && useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health check against FastAPI /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
