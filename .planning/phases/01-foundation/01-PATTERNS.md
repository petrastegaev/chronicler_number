# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 24
**Analogs found:** 0 / 24 (greenfield project -- no existing codebase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/main.py` | controller | request-response, event-driven | No analog (greenfield) | N/A |
| `backend/models.py` | model | CRUD | No analog (greenfield) | N/A |
| `backend/database.py` | config/utility | CRUD | No analog (greenfield) | N/A |
| `backend/routers/__init__.py` | config | N/A | No analog (greenfield) | N/A |
| `backend/routers/questions.py` | controller | CRUD (REST) | No analog (greenfield) | N/A |
| `backend/services/__init__.py` | config | N/A | No analog (greenfield) | N/A |
| `backend/services/question_service.py` | service | CRUD | No analog (greenfield) | N/A |
| `backend/connection_manager.py` | service | event-driven | No analog (greenfield) | N/A |
| `backend/schemas.py` | model/utility | N/A | No analog (greenfield) | N/A |
| `backend/requirements.txt` | config | N/A | No analog (greenfield) | N/A |
| `Dockerfile` | config | N/A | No analog (greenfield) | N/A |
| `compose.yml` | config | N/A | No analog (greenfield) | N/A |
| `frontend/package.json` | config | N/A | No analog (greenfield) | N/A |
| `frontend/tsconfig.json` | config | N/A | No analog (greenfield) | N/A |
| `frontend/vite.config.ts` | config | N/A | No analog (greenfield) | N/A |
| `frontend/eslint.config.js` | config | N/A | No analog (greenfield) | N/A |
| `frontend/index.html` | utility | N/A | No analog (greenfield) | N/A |
| `frontend/src/main.tsx` | component | N/A | No analog (greenfield) | N/A |
| `frontend/src/App.tsx` | component | N/A | No analog (greenfield) | N/A |
| `frontend/src/index.css` | utility | N/A | No analog (greenfield) | N/A |
| `frontend/src/pages/JoinPage.tsx` | component | request-response | No analog (greenfield) | N/A |
| `frontend/src/pages/AdminPage.tsx` | component | request-response | No analog (greenfield) | N/A |
| `frontend/src/stores/gameStore.ts` | store | event-driven | No analog (greenfield) | N/A |
| `frontend/src/types/ws.ts` | model/utility | N/A | No analog (greenfield) | N/A |

## Pattern Assignments

> This is a **greenfield project** with no existing codebase. All pattern assignments reference the reference code examples in `01-RESEARCH.md` (Sections "Pattern 1" through "Pattern 5" and "Code Examples"). These are the authoritative source patterns that new files must follow.

---

### `backend/main.py` (controller, request-response + event-driven)

**Role:** FastAPI application entry point. Creates the app, registers lifespan handler (DB init, cleanup), includes routers, defines the `/ws` WebSocket endpoint, and mounts StaticFiles last.

**Data flow handling:** Dual -- REST API requests handled by included routers (`questions_router`); WebSocket events handled inline in the `websocket_endpoint` function with `receive_json()` message loop.

**Pattern source:** `01-RESEARCH.md`, section "Code Examples" > "FastAPI Application Entry Point (main.py skeleton)" (lines 510-620)

**Imports pattern:**
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from models import Base
from connection_manager import ConnectionManager
from routers import questions as questions_router
```

**Lifespan pattern (lines 529-552):**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
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
    # SHUTDOWN
    await engine.dispose()
```

**Route ordering pattern (critical -- lines 556-619):**
```python
# 1. API routes first
app.include_router(questions_router.router, prefix="/api")

# 2. WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # ... join logic, message loop ...

# 3. StaticFiles mount LAST (prevents route shadowing)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

**WebSocket join/role assignment pattern (lines 562-601):**
```python
data = await websocket.receive_json()
if data.get("event") == "join":
    role = data.get("data", {}).get("role")
    nickname = data.get("data", {}).get("nickname", "")
    if role == "admin":
        if manager.admin is not None:
            await websocket.send_json({"event": "error", "data": {"message": "Admin slot already taken"}})
            await websocket.close()
            return
        # ... assign admin ...
    elif role == "player":
        if manager.player_count >= 2:
            await websocket.send_json({"event": "error", "data": {"message": "Game is full"}})
            await websocket.close()
            return
        # ... assign player1 or player2 ...
```

---

### `backend/models.py` (model, CRUD)

**Role:** SQLAlchemy ORM declarative models. Defines `Base`, `Question`, `GameSession`, `Round`, `Stat` -- all 4 tables created upfront.

**Pattern source:** `01-RESEARCH.md`, section "Code Examples" > "SQLAlchemy ORM Models" (lines 624-675)

**Base class pattern:**
```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

**Question model (lines 633-640):**
```python
class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(Text, nullable=False)
    answer = Column(Integer, nullable=False)
    category = Column(String(255), nullable=True)  # D-07: nullable free-text
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

**GameSession model (lines 642-654):**
```python
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
```

**Round model (lines 656-667):**
```python
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
```

**Stat model (lines 671-674):**
```python
class Stat(Base):
    __tablename__ = "stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_count = Column(Integer, default=0)
```

---

### `backend/database.py` (config/utility, CRUD)

**Role:** Async SQLAlchemy engine creation, session factory, `get_db` FastAPI dependency. Provides the `async_sessionmaker` and dependency injection for database sessions.

**Pattern source:** `01-RESEARCH.md`, section "Code Examples" > "Async Dependency for Database Sessions" (lines 679-690), and section "Pattern 1: FastAPI Lifespan with Async SQLAlchemy Engine" (lines 217-274)

**get_db dependency pattern (lines 684-690):**
```python
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db(request: Request) -> AsyncSession:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        await session.close()
```

---

### `backend/routers/questions.py` (controller, CRUD)

**Role:** FastAPI APIRouter with CRUD endpoints for `/api/questions`. Handles list, get by ID, create, delete operations. Delegates business logic to `QuestionService`.

**Pattern source:** `01-RESEARCH.md` -- standard FastAPI router pattern. Use FastAPI's `APIRouter` with `Depends(get_db)` for session injection.

**Core pattern:**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from services.question_service import QuestionService
from schemas import QuestionCreate, QuestionResponse

router = APIRouter(prefix="/api/questions", tags=["questions"])

@router.get("/", response_model=list[QuestionResponse])
async def list_questions(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await QuestionService.get_all(db, skip=skip, limit=limit)

@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: int, db: AsyncSession = Depends(get_db)):
    question = await QuestionService.get_by_id(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question

@router.post("/", response_model=QuestionResponse, status_code=201)
async def create_question(data: QuestionCreate, db: AsyncSession = Depends(get_db)):
    return await QuestionService.create(db, text=data.text, answer=data.answer, category=data.category)

@router.delete("/{question_id}", status_code=204)
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await QuestionService.delete(db, question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")
```

---

### `backend/services/question_service.py` (service, CRUD)

**Role:** Business logic layer for question CRUD operations. Uses SQLAlchemy 2.0 `select()` style exclusively. Static methods for each operation.

**Pattern source:** `01-RESEARCH.md`, section "Code Examples" > "QuestionService CRUD Methods" (lines 693-737)

**Core CRUD pattern (lines 700-737):**
```python
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models import Question

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
        await db.refresh(question)  # explicit refresh after commit with expire_on_commit=False
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

**Key pattern rule:** Use `select()` style (2.0), never `session.query()` (1.x deprecated style). Always call `await db.refresh(question)` after `commit()` since `expire_on_commit=False`.

---

### `backend/connection_manager.py` (service, event-driven)

**Role:** Singleton managing exactly 3 WebSocket connections (player1, player2, admin). Provides targeted send methods and concurrent broadcast via `asyncio.gather()`.

**Pattern source:** `01-RESEARCH.md`, section "Pattern 3: ConnectionManager Singleton with asyncio.gather Broadcast" (lines 295-376)

**Singleton pattern (lines 306-357):**
```python
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

**Critical disconnect-safe pattern (from lines 362-376):** Always pair a reader task with `websocket.receive()` to detect disconnection. Sends alone do not detect dropped connections.

```python
reader_task = asyncio.create_task(_read_messages(websocket, manager))
try:
    await reader_task  # blocks until disconnect
except WebSocketDisconnect:
    manager.disconnect(websocket)
    reader_task.cancel()
```

---

### `backend/schemas.py` (model/utility, N/A)

**Role:** Pydantic models for request/response validation. Defines `QuestionCreate`, `QuestionResponse`, and any shared schema types.

**Pattern:** Standard Pydantic v2 models with FastAPI. Use `from pydantic import BaseModel, Field`.

```python
from pydantic import BaseModel, Field
from datetime import datetime

class QuestionCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    answer: int = Field(..., ge=0, le=1_000_000)
    category: str | None = Field(None, max_length=255)

class QuestionResponse(BaseModel):
    id: int
    text: str
    answer: int
    category: str | None
    created_at: datetime
```

---

### `backend/requirements.txt` (config, N/A)

**Pattern source:** `01-RESEARCH.md`, section "Standard Stack" > "Installation" (lines 102-111)

```
fastapi==0.136.*
uvicorn[standard]==0.48.*
sqlalchemy==2.0.*
aiosqlite==0.20.*
python-multipart==0.0.*

# Dev
ruff==0.*
```

---

### `Dockerfile` (config, N/A)

**Pattern source:** `01-RESEARCH.md`, section "Code Examples" > "Docker Multi-stage Build" (lines 741-770)

```dockerfile
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

---

### `compose.yml` (config, N/A)

**Pattern source:** `01-RESEARCH.md`, section "Code Examples" > "Docker Multi-stage Build" (lines 773-781)

```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data  # SQLite database persistence
```

---

### Frontend files (component/utility/config/store, various data flows)

**Pattern source:** `01-RESEARCH.md`, section "Pattern 4: Tailwind CSS v4 with Vite Plugin" (lines 379-407) and "Pattern 5: React Router v7 with createBrowserRouter" (lines 409-441)

#### `frontend/vite.config.ts` (config, N/A)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

#### `frontend/src/index.css` (utility, N/A)
```css
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

#### `frontend/src/main.tsx` (component, N/A)
```typescript
import { createBrowserRouter, RouterProvider } from "react-router";
import ReactDOM from "react-dom/client";
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

#### `frontend/src/App.tsx` (component, N/A)
```typescript
import { Outlet } from "react-router";

function App() {
  return (
    <div className="min-h-screen bg-wb-bg text-white">
      <Outlet />
    </div>
  );
}

export default App;
```

#### `frontend/src/pages/JoinPage.tsx` (component, request-response)
Minimal placeholder with Tailwind styling:
```typescript
function JoinPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">Join Game</h1>
    </div>
  );
}
export default JoinPage;
```

#### `frontend/src/pages/AdminPage.tsx` (component, request-response)
Minimal placeholder:
```typescript
function AdminPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">Admin Panel</h1>
    </div>
  );
}
export default AdminPage;
```

#### `frontend/src/stores/gameStore.ts` (store, event-driven)
Zustand store skeleton for Phase 3 integration:
```typescript
import { create } from "zustand";

interface GameState {
  phase: string;
  // Phase 3 will add: playerNumber, scores, timer, wsConnection
}

export const useGameStore = create<GameState>((set) => ({
  phase: "idle",
}));
```

#### `frontend/src/types/ws.ts` (model/utility, N/A)
WebSocket event type definitions using discriminated union pattern:
```typescript
export interface WsMessage {
  event: string;
  data: Record<string, unknown>;
}

export interface JoinMessage extends WsMessage {
  event: "join";
  data: {
    role: "player" | "admin";
    nickname: string;
  };
}

export interface JoinedEvent extends WsMessage {
  event: "joined";
  data: {
    role: "player" | "admin";
    player_number?: number;
    nickname?: string;
  };
}

export interface ErrorEvent extends WsMessage {
  event: "error";
  data: {
    message: string;
  };
}
```

---

## Shared Patterns

### 1. Async SQLAlchemy WAL Mode Setup
**Source:** `01-RESEARCH.md` lines 226-274 (Pattern 1)
**Apply to:** `backend/main.py` lifespan, `backend/database.py`

All database connections must use `sqlite+aiosqlite:///` URL with WAL mode PRAGMAs set via `event.listens_for(engine.sync_engine, "connect")`. The session factory must have `expire_on_commit=False` to prevent `MissingGreenlet` errors.

```python
engine = create_async_engine("sqlite+aiosqlite:///data/game.db", echo=False)

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

async_session = async_sessionmaker(engine, expire_on_commit=False)
```

### 2. Route Ordering (API Before StaticFiles)
**Source:** `01-RESEARCH.md` lines 444-447 (Anti-Pattern: Route shadowing)
**Apply to:** `backend/main.py`

**CRITICAL RULE:** Define ALL API `include_router()` calls and the `/ws` WebSocket endpoint BEFORE the `StaticFiles` mount. The mount is always the very last line.

```python
# DO THIS:
app.include_router(questions_router.router, prefix="/api")
app.include_router(stats_router.router, prefix="/api")
# ... any future routers ...

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket): ...

# LAST:
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

### 3. Async Broadcast with asyncio.gather
**Source:** `01-RESEARCH.md` lines 295-358 (Pattern 3) and lines 444-446 (Anti-Pattern: sequential broadcast)
**Apply to:** `backend/connection_manager.py`

Always use `asyncio.gather()` for multi-client sends. Sequential `for ws in connections: await ws.send_json()` causes timer drift between players.

```python
async def broadcast(self, message: dict):
    tasks = [ws.send_json(message) for ws in self.all_connections]
    await asyncio.gather(*tasks, return_exceptions=True)
```

### 4. WebSocket Disconnect Detection
**Source:** `01-RESEARCH.md` lines 360-376 (Pattern 3, disconnect-safe pattern)
**Apply to:** `backend/main.py` WebSocket endpoint

Always pair a reader coroutine with the writer. The server detects disconnection via `websocket.receive()` raising `WebSocketDisconnect`. A send-only loop will miss disconnects.

```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    reader_task = asyncio.create_task(_read_messages(websocket))
    try:
        await reader_task
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        reader_task.cancel()

async def _read_messages(websocket: WebSocket):
    while True:
        await websocket.receive_json()  # blocks until message or disconnect
```

### 5. SQLAlchemy 2.0 select() Style
**Source:** `01-RESEARCH.md` lines 446-448 (Anti-Pattern: session.query), lines 695-737 (Code Examples: QuestionService)
**Apply to:** All service files

Use `select()` style exclusively. Never use the deprecated `session.query()` pattern.

```python
# CORRECT (2.0 style):
result = await db.execute(select(Question).where(Question.id == question_id))

# WRONG (1.x style, deprecated):
result = db.query(Question).filter(Question.id == question_id).first()
```

### 6. Pydantic v2 Validation for REST Endpoints
**Source:** `01-RESEARCH.md` lines 849-859 (Security Domain: Input Validation)
**Apply to:** `backend/schemas.py`, `backend/routers/questions.py`

All REST API inputs validated server-side. Use Pydantic models with `Field` constraints. FastAPI automatically returns 422 for validation failures.

```python
class QuestionCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    answer: int = Field(..., ge=0, le=1_000_000)
    category: str | None = Field(None, max_length=255)
```

---

## No Analog Found

All 24 files have no codebase analog because this is a greenfield project. The patterns above are extracted from `01-RESEARCH.md` reference code examples, which serve as the authoritative pattern source.

| File | Role | Data Flow | Reason No Analog |
|------|------|-----------|------------------|
| All 24 files | various | various | Greenfield project -- `backend/` and `frontend/` directories do not exist yet |

## Metadata

**Analog search scope:** Entire repo (`/home/petr/IdeaProjects/PetProjects/number_game`)
**Files scanned:** 0 source code files (only CLAUDE.md, gdd.md, web_design.md, and .planning/* exist)
**Pattern extraction date:** 2026-05-28
**Pattern source:** `01-RESEARCH.md` (all code examples and architectural patterns)
