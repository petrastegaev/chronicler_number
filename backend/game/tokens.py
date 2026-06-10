import time
import uuid

# Module-level store: {token_hex: {"nickname": str, "role": str, "created_at": float}}
_reconnect_tokens: dict[str, dict] = {}
TOKEN_TTL = 3600  # 1 hour


def generate_token(nickname: str, role: str) -> str:
    """Generate a UUID hex token and store the session data."""
    token = uuid.uuid4().hex
    _reconnect_tokens[token] = {"nickname": nickname, "role": role, "created_at": time.time()}
    return token


def restore_from_token(token: str) -> dict | None:
    """Look up session data by token. Returns None if not found or expired."""
    entry = _reconnect_tokens.get(token)
    if entry is None:
        return None
    if time.time() - entry["created_at"] > TOKEN_TTL:
        _reconnect_tokens.pop(token, None)
        return None
    return entry


def remove_token(token: str) -> None:
    """Remove a token from the store (e.g., on explicit disconnect)."""
    _reconnect_tokens.pop(token, None)
