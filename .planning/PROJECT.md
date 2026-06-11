# Дуэль чисел (Number Duel)

## What This Is

A local 1v1 numeric quiz game for the Wildberries booth at Saint Highload 2026. Two players sit opposite each other with their own screens, answer 9 rounds of numeric questions against a 10-second timer, and compete to be closest to the correct answer. A booth staff member controls the game flow via an admin panel on their phone. Works fully offline over local WiFi, deployed via Docker Compose from a single laptop.

## Core Value

Two conference attendees walk up, enter nicknames, and are playing within seconds — a smooth, impressive booth experience that draws a crowd with sound effects, timer tension, and instant results.

## Requirements

### Validated

(Validated in Phase 1: Foundation, 2026-05-29)

- [x] Foundation infrastructure: FastAPI app server, SQLite WAL database, 4 ORM models, WebSocket /ws endpoint, REST API at /api/questions, Docker multi-stage build, Docker Compose deployment

(Validated in Phase 2: Core Game Loop, 2026-05-31)

- [x] Two players connect from separate devices and set nicknames
- [x] 9 rounds with random numeric-answer questions and 10-second timer
- [x] Real-time scoring: closest answer wins the round, most round wins takes the game

(Validated in Phase 3: Player Frontend, 2026-06-06)

- [x] End-of-game results screen with winner announcement

(Validated in Phase 4: Admin Panel + Questions, 2026-06-10)

- [x] Admin can see connected players and launch the game when ready
- [x] Admin panel: game control tab (launch, restart, live score)
- [x] Admin panel: question management (add single, CSV import, list)
- [x] Admin panel: basic game count statistics

(Validated in Phase 5: Audio + Deployment Polish, 2026-06-11)

- [x] Sound effects: tick, fast tick (<3s), round-end gong, victory fanfare
- [x] Docker Compose one-command deployment
- [x] Fully offline — all assets local, no CDN dependencies

### Active

(All requirements validated — milestone v1.0 complete)

### Out of Scope

- Online/multi-location play — local LAN only
- OAuth or email-based login — nicknames only
- Persistent player profiles with win/loss history — basic game count stats only
- Tournament mode — single match at a time
- Mobile native apps — web browser only

## Context

**Conference booth constraints:**
- Quick player turnover: admin-driven reset flow keeps the line moving
- Unreliable internet: everything must work fully offline on a local WiFi hotspot
- Mixed devices: players on laptops/tablets, admin on a phone
- Visual and audio appeal: sounds and animations draw attention at a busy expo hall

**Prior work:**
- Game Design Document (`gdd.md`) — full mechanics, round structure, WebSocket protocol, API design
- Web Design Specification (`web_design.md`) — visual style, layouts, responsive breakpoints, animation specs
- Both documents are in the project root and represent the current, approved plan

## Constraints

- **Stack**: FastAPI (Python), React with Vite, WebSocket, SQLite
- **Deployment**: Docker Compose — single command startup on the booth laptop
- **Network**: Fully offline, local WiFi only — no internet-dependent resources
- **Assets**: All fonts, sounds, icons bundled locally — no external CDN
- **Devices**: Server runs on a laptop; players use laptops/tablets (landscape, 1024px+ width); admin uses a phone (portrait, 375px+ width)
- **Language**: UI in Russian (target audience is Russian-speaking conference attendees)
- **Players**: Exactly 2 players + 1 admin per game session

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SQLite over PostgreSQL | Conference booth needs zero-config setup; no separate DB process in Docker | Validated — SQLite WAL mode, aiosqlite driver, zero issues across 5 phases |
| Vite over Create React App | Modern standard, faster builds, better developer experience | Validated — Vite 6 + React 19, 473 modules, <2s build |
| Docker Compose deployment | Single-command startup for booth staff with no technical background | Validated — `docker compose up --build` verified, audio files embedded in image |
| Admin-driven reset flow | Booth staff controls pace to manage attendee queue | Validated — Admin panel with game control, question management, CSV import |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-11 after Phase 5 completion (milestone v1.0)*
