# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/dist ./static

# Create data directory for SQLite
RUN mkdir -p /app/data

# Non-root user for security — only chown the writable data directory
RUN adduser --disabled-password --gecos '' appuser && chown appuser /app/data
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/stats/')"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--graceful-timeout", "5"]
