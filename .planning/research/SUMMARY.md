# Project Research Summary

**Project:** Number Duel (Duel Chisel / Duel chisel)
**Domain:** Local 1v1 multiplayer numeric-quiz game for conference booth
**Researched:** 2026-05-28
**Confidence:** HIGH

## Executive Summary

Number Duel is a fully offline, local-LAN, two-player numeric quiz game designed for a conference booth. Two players face off answering numeric questions on separate tablets, scored by proximity to the correct answer (not binary right/wrong). A booth admin manages the game lifecycle from a phone. The entire system runs on a single laptop via Docker Compose with zero internet dependencies.

The research clearly recommends a server-authoritative architecture: FastAPI + Python 3.13 on the backend handling both REST (question management) and WebSocket (real-time game events), with a React 19 + Vite 6 + TypeScript frontend served as static files. State management uses Zustand 5 with the WebSocket client as a standalone module outside the React tree -- a pattern well-verified for real-time game clients. SQLite (WAL mode) with aiosqlite provides persistence without the overhead of PostgreSQL. Deployment is a single Docker container serving both API and built frontend, started with `docker compose up`.

The primary risks fall into three categories: (1) WebSocket lifecycle management -- zombie connections, task cancellation on disconnect, and serial broadcast delays require careful async patterns from day one; (2) Mobile and venue gotchas -- captive portal rejection on phones, AP isolation on hotspots, mobile keyboard quirks, and audio autoplay blocks can silently break the experience at the conference; (3) SQLite write contention under concurrent async access, preventable with WAL mode and in-memory game state with deferred persistence. All three categories have well-documented mitigations in the research.

## Key Findings

### Recommended Stack

The stack is conventional for a 2026 real-time web game with one key constraint: fully offline operation. Python 3.13 + FastAPI + Uvicorn on the backend, React 19 + Vite 6 + TypeScript on the frontend, SQLite for persistence. No Redis, no Nginx sidecar, no PostgreSQL, no Socket.IO. The simplicity is deliberate -- fewer containers mean fewer failure points at the conference.

**Core technologies:**
- **Python 3.13.13**: Backend runtime -- latest stable with full Docker `python:3.13-slim` support and proven library compatibility (Python 3.14 available but riskier)
- **FastAPI 0.136.x**: HTTP + WebSocket server -- native WebSocket support via Starlette, async-first, dependency injection. No SSE needed since bidirectional communication is required.
- **Uvicorn 0.48.x**: ASGI server -- `uvicorn[standard]` includes uvloop (2-4x async speedup). Single worker is correct for this single-container deployment.
- **React 19 + Vite 6 + TypeScript 5**: Frontend -- React Compiler auto-memoization eliminates manual optimizations. Vite is the standard React build tool. TypeScript catches WebSocket message shape mismatches between server and client.
- **SQLite + aiosqlite + SQLAlchemy 2.0**: Database -- zero-config, file-based, no separate process. Perfect for a single-laptop booth game. Requires WAL mode and async driver to avoid lock contention.
- **Zustand 5**: Client state management -- selector-based re-rendering avoids cascading updates. Accessible outside React tree, critical for WebSocket message handler integration.
- **Tailwind CSS v4**: Utility CSS -- CSS-first config (no `tailwind.config.js`), tiny production CSS via purging, scrollbar utilities in v4.3.
- **Motion 12**: Declarative animations -- timer circle animation, round result overlays, fade transitions. Lighter than GSAP for React animations.
- **Howler.js 2.2.4**: Audio playback -- handles Web Audio API with HTML5 Audio fallback, iOS autoplay restrictions, offline caching. No v3 exists as of 2026.

### Expected Features

The game has a tight feature set. The differentiation from Kahoot/Quizizz clones is the numeric proximity-scoring mechanic -- players guess a number, not A/B/C/D. Research identifies 11 P1 features for MVP, 4 P2 features for v1.x polish, and 5 P3 features to defer.

