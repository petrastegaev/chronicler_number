# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 01-foundation
**Areas discussed:** Project structure, Schema scope boundary, ConnectionManager depth, Frontend scaffolding

---

## Project Structure

| Option | Description | Selected |
|--------|-------------|----------|
| backend/ + frontend/ at root | Two top-level dirs, Dockerfile pattern matches CLAUDE.md, clean separation | ✓ |
| Single Python package with nested frontend/ | Python project at root, frontend/ nested inside | |
| Monorepo tools | npm workspaces for cross-package scripts — overkill for 2 packages | |

| Option | Description | Selected |
|--------|-------------|----------|
| Flat: main.py + modules | backend/main.py, models.py, routers/, services/ — simple FastAPI pattern | ✓ |
| Package: src/number_game/ | Formal package structure with pyproject.toml — nesting for no benefit | |

**Notes:** User selected the recommended option for both sub-decisions. Clean separation pattern matches the Dockerfile already spec'd in CLAUDE.md.

---

## Schema Scope Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Questions table only | Only what Phase 1 needs, incremental schema per phase | |
| All 4 tables upfront | questions, game_sessions, rounds, stats — schema is complete from day one | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Separate stats table | Dedicated table with game_count counter — simple, explicit | ✓ |
| Derive from game_sessions | COUNT(*) from game_sessions — leaner but requires aggregate query | |

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text, nullable | category VARCHAR, matches CSV format text,answer[,category] | ✓ |
| Predefined enum | Fixed ENUM values — consistency but requires code changes to add categories | |

**Notes:** Schema-first approach chosen — all tables exist from Phase 1 even though only `questions` is actively used. `create_all()` sufficient, no Alembic needed.

---

## ConnectionManager Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — accept and echo | Accept WebSocket, echo back — proves connectivity only | |
| Skeleton with role parsing | Parse join message, store by role — protocol validation without game logic | |
| Full ConnectionManager | Complete singleton with lifecycle, targeted sends, asyncio.gather broadcasts | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Enforce 2+1 limit now | Reject 3rd player, 2nd admin — matches final behavior | ✓ |
| Track loosely, enforce later | Accept any connections, don't reject extras — easier for testing | |

**Notes:** Full ConnectionManager in Phase 1 means Phase 2 can focus purely on GameSession state machine and scoring logic. Enforcement of connection limits is production-ready from day one.

---

## Frontend Scaffolding

| Option | Description | Selected |
|--------|-------------|----------|
| Full Vite scaffold | Vite + React + TS + Tailwind + React Router — Docker build works end-to-end | ✓ |
| Placeholder HTML only | Hand-written index.html, no build step — minimal but Phase 3 has more work | |
| Defer entirely | No frontend, Python-only Dockerfile — clean but Docker pattern unvalidated | |

**Notes:** Full scaffold including all dependencies (react, react-dom, react-router-dom, zustand, motion, howler) installed now. Phase 3 starts with a working dev environment and the Docker multi-stage build is validated in Phase 1.

---

## Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
