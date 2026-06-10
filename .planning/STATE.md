---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_plan: Not started
status: planning
last_updated: "2026-06-10T15:57:56.790Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 40
---

# STATE: Дуэль чисел (Number Duel)

**Current Phase:** 3
**Current Plan:** Not started
**Status:** Ready to plan
**Progress:** [████████            ] 40%

## Project Reference

**Core Value:** Two conference attendees walk up, enter nicknames, and are playing within seconds -- a smooth, impressive booth experience that draws a crowd with sound effects, timer tension, and instant results.

**Current Focus:** Phase 3 — player frontend

## Current Position

| Property | Value |
|----------|-------|
| Milestone | v1.0 -- Saint Highload 2026 Booth |
| Phase | 2 (Core Game Loop) |
| Plan | 2 (complete) |
| Status | Plan 02-02 complete. Ready for Phase 3. |
| Progress bar | [████████            ] 40% |

## Performance Metrics

| Metric | Baseline | Target | Current |
|--------|----------|--------|---------|
| Phase 1 plan duration | -- | -- | 3 min (Plan 01-02), 5 min (Plan 01-03) |
| Phase 2 plan 02-01 duration | -- | -- | ~5 min |
| Phase 2 plan 02-02 duration | -- | -- | ~5 min |

## Accumulated Context

### Decisions

- Granularity set to "coarse" -- 5 phases identified, each delivering a complete, verifiable capability
- Phase order follows dependency chain: Foundation -> Core Game Loop -> Player Frontend -> Admin Panel + Questions -> Audio + Deployment
- Backend phases precede frontend phases: game loop must work at WebSocket level before UI is built
- Audio deferred to last phase: sound enhances a working game but does not block core functionality
- Admin panel depends on player frontend being testable: admin needs real player connections to verify game controls
- DEPLOY-01 (Docker) scaffolded in Phase 1 but full end-to-end verification happens in Phase 5
- Flat Python module layout per D-02: backend/ with no nested src/ directory
- All 4 tables created upfront in Phase 1 per D-04: questions, game_sessions, rounds, stats
- Stat table with game_count counter per D-06 (not derived from COUNT query)
- Category field is nullable VARCHAR per D-07, matching CSV import format text,answer[,category]
- expire_on_commit=False on async_sessionmaker to prevent MissingGreenlet errors
- Frontend scaffold follows UI-SPEC.md exact file contents for placeholder pages and CSS
- Inter fonts bundled as self-hosted WOFF2 files under frontend/public/fonts/
- Docker multi-stage build verified: node:22-alpine frontend + python:3.13-slim backend
- Russian-language UI throughout per PROJECT.md constraint
- Route ordering: API routes and WebSocket registered before StaticFiles mount (mount at line 107, last configuration)
- ConnectionManager singleton with asyncio.gather broadcast for concurrent multi-client sends
- WebSocket disconnect detection via receive_json() loop (send-only cannot detect disconnects)
- Phase 2 locked decisions D-01 through D-17: timer design, state machine, event protocol, round flow timing (see 02-CONTEXT.md)
- GameSession is class-based singleton with asyncio.create_task() launch (D-07, D-09)
- Server-authoritative timer: asyncio.sleep(1) loop, 1 tick/second for 10 seconds (D-01, D-05)
- First-answer-wins answer collection; answers NEVER broadcast mid-round (D-12, GAME-04)
- asyncio.shield() for game-end SQLite persistence to survive task cancellation

### Decisions Added in Plan 02-02

- admin start_game event embeds QuestionService.random_selection() inline inside the WebSocket handler, creating GameSession via asyncio.create_task() after sufficient questions verified
- Reconnect path sends state_snapshot with current state, round number, remaining time, and question text (not full scores/answers) per D-06
- game_task lifecycle check prevents double-session race: second start_game is silently ignored if game_task exists and is not done
- admin disconnect cancels game_task and clears active_session to prevent orphan game loops

### Open Questions

- Target tablet/phone models for audio and keyboard testing (noted as Research Flag -- decision deferred to Phase 5 planning)
- Hotspot hardware and captive portal mitigation approach (noted as Research Flag -- decision deferred to Phase 5 planning)

### Todo

- [x] Plan 01-01: Backend Core Infrastructure (database.py, models.py, schemas.py, dependencies)
- [x] Plan 01-02: Frontend Scaffold + Docker multi-stage build
- [x] Plan 01-03: ConnectionManager + Questions REST API + main.py entry point
- [x] Plan 02-01: Core Game Engine -- GameSession state machine, timer, scoring, persistence; session token store (commit 54a10f6, efbe12d)
- [x] Plan 02-02: WebSocket Integration + Contracts -- main.py event dispatch, GameSession lifecycle; frontend TS types and Zustand store (commits 492fe86, 73ee597, 9d0814a)
- [ ] Next after Phase 2: Phase 3 -- Player Frontend

### Blockers

- None currently

## Session Continuity

**Last session:** 2026-06-10T15:57:56.786Z
**This session:** 2026-06-10 -- Plan 02-02 execution complete
**Next session:** Phase 3 -- Player Frontend

### Files Created/Updated

- `backend/game/__init__.py` -- Created (empty package init)
- `backend/game/session.py` -- Created (215 lines, GameSession class)
- `backend/game/tokens.py` -- Created (21 lines, session token store)
- `backend/main.py` -- Modified (226 lines, game event dispatch, reconnect, tokens)
- `frontend/src/types/ws.ts` -- Modified (126 lines, 11 game event interfaces)
- `frontend/src/stores/gameStore.ts` -- Modified (68 lines, Zustand store with game state)
- `.planning/phases/02-core-game-loop/02-01-SUMMARY.md` -- Created
- `.planning/phases/02-core-game-loop/02-02-SUMMARY.md` -- Created
- `.planning/STATE.md` -- Updated for Plan 02-02 completion
