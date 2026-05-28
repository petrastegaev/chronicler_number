# Phase 1: Foundation - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

## Phase Boundary

The server boots, serves the React frontend via FastAPI StaticFiles, connects to SQLite with WAL mode, accepts WebSocket connections with full role-based connection management, and runs in Docker Compose with a single `docker compose up` command.

**Requirements:** DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04

## Implementation Decisions

### Project Structure
- **D-01:** `backend/` + `frontend/` directories at repo root — clean separation, each with its own package manager
- **D-02:** Flat Python module layout inside `backend/`: `main.py`, `models.py`, `routers/`, `services/` — no nested `src/` package directory
- **D-03:** Frontend uses Vite + React + TypeScript with React Router for `/` and `/admin` routes, Tailwind CSS v4

### Database Schema
- **D-04:** All 4 tables created upfront in Phase 1: `questions`, `game_sessions`, `rounds`, `stats` — schema-first, no incremental migration
- **D-05:** `Base.metadata.create_all()` in lifespan handler — no Alembic for this project
- **D-06:** Separate `stats` table with `game_count` counter (not derived from `game_sessions` COUNT)
- **D-07:** Questions `category` field is free-text VARCHAR, nullable — matches CSV import format `text,answer[,category]`

### WebSocket Infrastructure
- **D-08:** Full ConnectionManager singleton — connect/disconnect lifecycle, role-based tracking (player1, player2, admin), targeted send methods (`send_to_player()`, `send_to_admin()`, `broadcast()`), `asyncio.gather()` for parallel multi-client sends
- **D-09:** Strict 2+1 connection enforcement — reject 3rd player and 2nd admin connections with appropriate error events
- **D-10:** First WebSocket message parses `{"event": "join", "data": {"role": "player"|"admin", "nickname": "..."}}` — role assignment in connection order

### Frontend Scaffolding
- **D-11:** Full Vite + React + TypeScript project scaffold in Phase 1 — not just a placeholder
- **D-12:** Tailwind CSS v4 configured, React Router with `/` and `/admin` routes, minimal placeholder content
- **D-13:** Frontend dependencies (react, react-dom, react-router-dom, zustand, motion, howler) installed now so the Docker build stage works end-to-end

### Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Design & Requirements
- `gdd.md` — Full game mechanics, round structure, WebSocket protocol spec, REST API design, DB schema overview, sound effect mappings
- `web_design.md` — Visual style, color scheme (dark purple theme, blue/orange player colors), typography sizes, responsive breakpoints, animation specs, Figma mockup list

### Stack & Architecture
- `.planning/research/STACK.md` — Complete technology stack with versions, installation commands, alternatives considered, WebSocket protocol pattern, Dockerfile multi-stage pattern
- `.planning/research/SUMMARY.md` — Executive summary, feature priorities, architecture approach with 6 major components, 12 critical pitfalls with mitigations, phase ordering rationale
- `CLAUDE.md` — Project-wide conventions, stack decisions, what NOT to use, version compatibility matrix

### Project Planning
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria (5 items), dependency graph, coverage map
- `.planning/REQUIREMENTS.md` — DEPLOY-01 through DEPLOY-04 full text, traceability table
- `.planning/PROJECT.md` — Core value, constraints (offline, local WiFi, Russian UI, device specs), key decisions

## Existing Code Insights

### Reusable Assets
- None — this is the first phase. The project is greenfield.

### Established Patterns
- **Server-authoritative architecture** — all game logic runs on the server; client is a thin display+input terminal. Phase 1 establishes the communication backbone for this.
- **Single /ws endpoint for all roles** — player and admin connect to the same WebSocket endpoint, differentiated by the first JSON message's `role` field.
- **REST for CRUD, WebSocket for game events** — question management uses REST API; real-time game events use WebSocket. Phase 1 builds the REST API and the WebSocket skeleton.

### Integration Points
- FastAPI `lifespan` context manager — database engine creation, `create_all()`, and ConnectionManager initialization happen here
- API routes (`/api/questions`) must be defined BEFORE the StaticFiles mount to avoid route shadowing
- Docker multi-stage build copies `frontend/dist/` into `backend/static/` — the Vite build output directory must match

## Specific Ideas

No external references or "make it like X" examples were mentioned during discussion. Phase 1 follows the standard FastAPI + SQLAlchemy async patterns documented in the research files.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-28*
