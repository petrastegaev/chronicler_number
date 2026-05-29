---
phase: 01-foundation
plan: 03
subsystem: backend
tags:
  - fastapi
  - websocket
  - connection-manager
  - rest-api
  - main-entrypoint
requires:
  - 01-foundation-01 (backend core models, database, schemas)
  - 01-foundation-02 (frontend scaffold, Docker)
provides:
  - runnable FastAPI application with WebSocket + REST
affects:
  - Dockerfile (StaticFiles mount expects static/ directory)
tech-stack:
  added:
    - FastAPI lifespan context manager
    - SQLAlchemy async event-driven WAL mode
    - WebSocket role-based protocol
  patterns:
    - Pattern 1: FastAPI Lifespan with Async SQLAlchemy Engine
    - Pattern 3: ConnectionManager Singleton with asyncio.gather Broadcast
    - Shared Pattern 2: Route Ordering (API Before StaticFiles)
    - Shared Pattern 4: WebSocket Disconnect Detection
    - Shared Pattern 5: SQLAlchemy 2.0 select() style
key-files:
  created:
    - backend/connection_manager.py
    - backend/services/question_service.py
    - backend/routers/questions.py
    - backend/main.py
  modified: []
decisions:
  - "route-ordering: API routes (include_router) and WebSocket endpoint registered before StaticFiles mount"
  - "lifespan-pattern: asynccontextmanager (not deprecated @app.on_event)"
  - "wal-pragma-approach: @event.listens_for(engine.sync_engine, 'connect') for async engine"
  - "expire_on_commit=False on async_sessionmaker to prevent MissingGreenlet"
metrics:
  duration: "~5 minutes"
  tasks: 3
  commits: 3
  files-created: 4
completed: "2026-05-29"
---

# Phase 1 Plan 3: Backend Application Layer Summary

**One-liner:** FastAPI application entry point with lifespan DB init (WAL mode), WebSocket endpoint with role-based ConnectionManager (strict 2+1 enforcement), QuestionService CRUD with SQLAlchemy 2.0 select() style, and questions REST API router at /api/questions, with StaticFiles mount serving the frontend.

## Key Files Created

### `backend/connection_manager.py` (54 lines)
ConnectionManager singleton tracking player1, player2, and admin WebSocket connections. Provides `broadcast()` (concurrent via `asyncio.gather`), `send_to_player()`, `send_to_players()`, and `send_to_admin()`. Enforces strict 2+1 connection model per D-09.

### `backend/services/question_service.py` (30 lines)
QuestionService with 5 static methods:
- `get_all(db, skip, limit)` -- paginated list
- `get_by_id(db, question_id)` -- single lookup, returns None if missing
- `create(db, text, answer, category)` -- insert with commit + refresh
- `delete(db, question_id)` -- delete by ID, returns bool
- `random_selection(db, count)` -- random question subset (for game rounds)

All use SQLAlchemy 2.0 `select()` style (not deprecated `session.query()`).

### `backend/routers/questions.py` (25 lines)
FastAPI APIRouter at `/api/questions` with 4 endpoints:
- `GET /api/questions/` -- list with skip/limit pagination
- `GET /api/questions/{question_id}` -- get by ID (404 if missing)
- `POST /api/questions/` -- create with Pydantic validation (returns 201)
- `DELETE /api/questions/{question_id}` -- delete by ID (returns 204, 404 if missing)

### `backend/main.py` (107 lines)
Central application entry point wiring everything together:
- **Lifespan handler** (asynccontextmanager): Creates async SQLAlchemy engine with `sqlite+aiosqlite:///data/game.db`, sets WAL mode PRAGMAs via `@event.listens_for(engine.sync_engine, "connect")`, creates all 4 tables via `Base.metadata.create_all()`, stores session factory with `expire_on_commit=False` on `app.state`.
- **WebSocket /ws endpoint**: Accepts first JSON message as join event (D-10). Validates role ("player" or "admin"), enforces slot limits (2 players max, 1 admin max). Sends `joined` event with assigned role/number. Detects disconnects via `receive_json()` loop raising `WebSocketDisconnect` -- cleans up connection slots on disconnect.
- **Route registration**: `questions_router` included at line 45, WebSocket defined at line 48, StaticFiles mount at line 107 (LAST, preventing route shadowing).

## Route Inspection

```
GET  /api/questions/         -- list questions (skip/limit)
GET  /api/questions/{id}     -- get question by ID
POST /api/questions/         -- create question (Pydantic validated)
DELETE /api/questions/{id}   -- delete question
WebSocket /ws                -- join/role assignment protocol
StaticFiles /                -- serves React frontend (LAST)
```

## Threat Model Compliance

| Threat ID | Category | Status | Verification |
|-----------|----------|--------|-------------|
| T-03-01 | Spoofing (WebSocket) | Mitigated | First message validated: `data.get("event") == "join"` with role check |
| T-03-02 | Tampering (REST POST) | Mitigated | Pydantic QuestionCreate validates text (1-500), answer (0-1M), category (max 255) |
| T-03-03 | DoS (WebSocket) | Accepted | Max 3 connections enforced by ConnectionManager |
| T-03-04 | Tampering (SQL injection) | Mitigated | All queries use SQLAlchemy ORM parameterized select() |
| T-03-05 | Info Disclosure (StaticFiles) | Accepted | FastAPI StaticFiles handles path traversal safely |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all files are fully functional with no placeholder content.

## Threat Flags

None -- no security-relevant surfaces introduced beyond what is covered by the threat model.

## Self-Check: PASSED

- [x] `python3 -c "from main import app"` exits 0 -- all modules import cleanly
- [x] FastAPI app has lifespan handler (`app.router.lifespan_context` is set)
- [x] WebSocket endpoint at /ws present in route table
- [x] 4 API routes at /api/questions present in route table
- [x] StaticFiles mount is last app configuration (line 107)
- [x] ConnectionManager exposes all required methods (broadcast, send_to_player, send_to_players, send_to_admin)
- [x] QuestionService has all 5 static methods
