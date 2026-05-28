<!-- GSD:project-start source:PROJECT.md -->
## Project

**Дуэль чисел (Number Duel)**

A local 1v1 numeric quiz game for the Wildberries booth at Saint Highload 2026. Two players sit opposite each other with their own screens, answer 9 rounds of numeric questions against a 10-second timer, and compete to be closest to the correct answer. A booth staff member controls the game flow via an admin panel on their phone. Works fully offline over local WiFi, deployed via Docker Compose from a single laptop.

**Core Value:** Two conference attendees walk up, enter nicknames, and are playing within seconds — a smooth, impressive booth experience that draws a crowd with sound effects, timer tension, and instant results.

### Constraints

- **Stack**: FastAPI (Python), React with Vite, WebSocket, SQLite
- **Deployment**: Docker Compose — single command startup on the booth laptop
- **Network**: Fully offline, local WiFi only — no internet-dependent resources
- **Assets**: All fonts, sounds, icons bundled locally — no external CDN
- **Devices**: Server runs on a laptop; players use laptops/tablets (landscape, 1024px+ width); admin uses a phone (portrait, 375px+ width)
- **Language**: UI in Russian (target audience is Russian-speaking conference attendees)
- **Players**: Exactly 2 players + 1 admin per game session
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Python** | 3.13.13 | Backend runtime | Latest stable branch with broad library support. Python 3.14.5 is available but has a thinner Docker image ecosystem and risks library incompatibility for `aiosqlite`/`python-multipart`. 3.13.13 has full Docker `python:3.13-slim` support and is proven with all required dependencies. |
| **FastAPI** | 0.136.x | HTTP + WebSocket server | Native WebSocket support (via Starlette), async-first, automatic OpenAPI docs, dependency injection. The standard Python choice for real-time web apps in 2026. No SSE needed here since we require bidirectional communication (player submits answer, server broadcasts timer ticks). |
| **Uvicorn** | 0.48.x | ASGI server | Runs FastAPI natively. `uvicorn[standard]` includes `uvloop` (2-4x async speedup) and `httptools` for faster HTTP parsing. For Docker with a single server process, bare uvicorn is correct -- no need for Gunicorn as process manager in this single-container deployment. |
| **React** | 19.x | Frontend UI library | Current stable with React Compiler (auto-memoization eliminates manual `useMemo`/`useCallback`), Actions for form handling, and `use()` API. No SSR needed since this is a fully offline SPA -- plain React is the right choice, not Next.js. |
| **Vite** | 6.x | Frontend build tool | Official React recommendation since CRA was deprecated. Fast HMR, tree-shaking, native ESM. Replaces Webpack entirely for this use case. |
| **TypeScript** | 5.x | Type safety | Catches WebSocket message shape mismatches at compile time -- critical when server and client must agree on event payloads. Define shared types for `join`, `timer_tick`, `round_result`, `game_end` events. |
| **SQLite** | 3.x (system) | Database | Zero-config, no separate DB process, file-based. Perfect for a conference booth game with a single laptop server. Data is ephemeral enough that SQLite's write-concurrency limits do not matter (one game at a time, infrequent writes). |
| **aiosqlite** | 0.20.x | Async SQLite driver | Required by SQLAlchemy 2.0 async mode. Provides `sqlite+aiosqlite:///` connection string for async engine. Without this, SQLAlchemy defaults to synchronous `sqlite:///` which blocks the async event loop. |
| **SQLAlchemy** | 2.0.x | Async ORM | Mature async support in 2.0. Use `create_async_engine`, `async_sessionmaker`, `select()` style (not the deprecated 1.x `session.query()`). Critical: set `expire_on_commit=False` to avoid `MissingGreenlet` errors. |
| **Tailwind CSS** | 4.3.x | Utility-first CSS | CSS-first configuration (`@theme` directives instead of `tailwind.config.js`). Zero runtime, tiny production CSS via purging. v4.3 adds scrollbar utilities. Avoids CSS module fragmentation for a small project. |
| **Motion** | 12.40.x | Animation library | Formerly Framer Motion. Spun off as independent `motion` package in 2026. Import from `"motion/react"`. Handles the timer circle animation, round result overlays, fade transitions between game states. Much lighter than GSAP for declarative React animations. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Howler.js** | 2.2.4 | Audio playback | Preload all 4 sound files (`tick.mp3`, `tick_fast.mp3`, `end_round.mp3`, `winner.mp3`) on app mount. Handles Web Audio API with HTML5 Audio fallback. Avoids iOS autoplay restrictions (requires user gesture to initialize AudioContext -- use the "Join" button click). Caches files automatically for offline replay. No v3 exists as of 2026; v2.2.4 remains stable and sufficient. |
| **Zustand** | 5.x | Client state management | Simpler than Redux, selector-based re-rendering avoids Context cascading. Stores WebSocket connection state, game phase, scores, timer. Accessible outside React tree (important for the WebSocket message handler to update state without component wrappers). |
| **React Router** | 7.x | Client-side routing | Minimal routing: `/` for player join, `/admin` for admin panel. v7 has simplified API. Do NOT use next/router -- this is not a Next.js app. If preferred, a simple state-based router (render component based on `gamePhase`) may suffice since there are only 2 routes. |
| **python-multipart** | 0.0.x | File upload parsing | Required by FastAPI for `UploadFile` in CSV import endpoint. Without this, file uploads silently fail with a 422 error. Standard library `csv` module handles the actual parsing. |
| **Alembic** | 1.14.x | Database migrations | Optional for this project size. If used, configure `alembic/env.py` for async SQLAlchemy with `async_engine_from_config` and `run_sync` wrappers. For the initial schema (tables: `questions`, `game_sessions`, `rounds`), SQLAlchemy `Base.metadata.create_all()` in the lifespan handler is simpler and sufficient. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **Docker Compose** | Single-command deployment | The booth laptop runs `docker compose up --build`. Single `compose.yml` with one service (the app) serving both API and built frontend static files. No nginx sidecar needed -- FastAPI `StaticFiles` mount handles it, but API routes MUST be defined before the static catch-all. |
| **Ruff** | Python linter + formatter | Replaces Flake8, isort, Black in one tool. 10-100x faster. Installed via `pip install ruff`. Runs as pre-commit hook. |
| **ESLint** (flat config) | JS/TS linter | Use the new flat config format (`eslint.config.js`). Pair with `@eslint/react` plugin for React 19 rules. |
| **Prettier** | JS/TS formatter | Consistent formatting. Integrates with ESLint via `eslint-config-prettier`. |
| **Vitest** | Frontend testing | Vite-native test runner, compatible with React Testing Library. Not critical for MVP but worth adding for WebSocket protocol logic. |
## Installation
### Backend (Python)
# Requirements file (requirements.txt)
# Optional: migrations
# Dev
### Frontend (npm)
# Create project with Vite + React + TypeScript
# Core dependencies
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Motion (framer-motion)** | GSAP | GSAP if you need complex timeline-based animations (multi-step sequences). Motion is sufficient for fade/slide/circle-timer animations and integrates better with React's declarative model. |
| **Zustand** | Redux Toolkit | Redux if you had a large team, needed time-travel debugging, or had complex middleware chains. For a 2-person project with ~5 state slices, Zustand is strictly better: less boilerplate, selector-based re-renders, no Provider wrapper. |
| **Zustand** | React Context | Context if state changes rarely (theme, locale). Context causes cascading re-renders when game state updates 10+ times per second (timer ticks). Zustand's selectors prevent this. |
| **React Router** | State-based routing | State-based routing (render component based on `phase` in Zustand store) if you truly only have 2 routes. React Router adds ~5KB but gives proper URL handling and back/forward support. Since admin and player are different URLs opening on different devices, React Router is worth it. |
| **Tailwind CSS v4** | CSS Modules | CSS Modules if you prefer collocated styles and don't mind managing a separate `*.module.css` per component. Tailwind eliminates context-switching between files and produces smaller bundles via purging. |
| **Howler.js** | Native Web Audio API | Native API if you need zero dependencies and are comfortable handling cross-browser AudioContext quirks (iOS autoplay, suspend/resume, format support). Howler.js wraps all of this in 7KB gzipped. |
| **Uvicorn alone** | Gunicorn + Uvicorn workers | Gunicorn when running on multi-CPU production servers. For a single-container Docker deployment with one CPU core available, bare `uvicorn --workers 1` is simpler and correct. Gunicorn's worker management adds complexity for zero benefit here. |
| **SQLite + aiosqlite** | PostgreSQL + asyncpg | PostgreSQL if the app needed concurrent write access, cloud deployment, or >1GB datasets. For a conference booth app with a single game at a time, SQLite is the right choice -- zero-config, no separate container, file-based persistence. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Create React App (CRA)** | Unmaintained since 2023, no React 19 support, slow builds. | Vite |
| **Next.js** | Adds SSR, file-based routing, server components -- none of which matter for a fully offline SPA. Heavier Docker image, more complex build. | Plain React + Vite |
| **Redux** | Overkill for ~5 state slices (game phase, scores, timer, players, questions). 10KB+ bundle for what Zustand does in 1KB. | Zustand |
| **Socket.IO** | Requires server-side library (`python-socketio`) and client-side library. Adds protocol overhead, tunneling, and fallback transport negotiation. FastAPI has native WebSocket support -- use it directly. | FastAPI native WebSocket |
| **Redis** | Needed only for horizontal scaling across multiple server instances. This is a single-server local WiFi deployment. Zero shared-state coordination needed. Don't add infrastructure you won't use. | In-memory state + SQLite |
| **Nginx sidecar** | Adds a second Docker container and port mapping complexity. FastAPI can serve static files directly via `StaticFiles`. Only add nginx if you need SSL termination or advanced caching. | FastAPI StaticFiles mount |
| **PostgreSQL** | Requires a separate Docker container, volume management, user/password setup, initialization scripts. All for a booth demo that runs 3 days. | SQLite |
| **CSS Modules / Styled Components** | Fragments styles across files. Tailwind's utility approach is faster to iterate on and produces smaller bundles. | Tailwind CSS v4 |
| **GSAP** | Paid licensing for commercial use on some tiers. Heavy (25KB+) for what Motion does in ~10KB. | Motion (formerly Framer Motion) |
| **framer-motion (npm package)** | Renamed to `motion` in 2026. The `framer-motion` package still exists on npm but the `motion` package is the canonical home. New imports: `from "motion/react"`. | motion |
| **Webpack** | Slow dev server, complex config, HMR takes seconds vs Vite's milliseconds. Vite is the standard for new React projects. | Vite |
## Stack Patterns by Variant
- Use PostgreSQL + asyncpg instead of SQLite + aiosqlite
- Add Redis for pub/sub across WebSocket server instances
- Replace single-container Docker with separate frontend (Nginx/CDN) and backend (horizontal auto-scale) containers
- Add Gunicorn with multiple Uvicorn workers
- Replace Zustand with Redux Toolkit for stricter state management across a larger team
- Bundle sounds via Vite asset import instead of preloading via Howler (same code, but served from CDN cache)
- Use Google Fonts via CSS `@import` instead of bundling font files
- Add Sentry for error tracking and PostHog for analytics
- Wrap the React app in a WebView via Capacitor or React Native
- The WebSocket and API layer remains identical
- Howler.js still works in WebView
- This is explicitly out of scope per PROJECT.md
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Python 3.13.13 | FastAPI 0.136.x | Full support. 3.14 would also work but has fewer tested Docker images. |
| FastAPI 0.136.x | Starlette 0.46.x (bundled) | WebSocket support comes from Starlette. |
| SQLAlchemy 2.0.x | aiosqlite 0.20.x | Use `sqlite+aiosqlite:///` URL. Do NOT use `sqlite:///` (sync driver) in async context. |
| SQLAlchemy 2.0.x | Alembic 1.14.x | Requires `async_engine_from_config` in `env.py` and `run_sync` wrappers for async migrations. |
| `motion@12` | React 19 | Full React 19 test suite integration. Use `import { motion } from "motion/react"`. |
| `motion@12` | React 18 | Also works, but since React 19 is stable, target 19. |
| Tailwind CSS v4 | Vite | Requires `@tailwindcss/vite` plugin in `vite.config.ts`. v4 uses CSS-first config (no `tailwind.config.js`). |
| Howler.js 2.2.4 | React 19 | No React-specific integration needed. Basic imperative API: `const sound = new Howl({ src: [...] })`. |
| React Router v7 | React 19 | v7 simplified to a single package. Use `createBrowserRouter` or the component API. |
## WebSocket Protocol Specifics
# Server pattern: ConnectionManager (singleton class)
# 
# Key design decisions:
# 1. Single /ws endpoint for all roles (player + admin)
# 2. First message (json) declares role: "player" | "admin"
# 3. Server tracks connections in-memory during game session
# 4. Session state (nickname, score, round) in GameSession object
# 5. SQLite persisted for questions and game counts only
#
# Event message format (both directions):
# {"event": "event_name", "data": {...}}
### Client-side WebSocket strategy (Zustand integration):
## Dockerfile Pattern (Multi-stage)
# Stage 1: Build React frontend
# Stage 2: Python backend
# Copy built frontend
# Non-root user
# docker-compose.yml
## Sources
- FastAPI releases: https://newreleases.io/project/pypi/fastapi/release/0.134.0 (verified 0.136.x current as of May 2026)
- FastAPI WebSocket guide: https://websocket.org/guides/frameworks/fastapi/ (confirmed native WS via Starlette)
- Python 3.13.13 release: https://www.python.org/downloads/release/python-31313/ (April 2026)
- Python version status: https://devguide.python.org/versions/ (3.13 bugfix active through Oct 2026)
- Uvicorn 0.48.0 release: PyPI (May 2026)
- React 19 + Vite setup guide: https://dev.to/parsajiravand/react-in-2026-start-from-scratch-the-right-way-cheat-sheet-2j9f (HIGH confidence, verified with current Vite docs)
- Howler.js v2.2.4: https://github.com/goldfire/howler.js (stable, no v3 as of 2026)
- Zustand vs Context vs Redux 2026: https://dev.to/imran_khan_a3cc224344dbcf/react-state-management-context-vs-zustand-vs-redux-2026-23lc (HIGH confidence, consistent with ecosystem trends)
- Fullstackopen Part 6 (2026 update replacing Redux with Zustand): https://fullstackopen.com/en/part6
- Tailwind CSS v4.3 release: https://tailwindcss.com/blog/tailwindcss-v4-3 (May 2026, HIGH confidence -- official blog)
- Tailwind CSS v4.2 release: https://www.infoq.com/news/2026/04/tailwind-css-4-2-webpack/ (MEDIUM confidence via InfoQ)
- Motion (framer-motion) v12.40.0: https://www.npmjs.com/package/framer-motion (verified v12.40.0, confirmed `motion` rename)
- SQLAlchemy 2.0 async with aiosqlite: https://dev.to/ayush_kaushik_b450595c233/fastapi-sqlalchemy-20-in-production-building-high-performance-async-apis-11ni (MEDIUM confidence, matches SQLAlchemy official docs)
- Docker multi-stage build pattern for FastAPI + Vite: https://github.com/fader111/vite_fastapi_simple_app (MEDIUM confidence, verified pattern)
- Gunicorn 26.0.0 release: https://github.com/benoitc/gunicorn/releases/tag/26.0.0 (confirmed eventlet removal, ASGI worker)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
