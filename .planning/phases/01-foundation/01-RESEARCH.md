# Phase 1: Foundation - Research

**Researched:** 2026-05-28
**Domain:** FastAPI backend scaffold, SQLite async setup, WebSocket infrastructure, React+Vite frontend scaffold, Docker Compose multi-stage build
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire project foundation for a fully offline conference booth game. It covers four major work streams: (1) FastAPI backend scaffold with async SQLAlchemy 2.0 + aiosqlite for SQLite with WAL mode, (2) Full ConnectionManager singleton WebSocket infrastructure with role-based tracking and `asyncio.gather()` broadcast, (3) Complete React 19 + Vite 6 + TypeScript frontend scaffold with Tailwind CSS v4, React Router v7, and all dependencies installed, and (4) Docker Compose multi-stage build that serves both API and frontend static files from a single container.

The architecture uses server-authoritative design from day one -- the WebSocket ConnectionManager enforces a strict 2-player + 1-admin connection model, and the database schema creates all 4 tables (`questions`, `game_sessions`, `rounds`, `stats`) upfront with `Base.metadata.create_all()` in the lifespan handler. The frontend is a full scaffold (not a placeholder) so the Docker multi-stage build is validated end-to-end in Phase 1 and Phase 3 can start development immediately.

**Primary recommendation:** Build in 3 plans -- Plan 1A (Backend core: FastAPI app, lifespan handler, SQLAlchemy async engine with WAL, models), Plan 1B (WebSocket ConnectionManager singleton + questions REST API), Plan 1C (Frontend scaffold + Docker multi-stage build).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** `backend/` + `frontend/` directories at repo root -- clean separation, each with its own package manager
**D-02:** Flat Python module layout inside `backend/`: `main.py`, `models.py`, `routers/`, `services/` -- no nested `src/` package directory
**D-03:** Frontend uses Vite + React + TypeScript with React Router for `/` and `/admin` routes, Tailwind CSS v4
**D-04:** All 4 tables created upfront in Phase 1: `questions`, `game_sessions`, `rounds`, `stats` -- schema-first, no incremental migration
**D-05:** `Base.metadata.create_all()` in lifespan handler -- no Alembic for this project
**D-06:** Separate `stats` table with `game_count` counter (not derived from `game_sessions` COUNT)
**D-07:** Questions `category` field is free-text VARCHAR, nullable -- matches CSV import format `text,answer[,category]`
**D-08:** Full ConnectionManager singleton -- connect/disconnect lifecycle, role-based tracking (player1, player2, admin), targeted send methods (`send_to_player()`, `send_to_admin()`, `broadcast()`), `asyncio.gather()` for parallel multi-client sends
**D-09:** Strict 2+1 connection enforcement -- reject 3rd player and 2nd admin connections with appropriate error events
**D-10:** First WebSocket message parses `{"event": "join", "data": {"role": "player"|"admin", "nickname": "..."}}` -- role assignment in connection order
**D-11:** Full Vite + React + TypeScript project scaffold in Phase 1 -- not just a placeholder
**D-12:** Tailwind CSS v4 configured, React Router with `/` and `/admin` routes, minimal placeholder content
**D-13:** Frontend dependencies (react, react-dom, react-router-dom, zustand, motion, howler) installed now so the Docker build stage works end-to-end

### Claude's Discretion

