# Stage 1: Build React frontend
FROM node:22-alpine@sha256:ab07539e0988b63558ff621f5fbe1077054c39d9809112974fb79993949d41cd AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.13-slim@sha256:c33f0bc4364a6881bed1ec0cc2665e6c53c87a43e774aaeab88e6f17af105e4f
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

# Make the copied static tree readable by the non-root appuser.
# COPY can land .otf fonts as mode 0600 (root-only), causing StaticFiles to send
# a Content-Length header but 0 body bytes -> browser ERR_CONTENT_LENGTH_MISMATCH.
# a+rX grants read to all + traverse on directories only (not exec on files).
RUN chmod -R a+rX ./static

USER appuser

EXPOSE 8000
# HEALTHCHECK removed for test stability
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--ws-ping-interval", "20", "--ws-ping-timeout", "10"]
