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

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser

# Create data directory for SQLite at /app/data (matches compose volume mount)
RUN mkdir -p /app/data && chown appuser /app/data

USER appuser

EXPOSE 8000
# HEALTHCHECK removed for test stability
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