No areas were deferred to Claude -- all decisions were explicitly selected by the user.

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-01 | Full application starts with a single `docker compose up` command | Docker multi-stage build: Stage 1 builds React frontend (node:22-alpine), Stage 2 serves via uvicorn (python:3.13-slim). Single `compose.yml` with one service, volume mount for SQLite data persistence. |
| DEPLOY-02 | Application works fully offline -- no internet connectivity at runtime | All static assets (React build, fonts) bundled in Docker image. No CDN references. FastAPI `StaticFiles` mount serves built frontend. No external API calls. No Google Fonts. |
| DEPLOY-03 | All static assets (React build, sounds, fonts, icons) served by FastAPI via StaticFiles | FastAPI `StaticFiles` mount at `/` or sub-path. Critical: API routes MUST be defined BEFORE the StaticFiles mount to avoid route shadowing (the static mount is a catch-all that will intercept API routes defined after it). Vite build output at `frontend/dist/` copied into Docker image. |
| DEPLOY-04 | Players connect via local WiFi at `http://<server-ip>:8000/` | Uvicorn binds to `0.0.0.0:8000` (all interfaces). No host filtering. No SSL/TLS (local LAN, no sensitive data). Ensure server firewall allows port 8000 inbound. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP server (FastAPI) | API / Backend | -- | FastAPI is the primary application server. Single container serves both API and static files. |
| WebSocket endpoint | API / Backend | -- | All WebSocket connections go to the single `/ws` endpoint on the backend. Client is a thin display terminal. |
| Database initialization | API / Backend | -- | SQLite file-based DB lives on the server filesystem. Async SQLAlchemy engine created in lifespan handler. |
| Connection management | API / Backend | -- | ConnectionManager singleton lives in backend memory, tracks all 3 connections by role. |
| Question CRUD (REST) | API / Backend | -- | Full question management API at `/api/questions/*` -- REST endpoints, not WebSocket. |
| Static file serving | API / Backend | CDN / Static | FastAPI StaticFiles mount serves the React build. No external CDN needed since all assets are bundled. |
| Frontend UI | Browser / Client | -- | React SPA rendered in the user's browser. Connects to backend via WebSocket and REST. |
| State management (client) | Browser / Client | -- | Zustand store in the React app manages UI state driven by server events. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.13.13 | Backend runtime | Latest stable branch with full `python:3.13-slim` Docker support and proven library compatibility for all required dependencies. [VERIFIED: python.org] |
| FastAPI | 0.136.x | HTTP + WebSocket server | Native WebSocket support via Starlette, async-first, automatic OpenAPI docs. The standard Python choice for real-time web apps in 2026. [VERIFIED: PyPI - fastapi 0.136.1 installed locally] |
| Uvicorn | 0.48.x | ASGI server | Runs FastAPI natively. `uvicorn[standard]` includes uvloop (2-4x async speedup). Single worker is correct for single-container deployment. [CITED: PyPI] |
| SQLAlchemy | 2.0.x | Async ORM | Mature async support in 2.0 with `create_async_engine`, `async_sessionmaker`. Critical: set `expire_on_commit=False` to avoid MissingGreenlet errors. [VERIFIED: PyPI - SQLAlchemy 2.0.49 installed locally] |
| aiosqlite | 0.20.x | Async SQLite driver | Required by SQLAlchemy 2.0 async mode. Provides `sqlite+aiosqlite:///` connection string. Without this, using sync `sqlite:///` blocks the async event loop. [VERIFIED: PyPI] |
| React | 19.x | Frontend UI library | Current stable with React Compiler auto-memoization, Actions for form handling. No SSR needed for this fully offline SPA. [VERIFIED: npm registry] |
| Vite | 6.x | Frontend build tool | Official React recommendation. Fast HMR, tree-shaking, native ESM. [VERIFIED: npm registry] |
| TypeScript | 5.x | Type safety | Catches WebSocket message shape mismatches at compile time -- critical when server and client must agree on event payloads. [VERIFIED: npm registry] |
| Tailwind CSS | 4.3.x | Utility-first CSS | CSS-first configuration via `@theme` directives. Requires `@tailwindcss/vite` plugin. Zero runtime, tiny production CSS via purging. [CITED: tailwindcss.com/blog/tailwindcss-v4-3] |
| python-multipart | 0.0.x | File upload parsing | Required by FastAPI for `UploadFile` in CSV import endpoint. Without this, file uploads silently fail with a 422 error. [VERIFIED: PyPI - python-multipart 0.0.29 installed locally] |

### Supporting (for Phase 1 scaffolding -- D-13)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.x | Client state management | Installed now for Docker build validation. Stores WebSocket connection state, game phase, scores, timer. Accessible outside React tree. |
| Motion | 12.40.x | Animation library | Installed now. Formerly Framer Motion. Import from `"motion/react"`. Timer circle animation, round result overlays. |
| Howler.js | 2.2.4 | Audio playback | Installed now. Preload 4 sound files on app mount. Web Audio API with HTML5 Audio fallback. |
| React Router | 7.x | Client-side routing | Installed now. Routes: `/` for player join, `/admin` for admin panel. `createBrowserRouter` API. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Ruff | 0.15.x | Python linter + formatter | Replaces Flake8, isort, Black in one tool. [VERIFIED: ruff 0.15.11 installed] |
| ESLint | 9.x | JS/TS linter | Flat config format (`eslint.config.js`). |
| Prettier | 3.x | JS/TS formatter | Consistent formatting. |

### Alternatives Considered

No alternatives to the above were considered -- all decisions are locked per CONTEXT.md.

### Installation

```bash
# Backend (Python) -- backend/requirements.txt
fastapi==0.136.*
uvicorn[standard]==0.48.*
sqlalchemy==2.0.*
aiosqlite==0.20.*
python-multipart==0.0.*

# Dev
ruff==0.*

# Frontend (npm) -- frontend/package.json
npm create vite@latest frontend -- --template react-ts
npm install react@19 react-dom@19 react-router-dom@7
npm install zustand@5 motion@12 howler@2
npm install -D tailwindcss@4 @tailwindcss/vite@4
npm install -D eslint@9 prettier@3
```

### Version Verification

```bash
# Confirmed locally:
pip3 show fastapi        # 0.136.1
pip3 show sqlalchemy     # 2.0.49
pip3 show python-multipart # 0.0.29
# NOTE: aiosqlite NOT currently installed -- must be added
python3 --version        # 3.12.6 (see Environment Availability note)
node --version           # v20.20.2
npm --version            # 10.8.2
docker --version         # 24.0.7
```

## Architecture Patterns

### System Architecture Diagram

