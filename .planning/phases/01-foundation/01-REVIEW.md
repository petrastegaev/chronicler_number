---
phase: 01-foundation
reviewed: 2026-05-29T14:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - backend/__init__.py
  - backend/connection_manager.py
  - backend/database.py
  - backend/main.py
  - backend/models.py
  - backend/requirements.txt
  - backend/routers/__init__.py
  - backend/routers/questions.py
  - backend/schemas.py
  - backend/services/__init__.py
  - backend/services/question_service.py
  - frontend/src/App.tsx
  - frontend/src/index.css
  - frontend/src/main.tsx
  - frontend/src/pages/AdminPage.tsx
  - frontend/src/pages/JoinPage.tsx
  - frontend/src/stores/gameStore.ts
  - frontend/src/types/ws.ts
  - frontend/src/vite-env.d.ts
  - frontend/index.html
  - frontend/package.json
  - frontend/tsconfig.json
  - frontend/vite.config.ts
  - frontend/eslint.config.js
  - Dockerfile
  - compose.yml
  - .dockerignore
  - .gitignore
findings:
  critical: 2
  warning: 3
  info: 4
  total: 9
status: issues_found
---

# Phase 01: Code Review Report (Foundation)

**Reviewed:** 2026-05-29T14:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This review covers the foundation phase of the Number Duel project: the FastAPI backend skeleton with question CRUD and WebSocket endpoint, the React/Vite frontend scaffold, Docker deployment configuration, and project tooling configs.

Two blocker-level findings were identified: a file permission failure at container startup due to Docker volume mount ownership mismatch, and a WebSocket error handling gap that leaks stale connection references in the `ConnectionManager`. Three warnings and four informational items are also documented.

The core architecture choices (FastAPI + React + SQLite via aiosqlite) are sound, and the WebSocket protocol design (event-based messages, single /ws endpoint) follows the project specification.

---

## Critical Issues

### CR-01: Docker volume mount permissions prevent SQLite database creation

**File:** `compose.yml:7`, `Dockerfile:20-24`
**Issue:** The `compose.yml` bind-mounts `./data:/app/data`. When `./data` does not exist on the host (first run), Docker creates it owned by `root`. The container runs as `appuser` (non-root, set on Dockerfile line 24). Because the bind mount replaces `/app/data` at runtime, the `chown -R appuser /app` from the Docker build phase does NOT apply to the volume. Consequently, `appuser` cannot create or write files under `/app/data`, and the SQLAlchemy engine startup (`create_async_engine("sqlite+aiosqlite:///data/game.db")` on `main.py:19`) will fail with a permission error.

**Fix:** Create the data directory before the container starts or use a named volume. Option A (pre-create directory):
```bash
# Run before docker compose up, or add as a compose lifecycle hook
mkdir -p data && chown 1000:1000 data
```
Option B (entrypoint chown, simplest): Add an entrypoint script that ensures the mounted directory is writable. Option C (named volume, least portable for demo):
```yaml
volumes:
  game-data:
    # But then the data isn't easily inspected on the host
```

The most robust fix for a booth scenario is to make the startup tolerant: change the `CMD` to a script that `chown`s the data directory before starting uvicorn, or simply create `./data/` in the repo as an empty directory so it ships with correct permissions.

### CR-02: WebSocket JSON decode error leaves stale connection references

**File:** `backend/main.py:48-104`
**Issue:** The WebSocket handler only catches `WebSocketDisconnect` (line 96). If a connected client sends invalid JSON (e.g., raw binary, malformed text), `websocket.receive_json()` raises `json.JSONDecodeError`, which is NOT a `WebSocketDisconnect`. This exception propagates unhandled; the `except WebSocketDisconnect` block on line 96 does NOT execute. The `ConnectionManager` still holds a reference to the now-closed WebSocket object. Future calls to `broadcast()` or `send_to_*` will attempt `send_json()` on this stale reference. While `broadcast()` uses `return_exceptions=True`, silently swallowing errors to a dead connection, the stale reference is never cleaned up, and the leaked slot prevents a new player/admin from connecting (the admin slot check on line 60 would reject a legitimate admin because `manager.admin is not None` even though the old admin disconnected abruptly).

**Fix:** Catch all exceptions in the receive loop and perform cleanup, or catch a broader exception set:
```python
except WebSocketDisconnect:
    # cleanup
except Exception:
    # Also clean up on unexpected disconnect
    pass  # cleanup below
finally:
    if manager.player1 == websocket:
        manager.player1 = None
        manager.player1_nickname = None
    elif manager.player2 == websocket:
        manager.player2 = None
        manager.player2_nickname = None
    elif manager.admin == websocket:
        manager.admin = None
```