**Must have (table stakes):**
- **Nickname entry** -- player identity, server-unique, max 15 chars. No auth, no persistence.
- **9-round numeric gameplay** -- server-authoritative rounds, 10-second timer, numeric input. Both players see the same question simultaneously.
- **Proximity scoring** -- closest answer wins each round. Most round wins takes the game. Absolute difference displayed.
- **Server-authoritative timer** -- timer ticks broadcast via WebSocket. Answers after expiry discarded server-side.
- **Per-round result display** -- correct answer, both answers, winner highlight, 2-3 second overlay.
- **Final results screen** -- winner announcement, final score, player nicknames.
- **Admin game control** -- see player connection status, start game, view live scores, reset. Must be accessible on mobile phone viewport.
- **Question management** -- add single question, list all, delete. Needs Python-multipart for file uploads.
- **Full offline operation** -- all assets bundled in Docker image. No CDN, no external API calls, no analytics.
- **Docker Compose one-command deploy** -- booth staff runs `docker compose up`.

**Should have (v1.x polish):**
- **Sound effects** -- tick, fast tick (<=3s), round-end gong, victory fanfare. Creates game-show atmosphere that draws crowd attention.
- **Mobile-optimized admin panel** -- responsive layout, bottom tabs, touch-friendly controls (44x44pt minimum). Essential for booth staff workflow.
- **CSV question import** -- bulk question loading for conference staff. UTF-8 with BOM for Excel/Russian text compatibility.
- **Visual circular timer** -- animated SVG countdown with color transitions (blue to yellow to red). Adds drama.
- **Session-based reconnection** -- graceful recovery from flaky conference WiFi without losing game slot.

**Defer (v2+):**
- Persistent accounts / OAuth (anti-feature -- kills throughput)
- Tournament bracket mode (too complex for single-booth operation)
- Player-driven "Play Again" (anti-feature -- monopolizes booth)
- Online/remote play (contradicts offline requirement)
- Live leaderboard (creates pressure, privacy concerns)
- Multiple-choice questions (dilutes differentiator)
- Prize integration (booth staff handles manually)
- Hall of fame / top scores
- Configurable round count
- Question categories / difficulty

### Architecture Approach

The architecture uses server-authoritative state across a fixed 3-connection model (player1, player2, admin). All game logic runs on the server -- clients are "thin" display+input terminals. The WebSocket protocol uses a single `/ws` endpoint with JSON event envelopes (`{"event": "event_name", "data": {...}}`), dispatched to handlers by event type. REST and WebSocket traffic are strictly separated: question CRUD uses REST, game events use WebSocket.

**Major components:**
1. **FastAPI Application** -- REST router (`/api/questions`, `/api/stats`), WebSocket router (`/ws`), StaticFiles mount for frontend. Lifespan context manager manages background game tasks.
2. **ConnectionManager** -- Singleton tracking exactly 3 connections: player1, player2, admin. Methods: `send_to_player()`, `send_to_players()`, `send_to_admin()`, `broadcast()`. Must use `asyncio.gather()` for multi-client sends to prevent serial broadcast delay.
3. **GameSession** -- In-memory state machine with phases: waiting, playing, round_result, game_over. Owns the server-authoritative timer (asyncio.sleep-based ticks). Pre-loads 9 random questions at game start. Persists results to SQLite at game end only.
4. **QuestionService** -- CRUD wrapper around SQLite. Random question selection without replacement per game session. CSV parsing and validation.
5. **Player React App** -- Zustand GameStore + standalone WebSocket client module. Four screens: JoinScreen, GameScreen, RoundResult overlay, FinalScreen. State transitions driven entirely by server events.
6. **Admin React App** -- Zustand AdminStore + QuestionStore. WebSocket for game control, REST for question management. Mobile-first layout with bottom tab bar (Game, Questions, Stats).

### Critical Pitfalls

The research identifies 12 critical pitfalls across all phases. The top 5 that must be addressed during implementation:

1. **WebSocket zombie connections** -- FastAPI only detects disconnect on `receive()`, not `send()`. A send-only timer loop never detects dropped clients, accumulating dead connections. Fix: pair reader and writer tasks, cancel writer on reader disconnect; catch `send()` exceptions and clean up immediately.

