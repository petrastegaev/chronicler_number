"""Shared authentication utilities for REST API and WebSocket."""

import os
from fastapi import Header, HTTPException

ADMIN_KEY = os.environ.get("ADMIN_KEY", "booth-admin-2026")


async def verify_admin_key(x_admin_key: str = Header(..., alias="X-Admin-Key")):
    """FastAPI dependency: require admin key in X-Admin-Key header."""
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: invalid admin key")
    return True