```
Player 1 (browser)          Player 2 (browser)          Admin (phone browser)
       |                          |                           |
       |  http://<ip>:8000/       |  http://<ip>:8000/        |  http://<ip>:8000/admin
       v                          v                           v
+---------------------------------------------------------------+
|                    FastAPI + Uvicorn (:8000)                    |
|                                                                 |
|  StaticFiles mount (/)  ---  frontend/dist/ (React build)      |
|                                                                 |
|  REST API: /api/questions  ---  QuestionService CRUD           |
|  REST API: /api/stats                                           |
|                                                                 |
|  WebSocket: /ws                                                 |
|    +-- ConnectionManager (singleton)                            |
|    |   - player1, player2, admin (strict 2+1 enforcement)      |
|    |   - send_to_player(), send_to_admin(), broadcast()         |
|    +-- Lifespan: DB init, create_all()                          |
|                                                                 |
+-------^-----------------------^---------------------^---------+
        |                       |                     |
        v                       v                     v
+---------------------------------------------------------------+
|                    SQLite (WAL mode)                            |
|  tables: questions, game_sessions, rounds, stats               |
|  file: data/game.db (volume-mounted for persistence)           |
+---------------------------------------------------------------+
```

Data flow: Browser requests `http://<server-ip>:8000/` -> FastAPI serves React SPA from StaticFiles mount -> React app connects WebSocket to `ws://<server-ip>:8000/ws` -> ConnectionManager assigns role (player1/player2/admin) -> API calls for question CRUD go to REST endpoints.

### Recommended Project Structure

```
backend/
├── main.py               # FastAPI app, lifespan handler, WebSocket /ws endpoint, app state
├── models.py             # SQLAlchemy ORM models: Question, GameSession, Round, Stat
├── database.py           # Async engine creation, session factory, get_db dependency
├── routers/
│   ├── __init__.py
│   └── questions.py      # /api/questions CRUD endpoints
├── services/
│   ├── __init__.py
│   └── question_service.py  # QuestionService: CRUD, CSV parse, random selection
├── connection_manager.py # ConnectionManager singleton class
├── schemas.py            # Pydantic models for request/response validation
├── requirements.txt      # Python dependencies
└── static/               # (gitignored) Vite build output copied here during Docker build
    └── (frontend build files)

frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
├── index.html
├── public/
│   └── sounds/           # (placeholder for Phase 5)
├── src/
│   ├── main.tsx          # React entry, RouterProvider
│   ├── App.tsx           # Layout component with Outlet
│   ├── index.css         # @import "tailwindcss"; @theme directives
│   ├── pages/
│   │   ├── JoinPage.tsx  # Route: "/" -- placeholder for Phase 3
│   │   └── AdminPage.tsx # Route: "/admin" -- placeholder for Phase 4
│   ├── stores/
│   │   └── gameStore.ts  # Zustand store -- placeholder for Phase 3
│   └── types/
│       └── ws.ts         # WebSocket message types -- shared protocol types

data/                     # SQLite database persistence (volume mount)
└── game.db               # (created at runtime, gitignored)

compose.yml               # Docker Compose single-service definition
Dockerfile                # Multi-stage build (frontend + backend)
```

### Pattern 1: FastAPI Lifespan with Async SQLAlchemy Engine

**What:** The standard FastAPI lifespan context manager pattern (replacing deprecated `@app.on_event` decorators). The `lifespan` async context manager handles database engine creation on startup and disposal on shutdown. WAL mode PRAGMAs are applied via `@event.listens_for(engine.sync_engine, "connect")` event listener.

**When to use:** Always. `@app.on_event("startup")` and `@app.on_event("shutdown")` are deprecated since FastAPI 0.93.0. [CITED: FastAPI docs]

**Example:**
```python
# Source: FastAPI official docs / SQLAlchemy async docs [VERIFIED]
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    engine = create_async_engine(
        "sqlite+aiosqlite:///data/game.db",
        echo=False,
    )
    
    # Set WAL mode and performance PRAGMAs on every connection
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    
    async_session = async_sessionmaker(
        engine,
        expire_on_commit=False,  # CRITICAL: prevents MissingGreenlet errors
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Store in app.state for reuse
    app.state.engine = engine
    app.state.session_factory = async_session
    
    yield  # Application serves requests here
    
    # --- SHUTDOWN ---
    await engine.dispose()

app = FastAPI(lifespan=lifespan)
```