2. **SQLite "database is locked"** -- Default journal mode blocks concurrent async writes. Fix: enable WAL mode (`PRAGMA journal_mode=WAL`), set `PRAGMA busy_timeout=5000`, use async SQLAlchemy with `create_async_engine`. Keep game state in memory; only persist at game end.

3. **Server timer tick drift** -- Sequential `await ws.send()` causes Player 2 to receive updates 50-500ms later than Player 1, accumulating disadvantage over 9 rounds. Fix: always broadcast with `asyncio.gather(return_exceptions=True)`. Consider "send end timestamp once, client calculates locally" approach for timer.

4. **Mobile keyboard disaster on answer input** -- `type="number"` shows spinner arrows, decimal key on iPad, ignores `autofocus` on iOS Safari. Fix: use `inputMode="numeric"` with `pattern="[0-9]*"`, strip non-digits on every keystroke, manually focus inside user gesture handler, position input high enough to avoid keyboard overlap.

5. **Captive portal / "No Internet" WiFi rejection** -- Android and iOS show persistent warnings or disconnect from the booth hotspot entirely because probe requests to `captive.apple.com` / `connectivitycheck.gstatic.com` fail. Fix: configure hotspot DNS to resolve probe domains to the server IP with expected HTTP 204 response; use a dedicated portable router (GL-iNet); test with real Android and iPhone at the venue before conference.

## Implications for Roadmap

Based on combined research, the project should be built in six phases. The ordering follows dependency chains from the architecture (backend must exist before frontend, game loop before player UI, audio requires working game loop) while deferring polish and venue-hardening to later phases.

### Phase 1: Foundation
**Rationale:** Everything depends on data storage and the WebSocket connection framework. This phase establishes the backbone before any game logic.
**Delivers:** SQLite schema with WAL mode, QuestionService with CRUD, REST API for questions, ConnectionManager with `asyncio.gather` broadcast and disconnect-safe patterns, Docker Compose scaffolding with multi-stage build.
**Addresses features:** Question pool seeding, Single question add, Question list/delete, Docker Compose scaffold.
**Avoids pitfalls:** SQLite "database is locked" (WAL mode from day one), WebSocket zombie connections (correct disconnect detection in ConnectionManager).
**Stack used:** Python 3.13, FastAPI, SQLite + aiosqlite + SQLAlchemy, Uvicorn.

### Phase 2: Core Game Loop
**Rationale:** The game loop (GameSession state machine, server-authoritative timer, proximity scoring, WebSocket handler dispatch, in-memory game state) is the heart of the product. Must exist before any player or admin UI can be built.
**Delivers:** GameSession state machine (waiting/playing/round_result/game_over), server-authoritative timer with `asyncio.gather` broadcasts, proximity scoring engine, WebSocket message dispatch hub, in-memory game state with deferred SQLite persistence at game end, `asyncio.shield()` for cleanup writes, lifespan management with task cancellation.
**Addresses features:** Round gameplay, Server-authoritative timer, Proximity scoring.
**Avoids pitfalls:** Server timer tick drift (end_timestamp approach or gathered broadcasts), Task cancellation kills DB writes (shield/queue persistence), Round restart race condition (session IDs + message sequence numbers).
**Architecture components:** GameSession, scoring logic, WebSocket handler, ConnectionManager integration.

### Phase 3: Player Frontend
**Rationale:** Once the game loop works via WebSocket, the player experience can be built and tested. The standalone WebSocket client module is the critical piece that connects React to the server.
**Delivers:** Zustand GameStore, standalone WebSocket client module (outside React tree), JoinScreen (nickname entry, waiting, player color assignment), GameScreen (question display, numeric input, server-driven timer display), RoundResult overlay (correct answer, both answers, winner highlight, 2-3s pause), FinalScreen (winner announcement, final score).
**Addresses features:** Nickname entry, Per-round result display, Final results screen, Player color identity (blue vs red), Visual feedback for answer submission.
**Avoids pitfalls:** Mobile keyboard disaster (`inputMode="numeric"`, manual focus, sanitization), React re-render on every WebSocket message (Zustand selectors).
**Stack used:** React 19, TypeScript, Zustand 5, Tailwind CSS v4, Motion 12.

