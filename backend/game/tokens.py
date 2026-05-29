import uuid

# Module-level store: {token_hex: {"nickname": str, "role": str}}
_reconnect_tokens: dict[str, dict] = {}


def generate_token(nickname: str, role: str) -> str:
    """Generate a UUID hex token and store the session data."""
    token = uuid.uuid4().hex
    _reconnect_tokens[token] = {"nickname": nickname, "role": role}
    return token


def restore_from_token(token: str) -> dict | None:
    """Look up session data by token. Returns None if not found or expired."""
    return _reconnect_tokens.get(token)


def remove_token(token: str) -> None:
    """Remove a token from the store (e.g., on explicit disconnect)."""
    _reconnect_tokens.pop(token, None)
