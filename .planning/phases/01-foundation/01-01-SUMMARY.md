---
phase: 01-foundation
plan: 01
subsystem: database
tags: [fastapi, sqlalchemy, aiosqlite, sqlite, pydantic, async, orm]
requires: []
provides:
  - Async SQLAlchemy engine with WAL mode PRAGMAs (configured in Plan 01-03 lifespan handler)
  - All 4 ORM models: Question, GameSession, Round, Stat
  - Pydantic v2 request/response schemas with input validation
  - get_db FastAPI dependency for session injection
affects:
  - 01-foundation-02 (ConnectionManager, QuestionService, API routes)
  - 01-foundation-03 (FastAPI main entry point, Docker Compose)
  - 02-core-game-loop (GameSession/Round models consumed)
  - 04-admin-panel (Stats model for game count)
tech-stack:
  added:
    - fastapi 0.136.x
    - uvicorn[standard] 0.48.x
    - sqlalchemy 2.0.x
    - aiosqlite 0.20.x
    - python-multipart 0.0.x
    - ruff 0.x
  patterns:
    - Async SQLAlchemy 2.0 with DeclarativeBase
    - Pydantic v2 Field validation with ge/le/min_length constraints
    - FastAPI dependency injection for async session management
    - Flat Python module layout (no nested src directory)
key-files:
  created:
    - backend/database.py — Async get_db FastAPI dependency
    - backend/models.py — Question, GameSession, Round, Stat ORM models
    - backend/schemas.py — QuestionCreate, QuestionResponse Pydantic models
    - backend/requirements.txt — Python dependency manifest
  modified: []
key-decisions:
  - "Flat Python module layout per D-02: backend/ with no nested src/ directory"
  - "All 4 tables created upfront in Phase 1 per D-04: questions, game_sessions, rounds, stats"
  - "Stat table with game_count counter per D-06 (not derived from COUNT query)"
  - "Category field is nullable VARCHAR per D-07, matching CSV import format text,answer[,category]"
  - "expire_on_commit=False on async_sessionmaker to prevent MissingGreenlet errors"
patterns-established:
  - "Async SQLAlchemy 2.0 select() style with DeclarativeBase"
  - "Pydantic v2 Field validation for REST API inputs"
  - "get_db FastAPI dependency with yield/finally cleanup"
requirements-completed: ["DEPLOY-02"]
duration: 1min
completed: 2026-05-29
---

# Phase 1 Plan 1: Backend Core Infrastructure Summary

**Async SQLAlchemy 2.0 ORM models (Question, GameSession, Round, Stat), Pydantic v2 validation schemas, get_db async dependency, and Python dependency manifest for the Number Duel backend**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-29T12:09:37Z
- **Completed:** 2026-05-29T12:10:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created backend directory structure with flat module layout (backend/, backend/routers/, backend/services/)
- Set up .gitignore with Python, Node, and build artifact patterns
- Installed all Python dependencies (fastapi, uvicorn, sqlalchemy, aiosqlite, python-multipart, ruff)
- Created 4 SQLAlchemy ORM models: Question (id, text, answer, category, created_at), GameSession (player1/player2 nicknames, scores, timestamps), Round (game_session_id, question_id, answers, winner), Stat (game_count)
- Created Pydantic v2 schemas: QuestionCreate with answer constrained to 0-1,000,000 and text min 1 char, QuestionResponse with from_attributes=True
- Created get_db async generator dependency yielding AsyncSession from request.app.state.session_factory

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backend project structure, dependencies, and gitignore** - `cba972d` (chore)
2. **Task 2: Create database layer -- ORM models, Pydantic schemas, and get_db dependency** - `1f12367` (feat)

## Files Created/Modified

### Created

- `.gitignore` - Python, Node, and build artifact ignore patterns
- `backend/__init__.py` - Empty package init
- `backend/routers/__init__.py` - Empty package init for routers module
- `backend/services/__init__.py` - Empty package init for services module
- `backend/requirements.txt` - Python dependency manifest (fastapi, uvicorn, sqlalchemy, aiosqlite, python-multipart, ruff)
- `backend/database.py` - get_db FastAPI async dependency for session injection
- `backend/models.py` - SQLAlchemy ORM models: Question, GameSession, Round, Stat
- `backend/schemas.py` - Pydantic v2 validation schemas: QuestionCreate, QuestionResponse

### Modified

None

## Decisions Made

- **Flat module layout (D-02):** Placed modules directly in `backend/` (not `backend/src/`) per the locked decision in CONTEXT.md
- **DeclarativeBase over old Base:** Used SQLAlchemy 2.0 `DeclarativeBase` (not the old `declarative_base()` function) for forward compatibility
- **Pydantic v2 Field metadata:** Constraints (ge, le, min_length) stored in Pydantic v2 `Field` metadata rather than direct attribute access
- **Expire on commit False:** The async_sessionmaker will be created with `expire_on_commit=False` in Plan 01-03 lifespan handler to prevent MissingGreenlet errors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Pydantic v2 FieldInfo API difference:** The plan's verification script used `QuestionCreate.model_fields['answer'].ge` which is Pydantic v1 API. Pydantic v2 stores constraints in `field.metadata` list. The constraints ARE correctly applied via `Field(..., ge=0, le=1_000_000)` -- only the test expression needed updating. Fixed in verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend data layer is complete: all 4 ORM models, validation schemas, and get_db dependency are ready
- Plan 01-02 can proceed: ConnectionManager singleton, QuestionService CRUD, and question REST API routes
- Plan 01-03 can proceed: FastAPI main.py with lifespan handler, WebSocket /ws endpoint, StaticFiles mount, Docker Compose

## Self-Check: PASSED

All 8 files verified on disk. Both commits (`cba972d`, `1f12367`) confirmed in git history. No missing artifacts.

---
*Phase: 01-foundation*
*Completed: 2026-05-29*