### Phase 4: Admin Frontend
**Rationale:** The admin panel depends on both REST endpoints (Phase 1) and WebSocket game events (Phase 2). It is separate from the player app because it has different state, layout, and interaction patterns. Mobile-first design is critical.
**Delivers:** AdminStore + QuestionStore, GameControl tab (player status indicators, start/restart buttons, live score view, round counter), QuestionManagement tab (single add form, list with delete, CSV import with preview), GameStats tab (game count), mobile-first responsive layout (bottom tab bar, 44x44pt touch targets, no horizontal scroll), pull-to-refresh for game status.
**Addresses features:** Admin game lifecycle control, Admin sees player connection status, Admin quick reset, Admin question management, CSV question import, Mobile-optimized admin panel.
**Avoids pitfalls:** Admin panel fails to fit on phone (mobile-first design enforced), Multiple simultaneous admin panels (second panel shows status but disables game controls).

### Phase 5: Audio and Polish
**Rationale:** Audio is the polish layer that transforms the game from a functional web form into a game-show experience. It must be added after the core game loop is stable and tested on target hardware, because audio introduces its own failure modes (mobile autoplay, desync).
**Delivers:** Howler.js with 4 sound files (tick, tick_fast, end_round, winner), AudioContext unlock on player "Join" button click, audio preloading on first interaction, visual circular timer (SVG stroke-dashoffset with color transitions), synchronized audio-visual timing via `AudioContext.currentTime` and end_timestamp approach, SoundManager module outside React tree.
**Addresses features:** Sound effects, Visual circular timer.
**Avoids pitfalls:** Audio autoplay blocked on mobile (unlock on player click, test on real devices), Audio desync (drive both visual and audio from same remaining-time calculation using end_timestamp).

### Phase 6: Deployment Hardening
**Rationale:** The conference venue introduces failure modes that cannot be reproduced in development. This phase is the last line of defense -- network configuration, device testing, and operational readiness.
**Delivers:** Docker Compose final configuration with volume mount for SQLite persistence, hotspot configuration (DNS redirection for captive portal probes, AP isolation disabled), QR code signage for venue, screen wake lock integration for player tablets, "Looks Done But Isnt" checklist verification, on-device testing with real Android and iOS at the venue, fallback run scripts (direct uvicorn without Docker).
**Addresses features:** Full offline operation verification, Docker Compose one-command deploy.
**Avoids pitfalls:** Captive portal rejection (DNS probe configuration), AP isolation blocks traffic (hotspot config), Screen sleep during active game (Wake Lock API).

### Phase Ordering Rationale