---

## Warnings

### WR-01: WebSocket accepts connections without a valid join message

**File:** `backend/main.py:54-94`
**Issue:** If a client connects and sends a first message that is valid JSON but does not contain `event == "join"` (e.g., `{"event": "unknown_event"}`), or has a role other than `"admin"` or `"player"`, the code falls through to the `while True` receive loop (line 93) without ever registering the connection. The WebSocket is accepted and kept open indefinitely, consuming server resources. When the client eventually disconnects, the `except WebSocketDisconnect` cleanup runs, but since the connection was never registered, the cleanup is a no-op. This is a resource leak and a potential entry point for unauthenticated connections to consume server resources.

Additionally, an admin client that sends `{"event": "join", "data": {"role": "admin"}}` with no extra data succeeds and receives a `joined` event. There is no authentication or admin secret. For an offline booth app this may be acceptable, but any device on the local WiFi can claim the admin slot and control the game.

**Fix:** Add an `else` clause after the `if role == "admin" / elif role == "player"` chain that sends an error and closes the connection on unrecognized roles or missing event.
```python
if data.get("event") == "join":
    role = data.get("data", {}).get("role")
    # ...
else:
    await websocket.send_json({
        "event": "error",
        "data": {"message": "First message must be a 'join' event"}
    })
    await websocket.close(code=1002)
    return
```

### WR-02: Bare exception handlers in ConnectionManager methods

**File:** `backend/connection_manager.py:37-38, 52-54`
**Issue:** `send_to_player()` and `send_to_admin()` use bare `except: pass` clauses. These catch all exceptions including `asyncio.CancelledError` (which should rarely be swallowed), `KeyboardInterrupt`, and `GeneratorExit`. More practically, if a non-`WebSocketDisconnect` error occurs (e.g., `RuntimeError` from a closed connection), the error is silently discarded with no logging. This makes debugging WebSocket delivery failures difficult.

**Fix:** Catch specific expected exceptions and log unexpected ones:
```python
try:
    await ws.send_json(message)
except (WebSocketDisconnect, RuntimeError):
    # Log at debug level — expected during normal disconnect
    pass
except Exception:
    # Log at warning level — unexpected delivery failure
    import logging
    logging.getLogger(__name__).warning("Unexpected WebSocket send error", exc_info=True)
```

### WR-03: Missing nickname validation at the WebSocket layer

**File:** `backend/main.py:57`, `backend/models.py:25`
**Issue:** The `GameSession` model defines `player1_nickname` as `String(15)` but SQLite does not enforce VARCHAR length limits. The WebSocket handler (line 57) accepts any string as nickname, including empty strings (`nickname = data.get("data", {}).get("nickname", "")`) or strings hundreds of characters long. An empty nickname causes no display issues yet, but could produce confusing behavior in the game UI. An unreasonably long nickname would be stored in the database without truncation.

**Fix:** Validate nickname length before accepting the join:
```python
nickname = data.get("data", {}).get("nickname", "").strip()
if not nickname or len(nickname) > 15:
    await websocket.send_json({
        "event": "error",
        "data": {"message": "Nickname must be 1-15 characters"}
    })
    await websocket.close()
    return
```

---

## Info

### IN-01: App title does not match project name

**File:** `backend/main.py:42`
**Issue:** The FastAPI app is created with `title="Duel Chisel"`, but the project is named "Number Duel" / "Duel chisel" (from `CLAUDE.md`). The title will appear in the auto-generated OpenAPI docs and could confuse developers. Clarify with the team which name is canonical and align the title field.

### IN-02: Unused import in main.py

**File:** `backend/main.py:1`
**Issue:** `import asyncio` is unused in `main.py`. The `asyncio.gather` calls used by the connection manager are in `backend/connection_manager.py`, which has its own import. This will trigger a lint warning if a strict linter is added later.

### IN-03: Unnecessary innerHTML clearing in React entry point

**File:** `frontend/src/main.tsx:22`
**Issue:** `root.innerHTML = ''` is called before `createRoot(root).render(...)`. React's `createRoot` API replaces the container content on first render automatically. The manual clearing is redundant and could cause a brief flash if the root element is non-empty.

### IN-04: ESLint configuration lacks React-specific rules

**File:** `frontend/eslint.config.js`
**Issue:** The ESLint config extends only `@eslint/js` recommended and `typescript-eslint` recommended. No `eslint-plugin-react` or `eslint-plugin-react-hooks` rules are applied, even though the project is a React application. This means common React mistakes (missing hook dependencies, incorrect JSX patterns) will not be caught by linting. Consider adding `eslint-plugin-react-hooks` and the React recommended config.

---

_Reviewed: 2026-05-29T14:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