**Critical details:**
- `sqlite+aiosqlite:///` path is relative to the working directory (not the file location). In Docker, the working directory is `/app`, so the absolute path becomes `/app/data/game.db`.
- WAL mode is idempotent -- safe to set on every connection.
- `expire_on_commit=False` prevents the `MissingGreenlet` error when accessing ORM attributes after `session.commit()` in async mode. [VERIFIED: SQLAlchemy discussion #9846]
- `event.listens_for(engine.sync_engine, "connect")` is the correct pattern for async engines. Do NOT use `@event.listens_for(engine, "connect")` -- it will not work because async engines do not emit `connect` events directly. [VERIFIED: SQLAlchemy docs]

### Pattern 2: Database Dependency Injection

**What:** FastAPI dependency yielding an async session, ensuring proper cleanup after request completion.

**Example:**
```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db(request: Request) -> AsyncSession:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        await session.close()
```

### Pattern 3: ConnectionManager Singleton with asyncio.gather Broadcast

**What:** A singleton class managing exactly 3 WebSocket connections (player1, player2, admin) with role-based tracking and concurrent broadcast. `asyncio.gather()` ensures all clients receive messages simultaneously, preventing the "timer drift" pitfall where sequential sends cause Player 2 to receive updates later than Player 1. [CITED: FastAPI Cookbook, websocket.org guide]

**When to use:** Always. This is D-08 locked decision.

**Example:**
```python
# Source: FastAPI Cookbook pattern [CITED], adapted for role tracking
import asyncio
from fastapi import WebSocket
from typing import Optional

class ConnectionManager:
    def __init__(self):
        self.player1: Optional[WebSocket] = None
        self.player2: Optional[WebSocket] = None
        self.admin: Optional[WebSocket] = None
        self.player1_nickname: Optional[str] = None
        self.player2_nickname: Optional[str] = None

    @property
    def player_count(self) -> int:
        count = 0
        if self.player1 is not None:
            count += 1
        if self.player2 is not None:
            count += 1
        return count

    @property
    def all_connections(self) -> list[WebSocket]:
        return [ws for ws in [self.player1, self.player2, self.admin] if ws is not None]

    async def broadcast(self, message: dict):
        """Send message to ALL connected clients concurrently."""
        tasks = [ws.send_json(message) for ws in self.all_connections]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_player(self, player_num: int, message: dict):
        """Send to specific player (1 or 2)."""
        ws = self.player1 if player_num == 1 else self.player2
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass  # Dead connection cleanup

    async def send_to_players(self, message: dict):
        """Send to both players concurrently."""
        tasks = []
        if self.player1:
            tasks.append(self.player1.send_json(message))
        if self.player2:
            tasks.append(self.player2.send_json(message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_admin(self, message: dict):
        """Send to admin only."""
        if self.admin:
            try:
                await self.admin.send_json(message)
            except Exception:
                pass
```

**Critical: disconnect-safe pattern.** FastAPI's WebSocket only detects disconnection on `receive()`, NOT on `send()`. A send-only loop never detects dropped clients. The standard mitigation is: always pair a reader task (awaiting `websocket.receive()`) with the writer task, and cancel the writer when `receive()` raises `WebSocketDisconnect`. [CITED: FastAPI issues #3008, #11008]

```python
# WebSocket handler with paired reader task for disconnect detection
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)  # role assignment handled by first msg
    
    reader_task = asyncio.create_task(_read_messages(websocket, manager))
    # Any broadcast/send logic runs elsewhere
    
    try:
        await reader_task  # blocks until disconnect
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        reader_task.cancel()
```

### Pattern 4: Tailwind CSS v4 with Vite Plugin

**What:** Tailwind CSS v4 uses a Vite plugin (`@tailwindcss/vite`) instead of the PostCSS plugin used in v3. CSS-first configuration replaces the `tailwind.config.js` file. Design tokens are defined in CSS via `@theme` directives. [CITED: tailwindcss.com, NPM @tailwindcss/vite]

**Example:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-wb-bg: #1a0a2e;
  --color-player1: #3B82F6;
  --color-player2: #EF4444;
  --color-correct: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

### Pattern 5: React Router v7 with createBrowserRouter

**What:** React Router v7 uses `createBrowserRouter` with a route config array. Data loaders and actions are supported natively. The package is simply `react-router` (not `react-router-dom`). [CITED: reactrouter.com docs]

**Example:**
```typescript
// src/main.tsx
import { createBrowserRouter, RouterProvider } from "react-router";
import App from "./App";
import JoinPage from "./pages/JoinPage";
import AdminPage from "./pages/AdminPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
    children: [
      { index: true, Component: JoinPage },
      { path: "admin", Component: AdminPage },
    ],
  },
]);

const root = document.getElementById("root");
if (root) {
  root.innerHTML = "";
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}
```

### Anti-Patterns to Avoid

- **Route shadowing:** Defining the `StaticFiles` mount BEFORE API routes causes all requests (including `/api/questions`) to be handled by the static file handler. The mount intercepts any path that does not match a file. **Fix:** Define ALL API routes and WebSocket endpoints BEFORE the StaticFiles mount. [ASSUMED -- standard FastAPI pitfall]
- **Sequential WebSocket broadcast:** Using `for ws in connections: await ws.send_json(msg)` causes Player 2 to receive updates 50-500ms later than Player 1. **Fix:** Always use `asyncio.gather()` for multi-client sends. [CITED: FastAPI Cookbook]
- **`session.query()` style in SQLAlchemy 2.0:** The old 1.x `session.query(User).filter(...)` pattern works but is deprecated. **Fix:** Use the new 2.0 style `select()`: `await session.execute(select(User).where(User.id == id))`. [VERIFIED: SQLAlchemy 2.0 docs]
- **Implicit attribute access after commit:** Accessing ORM attributes after `session.commit()` with `expire_on_commit=True` (the default) triggers a lazy load, causing `MissingGreenlet` in async mode. **Fix:** Set `expire_on_commit=False` on `async_sessionmaker`. [VERIFIED: SQLAlchemy discussion #9846]
- **`@app.on_event("startup")`:** This is deprecated since FastAPI 0.93.0 and will be removed. **Fix:** Use the `lifespan` async context manager pattern. [VERIFIED: FastAPI docs]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection lifecycle | Custom connection tracking with dicts and locks | ConnectionManager singleton (D-08) | Edge cases: concurrent connect/disconnect during broadcast, partial disconnects, garbage collection of dead sockets |
| Async SQLite connection pooling | Raw aiosqlite with manual connection management | SQLAlchemy 2.0 async engine + async_sessionmaker | Edge cases: connection lifecycle, WAL mode, transaction management, concurrent access serialization |
| ASGI server | Hypercorn or Daphne | Uvicorn[standard] | Uvicorn is the recommended server for FastAPI. It includes uvloop for 2-4x async speedup and httptools for HTTP parsing. |
| HTTP client for testing | Raw httpx or requests | FastAPI TestClient | TestClient wraps httpx with lifespan support, automatic request/response serialization, and WebSocket test support. |

## Runtime State Inventory

> **Phase 1 is greenfield.** No existing code, no runtime state. All categories are "None."

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no database exists yet | Create SQLite file at `data/game.db` at runtime |
| Live service config | None -- no services running | Start from scratch |
| OS-registered state | None -- project directory only | No system registrations needed |
| Secrets/env vars | None -- no secrets required | No environment variables needed for Phase 1 |
| Build artifacts | None -- both `backend/` and `frontend/` directories do not exist yet | Create all files from scratch |

## Common Pitfalls

### Pitfall 1: aiosqlite Not Installed
**What goes wrong:** `sqlalchemy.exc.ArgumentError: Could not parse SQLAlchemy URL 'sqlite+aiosqlite:///data/game.db'` -- the app fails to start because aiosqlite is not installed.
**Why it happens:** aiosqlite is not a transitive dependency of SQLAlchemy. It must be explicitly added to `requirements.txt`.
**How to avoid:** Add `aiosqlite==0.20.*` to `backend/requirements.txt`. Verify with `pip install -r requirements.txt` and `python -c "import aiosqlite"` in the Docker build.
**Warning signs:** Docker build succeeds (pip install exits 0) but the app crashes on startup with the `Could not parse SQLAlchemy URL` error.

### Pitfall 2: Route Shadowing (StaticFiles Before API Routes)
**What goes wrong:** API requests return 404 or return the React `index.html` content instead of JSON responses. This happens because FastAPI's `StaticFiles` mount at `/` acts as a catch-all -- if a file path doesn't match, it falls back to 404 (or its configured handler), but it intercepts ALL URL paths that come after it.
**Why it happens:** The developer defines `app.mount("/", StaticFiles(directory="static", html=True))` before defining `/api/questions` or the `/ws` WebSocket endpoint. The mount matches first and short-circuits.
**How to avoid:** Define ALL API routers and WebSocket endpoints BEFORE the StaticFiles mount. The mount should be the very last thing added to the app.
**Warning signs:** `curl http://localhost:8000/api/questions` returns HTML instead of JSON, or returns 404 after the mount.

### Pitfall 3: MissingGreenlet Error on ORM Attribute Access
**What goes wrong:** After `await session.commit()`, accessing `question.text` on a committed ORM object raises `sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called; can't call await_only() here.`
**Why it happens:** By default, `session.commit()` expires all ORM object attributes. When you access an expired attribute, SQLAlchemy tries to lazy-load it -- in async mode, this requires a greenlet context that does not exist outside `await`.
**How to avoid:** Set `expire_on_commit=False` on the `async_sessionmaker`. If fresh data is needed after commit, use `await session.refresh(obj)` explicitly.
**Warning signs:** Code that works with synchronous SQLAlchemy raises `MissingGreenlet` when switched to async. [VERIFIED: SQLAlchemy discussion #9846, fastapi-users issue #1175]

### Pitfall 4: WebSocket Disconnect Not Detected
**What goes wrong:** A player closes their browser tab or loses WiFi. The server does not detect the disconnection and continues sending messages to a dead WebSocket, accumulating zombie connections. Eventually, the server runs out of connection slots and new players cannot join.
**Why it happens:** FastAPI's WebSocket only detects disconnection when calling `await websocket.receive()` (raises `WebSocketDisconnect`). If your code only calls `await websocket.send_json()`, it may not detect the disconnect for a long time (or at all, depending on TCP keepalive).
**How to avoid:** Always pair a reader coroutine (which awaits `websocket.receive()`) with your writer coroutine. Cancel the writer when the reader detects disconnect. Use `asyncio.gather(return_exceptions=True)` to run both. [CITED: FastAPI issues #3008, #11008]

### Pitfall 5: SQLite "database is locked" Error
**What goes wrong:** Multiple concurrent async writes to SQLite fail with `sqlite3.OperationalError: database is locked`.
**Why it happens:** The default journal mode (DELETE) blocks reads during writes. Even in WAL mode, SQLite has limited concurrent write capacity (one writer at a time). This project has low write volume (one game at a time), so WAL mode alone is sufficient.
**How to avoid:** (1) Enable WAL mode via PRAGMA, (2) Set `PRAGMA busy_timeout=5000` so SQLite waits instead of failing immediately, (3) Keep game state in-memory (GameSession object), only persist to SQLite at game end. [CITED: sqlite.org/wal.html]

### Pitfall 6: Docker Build Fails Because Node Version Mismatch
**What goes wrong:** The Docker multi-stage build fails with npm errors because the node image used for the frontend build stage is incompatible with Vite 6 requirements.
**Why it happens:** Vite 6 requires Node.js 18+. Using an older node image (e.g., node:16-alpine) causes cryptic npm errors.
**How to avoid:** Use `node:22-alpine` for the frontend build stage (the CLAUDE.md already specifies this version). Do NOT use `node:lts-alpine` which may resolve to an older version.
**Warning signs:** Docker build fails at `npm run build` with errors about ES module support.

## Code Examples

### FastAPI Application Entry Point (main.py skeleton)

```python
# Pattern: FastAPI 0.136.x with lifespan and WebSocket [CITED: FastAPI docs]
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from models import Base
from connection_manager import ConnectionManager
from routers import questions as questions_router

manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    engine = create_async_engine("sqlite+aiosqlite:///data/game.db", echo=False)
    
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    
    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    app.state.engine = engine
    yield
    
    # --- SHUTDOWN ---
    await engine.dispose()

app = FastAPI(title="Duel Chisel", lifespan=lifespan)

# API routes MUST come before StaticFiles mount
app.include_router(questions_router.router, prefix="/api")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        # First message must be a join event
        data = await websocket.receive_json()
        if data.get("event") == "join":
            role = data.get("data", {}).get("role")
            nickname = data.get("data", {}).get("nickname", "")
            
            if role == "admin":
                if manager.admin is not None:
                    await websocket.send_json({
                        "event": "error",
                        "data": {"message": "Admin slot already taken"}
                    })
                    await websocket.close()
                    return
                manager.admin = websocket
                await websocket.send_json({
                    "event": "joined",
                    "data": {"role": "admin"}
                })
            elif role == "player":
                if manager.player_count >= 2:
                    await websocket.send_json({
                        "event": "error",
                        "data": {"message": "Game is full"}
                    })
                    await websocket.close()
                    return
                player_num = 1 if manager.player1 is None else 2
                if player_num == 1:
                    manager.player1 = websocket
                    manager.player1_nickname = nickname
                else:
                    manager.player2 = websocket
                    manager.player2_nickname = nickname
                await websocket.send_json({
                    "event": "joined",
                    "data": {"player_number": player_num, "nickname": nickname}
                })
        
        # Keep connection alive and detect disconnect
        while True:
            await websocket.receive_json()  # blocks until message or disconnect
    
    except WebSocketDisconnect:
        # Clean up connection
        if manager.player1 == websocket:
            manager.player1 = None
            manager.player1_nickname = None
        elif manager.player2 == websocket:
            manager.player2 = None
            manager.player2_nickname = None
        elif manager.admin == websocket:
            manager.admin = None

# StaticFiles mount MUST be last
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

### SQLAlchemy ORM Models

```python
# Source: SQLAlchemy 2.0 async declarative pattern [VERIFIED]
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime, timezone

class Base(DeclarativeBase):
    pass

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(Text, nullable=False)
    answer = Column(Integer, nullable=False)
    category = Column(String(255), nullable=True)  # D-07: nullable free-text
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class GameSession(Base):
    __tablename__ = "game_sessions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    player1_nickname = Column(String(15), nullable=False)
    player2_nickname = Column(String(15), nullable=False)
    player1_score = Column(Integer, default=0)
    player2_score = Column(Integer, default=0)
    winner_nickname = Column(String(15), nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime, nullable=True)
    
    rounds = relationship("Round", back_populates="game_session")

class Round(Base):
    __tablename__ = "rounds"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    game_session_id = Column(Integer, ForeignKey("game_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    round_number = Column(Integer, nullable=False)
    player1_answer = Column(Integer, nullable=True)
    player2_answer = Column(Integer, nullable=True)
    winner = Column(Integer, nullable=True)  # 1, 2, or None for tie
    
    game_session = relationship("GameSession", back_populates="rounds")
    question = relationship("Question")

class Stat(Base):
    __tablename__ = "stats"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    game_count = Column(Integer, default=0)
```

### Async Dependency for Database Sessions

```python
# Source: SQLAlchemy 2.0 async session pattern [VERIFIED]
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db(request: Request) -> AsyncSession:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        await session.close()
```

### QuestionService CRUD Methods

```python
# Pattern: SQLAlchemy 2.0 async select() style [VERIFIED]
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

class QuestionService:
    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(Question).order_by(Question.id).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    @staticmethod
    async def get_by_id(db: AsyncSession, question_id: int):
        result = await db.execute(
            select(Question).where(Question.id == question_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def create(db: AsyncSession, text: str, answer: int, category: str = None):
        question = Question(text=text, answer=answer, category=category)
        db.add(question)
        await db.commit()
        await db.refresh(question)
        return question
    
    @staticmethod
    async def delete(db: AsyncSession, question_id: int):
        question = await QuestionService.get_by_id(db, question_id)
        if question:
            await db.delete(question)
            await db.commit()
            return True
        return False
    
    @staticmethod
    async def random_selection(db: AsyncSession, count: int = 9):
        result = await db.execute(
            select(Question).order_by(func.random()).limit(count)
        )
        return result.scalars().all()
```

### Docker Multi-stage Build

```dockerfile
# Source: Docker multi-stage for FastAPI + Vite [CITED: github.com/fader111, adapted]
# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/dist ./static

# Create data directory for SQLite
RUN mkdir -p /app/data

# Non-root user for security
RUN adduser --disabled-password appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# compose.yml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data  # SQLite database persistence
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@app.on_event("startup")` | `lifespan` context manager | FastAPI 0.93.0 (deprecated), removal pending | All new FastAPI code must use `lifespan` |
| `session.query(User).filter(...)` | `select(User).where(...)` | SQLAlchemy 2.0 (2023) | The old style works but emits deprecation warnings; 2.0 style is cleaner for async |
| `framer-motion` npm package | `motion` npm package | 2026 | Import from `"motion/react"` instead of `"framer-motion"` |
| Tailwind CSS v3 (`tailwind.config.js`) | Tailwind CSS v4 (`@theme` in CSS) | 2025-2026 | PostCSS plugin replaced by Vite plugin; CSS-first config |
| CRA (Create React App) | Vite | 2023 (CRA unmaintained) | Vite is the standard React build tool |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Python 3.13 `slim` Docker image has all system dependencies needed by aiosqlite (SQLite shared library with WAL support) | Dockerfile | If the slim image lacks SQLite with WAL support, need `python:3.13-slim-bookworm` or add `libsqlite3-dev` package |
| A2 | `python:3.13-slim` Docker image is available on Docker Hub with 3.13.13 tag as of May 2026 | Dockerfile | Fallback to `python:3.13.13-slim-bookworm` or pin to `python:3.12-slim` which is verified locally |
| A3 | The `event.listens_for(engine.sync_engine, "connect")` pattern works equivalently on all SQLAlchemy 2.0.x versions | Database pattern | Verified across SQLAlchemy 2.0 discussions -- pattern is stable and documented |
| A4 | `WebSocketDisconnect` exception is raised when the client disconnects, regardless of how (browser close, tab switch, network loss) | WebSocket pattern | Must be verified on target devices -- some network failures may result in timeout instead of immediate disconnect, requiring keepalive pings |

**If this table is empty:** All claims in this research were verified or cited -- no user confirmation needed.

## Open Questions

1. **Python version mismatch (3.12.6 installed, 3.13.13 recommended)**
   - What we know: The local development environment has Python 3.12.6, while the stack recommends 3.13.13. Docker image is `python:3.13-slim` -- so the Docker build uses 3.13.x regardless.
   - What's unclear: Will development without pyenv/venv targeting 3.13 cause issues? FastAPI 0.136.x and SQLAlchemy 2.0.x work on both 3.12 and 3.13. The `python:3.12-slim` base image is a fallback if 3.13 slim has issues.
   - Recommendation: Use Docker for primary testing. For local dev without Docker, use a `.python-version` file or pyenv to match 3.13.x. If that's not practical, pin Docker to `python:3.13-slim` and develop locally on 3.12 (no breaking differences expected for this stack).

2. **Tailwind CSS v4 postcss vs vite plugin**
   - What we know: In Phase 1 the Vite plugin works fine. But there may be edge cases with CSS `@import` ordering and `@theme` directives.
   - What's unclear: Whether the placeholder pages need any complex Tailwind patterns or just basic utility classes.
   - Recommendation: Phase 1 placeholder pages use only basic Tailwind classes (flex, grid, text, colors). Complex `@theme` customization can wait until Phase 3/4.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | Backend runtime | Yes | 3.12.6 (3.13.13 recommended for Docker) | Docker image uses `python:3.13-slim` |
| Node.js | Frontend build | Yes | 20.20.2 | Docker uses `node:22-alpine` |
| npm | Frontend deps | Yes | 10.8.2 | Bundled with node |
| Docker | Containerization | Yes | 24.0.7 | -- |
| Docker Compose | Orchestration | Yes | (included in Docker 24) | -- |
| fastapi | Backend HTTP+WS | Yes | 0.136.1 | -- |
| uvicorn | ASGI server | Yes | 0.47.0 (0.48.x recommended) | Close enough for dev; Docker installs `uvicorn[standard]==0.48.*` |
| SQLAlchemy | ORM | Yes | 2.0.49 | -- |
| python-multipart | File uploads | Yes | 0.0.29 | -- |
| aiosqlite | Async SQLite driver | **NO** | -- | Must add to requirements.txt |
| ruff | Python linter | Yes | 0.15.11 | -- |
| `backend/` directory | Project structure | **NO** | -- | Must create |
| `frontend/` directory | Project structure | **NO** | -- | Must create with Vite scaffold |

**Missing dependencies with no fallback:**
- aiosqlite -- must be added to `backend/requirements.txt` for SQLAlchemy async to work

**Missing dependencies with fallback:**
- Python 3.12.6 locally vs 3.13.13 in Docker -- no impact on Phase 1 functionality. All libraries work on both versions.
- Uvicorn 0.47.0 locally vs 0.48.x in Docker -- no breaking differences for Phase 1 use case. Docker pins the recommended version.

## Validation Architecture

> **SKIPPED:** `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

## Security Domain

> Required: `security_enforcement: true`, ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This is a local LAN game with no user accounts. No authentication needed. |
| V3 Session Management | No | No session management in Phase 1. WebSocket connections are ephemeral. |
| V4 Access Control | No | No role-based access control yet. WebSocket role assignment is informational, not security-critical. |
| V5 Input Validation | Yes | All REST API inputs (question text, answer, category) must be validated server-side. Pydantic models for request bodies. |
| V6 Cryptography | No | No sensitive data transmitted over local LAN. No encryption needed. |
| V7 Error Handling | Partial | WebSocket error events should not leak stack traces. Use `send_json({"event": "error", ...})` pattern. |
| V12 File Uploads | Partial | CSV upload endpoint must validate file type, size, and content. Use FastAPI `UploadFile` with size limits. |

### Known Threat Patterns for FastAPI + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via question text | Tampering | SQLAlchemy ORM parameterized queries (not raw SQL). No raw SQL in Phase 1. |
| CSV upload with malicious content | Tampering | Validate each row: `answer` must be integer 0-1,000,000; `text` must be non-empty string. Reject rows with errors. |
| Large upload DoS | Denial of Service | Set FastAPI `UploadFile` size limit. Limit CSV row count. |
| WebSocket message injection | Spoofing | Validate all incoming WebSocket JSON messages against expected schema. Reject malformed messages gracefully. |

## Sources

### Primary (HIGH confidence)

- **Python 3.13.13 release:** https://www.python.org/downloads/release/python-31313/ [April 2026]
- **FastAPI WebSocket guide:** https://websocket.org/guides/frameworks/fastapi/ [confirmed native WS via Starlette]
- **Tailwind CSS v4.3 release:** https://tailwindcss.com/blog/tailwindcss-v4-3 [May 2026, official blog]
- **Tailwind CSS v4.2 release:** https://www.infoq.com/news/2026/04/tailwind-css-4-2-webpack/ [MEDIUM]
- **FastAPI lifespan pattern** -- confirmed by FastAPI docs and multiple migration issues on GitHub
- **SQLAlchemy async + aiosqlite** -- verified via SQLAlchemy GitHub discussions and fastapi-users issue #1175
- **Python version status:** https://devguide.python.org/versions/ [3.13 bugfix active through Oct 2026]
- **React Router v7 docs:** https://reactrouter.com/7.7.1/api/data-routers/createBrowserRouter

### Secondary (MEDIUM confidence)

- **WebSocket asyncio.gather broadcast pattern:** FastAPI Cookbook, websocket.org guide
- **Docker multi-stage build for FastAPI + Vite:** https://github.com/fader111/vite_fastapi_simple_app
- **SQLAlchemy MissingGreenlet fix:** https://github.com/sqlalchemy/sqlalchemy/discussions/9846
- **FastAPI disconnect detection:** GitHub issues #3008, #11008
- **React Router v7 simplified package:** community articles and migration guides

### Tertiary (LOW confidence)

- Python 3.13-slim Docker image specific SQLite WAL support -- needs Docker build verification
- Tailwind CSS v4 `@theme` compatibility with bundled fonts -- needs verification with local font files
- Howler.js cache behavior for local file:// or asset:// URLs in bundled Docker container

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against PyPI/npm registries and official docs
- Architecture: HIGH -- patterns based on FastAPI and SQLAlchemy official documentation, locked by D-01 through D-13
- Pitfalls: HIGH -- sourced from FastAPI GitHub issues, SQLAlchemy discussions, and SQLite WAL docs

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (30 days -- stack is stable, no fast-moving dependencies)