- **Backend before frontend:** The game loop must work at the WebSocket level before any UI is built. Building the player UI first would require mocking the server, risking mismatches when connecting to real WebSocket events.
- **Player frontend before admin frontend:** The player experience is the product. The admin panel is a control surface. Player screens need more iteration on UX (timer readability, answer input, result clarity).
- **Audio after core game loop:** Sound effects enhance a working game. Implementing audio on top of an unstable game loop introduces confounding variables during debugging. The game should be fully playable and tested in silence before adding sound.
- **Deployment hardening last:** Venue-specific network issues (captive portal, AP isolation) cannot be solved in code alone. They require physical presence at the venue with target devices. Doing earlier phases well ensures that hardening is the only variable on conference day.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Core Game Loop):** Need to decide between "send end_timestamp once" vs "broadcast per-second timer ticks" for the timer approach. The end_timestamp approach solves both the timer drift and audio desync problems but requires client-side calculation. This decision affects both the WebSocket protocol and the audio timing architecture in Phase 5.
- **Phase 5 (Audio and Polish):** The specific tablet models used at the booth are unknown. Audio autoplay behavior varies significantly between browsers and OS versions. During planning, identify the target tablet models and test Howler.js audio unlock on those specific devices.
- **Phase 6 (Deployment Hardening):** The captive portal behavior at the specific venue is unknown. The hotspot hardware (laptop built-in vs dedicated router) has not been chosen. These decisions require venue information and hardware procurement that happens outside the codebase.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** SQLite + FastAPI CRUD is extremely well-documented. The pattern is the same as hundreds of tutorials. No research needed beyond what is already in the research files.
- **Phase 3 (Player Frontend):** React component composition with Zustand state management is a well-established pattern. The WebSocket client as a standalone module is the only non-trivial piece, and it is well-documented in the architecture research.
- **Phase 4 (Admin Frontend):** Standard React CRUD UI with a REST API. Mobile-first responsive design is well-documented. No novel research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended technologies verified against official docs (Python 3.13.13 release, FastAPI 0.136, React 19, Tailwind v4.3, Zustand 5). Version compatibilities confirmed. The single-container Docker pattern is validated by existing open-source examples. |
| Features | HIGH | Competitor analysis against Kahoot and Quizizz with multiple sources. Conference booth best practices from 6 industry sources. Patent analysis for numeric "closest wins" mechanic. Feature prioritization validated against the project GDD and design spec. |
| Architecture | HIGH | Server-authoritative gaming architecture is a well-documented pattern. WebSocket + Zustand integration verified from production game client examples. Build order derived directly from component dependency chains. Zero-external-dependency design verified against the offline requirement. |
| Pitfalls | HIGH | 12 pitfalls sourced from FastAPI GitHub issues (#3008, #11008, #11244), MDN documentation, SQLite WAL docs, conference demo failure postmortems, and mobile browser compatibility research. Each pitfall has a clear prevention strategy and phase assignment. |

**Overall confidence:** HIGH

### Gaps to Address

- **Legal: Numeric game patent (US7654533):** The FEATURES research flags that the "closest wins" numeric scoring mechanic may be covered by a game method patent. The research notes this likely does not apply to this non-commercial conference use case, but legal validation is advised before public deployment.
- **Target device unknown:** The specific tablet models for players and phone model for the admin have not been chosen. Audio autoplay behavior, keyboard behavior (inputMode support), screen sizes, and WiFi chipset behavior all vary by device. Recommend choosing target devices during Phase 5 planning and testing all features on those specific models.
- **Venue WiFi environment unknown:** The conference venue may have unique interference patterns, DNS configurations, or network policies that affect the hotspot. The captive portal mitigation (DNS probe redirection) must be tested at the actual venue. Recommend a venue visit during Phase 6 with the actual hotspot hardware and all target devices.
- **Timer approach decision not resolved:** The research presents two valid approaches for the countdown timer -- per-second server ticks vs. end-timestamp with client-side calculation. The end-timestamp approach solves more problems (drift, audio desync) but the per-second approach is simpler to implement. This decision must be made during Phase 2 planning.

## Sources

### Primary (HIGH confidence)
- Python 3.13.13 release notes and version status (python.org)
- FastAPI WebSocket documentation (fastapi.tiangolo.com)
- React 19 + Vite setup guide (vite.dev, react.dev)
- Tailwind CSS v4.3 release blog (tailwindcss.com)
- Zustand documentation (github.com/pmndrs/zustand)
- Motion v12 npm registry (npmjs.com)
- Howler.js v2.2.4 stable release (github.com/goldfire/howler)
- SQLite WAL mode documentation (sqlite.org/wal.html)
- FastAPI issues #3008, #11008, #11244 -- WebSocket disconnect detection (github.com/fastapi)
- Game Design Document (gdd.md) and Web Design specification (web_design.md) in project root

### Secondary (MEDIUM confidence)
- Conference booth game best practices (Freeman, Classic Exhibits, Expo Centric -- industry sources)
- Numeric game method patents US20070246888A1 and US7654533B2 (patent documents)
- SQLAlchemy 2.0 async with aiosqlite patterns (dev.to tutorials, consistent with official docs)
- Docker multi-stage build pattern for FastAPI + Vite (github.com/fader111, verified pattern)
- WebSocket reconnection patterns (community sources, consistent methodology)
- Conference demo pitfalls and postmortems (medium.com, dev.to)

### Tertiary (LOW confidence)
- Captive portal detection behavior across Android versions (stackoverflow discussion, varies by vendor)
- Specific timing measurements for WebSocket latency on conference WiFi (venue-dependent, cannot be reproduced in dev)
- Target device audio behavior (device-dependent, needs testing on actual hardware)

---
*Research completed: 2026-05-28*
*Ready for roadmap: yes*
