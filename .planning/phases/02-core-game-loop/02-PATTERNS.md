# Phase 2: Core Game Loop - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 6 (3 new, 3 modified)
**Analogs found:** 4 / 6 (2 with exact self-analog for modified files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/game/__init__.py` | config | N/A | `backend/__init__.py` | exact (empty `__init__.py`) |
| `backend/game/session.py` | service | event-driven | `backend/connection_manager.py` | role-match (service, singleton, async broadcast) |
| `backend/game/tokens.py` | utility | request-response | No close analog | module-level dict pattern (common Python idiom) |
| `backend/main.py` | controller | event-driven, request-response | `backend/main.py` (same file, extend dispatch) | self-analog (extend existing) |
| `frontend/src/types/ws.ts` | model/utility | N/A | `frontend/src/types/ws.ts` (same file, add types) | self-analog (extend existing) |
| `frontend/src/stores/gameStore.ts` | store | event-driven | `frontend/src/stores/gameStore.ts` (same file, add fields) | self-analog (extend existing) |

## Pattern Assignments

### `backend/game/session.py` (service, event-driven)

**Role:** Server-authoritative game state machine. Singleton `GameSession` class with async `run()` coroutine launched via `asyncio.create_task()`. Manages 9-round game flow with server-authoritative timer, proximity scoring, and event broadcasting via ConnectionManager.

**Data flow:** Event-driven -- receives `submit_answer` calls from WebSocket dispatcher, broadcasts `timer_tick`, `round_started`, `round_result`, `score_update`, `game_end` events.

**Analog:** `backend/connection_manager.py` (service, event-driven)

**Imports pattern** (lines 1-8 of connection_manager.py):
```python
import asyncio
from typing import Optional

from fastapi import WebSocket
```

For session.py, the imports follow the same stdlib-first convention:
```python
import asyncio
from typing import Optional

from connection_manager import ConnectionManager
from models import GameSession as GameSessionModel, Round, Stat
```

**Singleton pattern analog** (connection_manager.py lines 8-13):
```python
class ConnectionManager:
    def __init__(self):
        self.player1: Optional[WebSocket] = None
        self.player2: Optional[WebSocket] = None
        self.admin: Optional[WebSocket] = None
        self.player1_nickname: Optional[str] = None
        self.player2_nickname: Optional[str] = None
```

GameSession follows the same class-based singleton pattern (02-RESEARCH.md lines 205-235):
```python
class GameSession:
    """Server-authoritative game state machine. Singleton -- one game at a time."""

    def __init__(self, manager: ConnectionManager, session_factory):
        self.manager = manager
        self.session_factory = session_factory
        self.state = "waiting_for_players"
        self.questions: list = []
        self.current_round: int = 0
        self.p1_score: int = 0
        self.p2_score: int = 0
        self.p1_answer: Optional[int] = None
        self.p2_answer: Optional[int] = None
        self.round_results: list[dict] = []
        # Synchronisation primitives
        self.start_event = asyncio.Event()
```

**Broadcast pattern analog** (connection_manager.py lines 28-30):
```python
async def broadcast(self, message: dict):
    tasks = [ws.send_json(message) for ws in self.all_connections]
    await asyncio.gather(*tasks, return_exceptions=True)
```

GameSession calls `self.manager.broadcast()`, `self.manager.send_to_players()`, `self.manager.send_to_admin()` -- it does NOT implement its own broadcasting. The ConnectionManager's `asyncio.gather()` pattern is reused directly.

**Targeted send pattern analog** (connection_manager.py lines 40-54):
```python
async def send_to_players(self, message: dict):
    tasks = []
    if self.player1:
        tasks.append(self.player1.send_json(message))
    if self.player2:
        tasks.append(self.player2.send_json(message))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

async def send_to_admin(self, message: dict):
    if self.admin:
        try:
            await self.admin.send_json(message)
        except Exception:
            pass
```

**Game loop pattern** (from 02-RESEARCH.md lines 239-244, synthesized from decisions D-07 through D-17):
```python
async def run(self, questions: list):
    """Main game loop. Launched via asyncio.create_task()."""
    self.questions = questions
    self.state = "ready"
    await self.manager.broadcast({
        "event": "game_started",
        "data": {
            "player1_nickname": self.manager.player1_nickname or "",
            "player2_nickname": self.manager.player2_nickname or "",
        }
    })

    # Wait for admin to start
    await self.start_event.wait()
    self.start_event.clear()

    for round_num in range(1, 10):
        self.current_round = round_num
        question = self.questions[round_num - 1]
        await self._run_round(question)

    await self._finish_game()
```

**Round execution with timer** (from 02-RESEARCH.md lines 246-300):
```python
async def _run_round(self, question):
    """Execute a single round: present question, tick timer, show result."""
    self.p1_answer = None
    self.p2_answer = None
    self.state = "presenting_question"

    # Broadcast round_started to all
    await self.manager.broadcast({
        "event": "round_started",
        "data": {
            "round_number": self.current_round,
            "total_rounds": 9,
            "question_text": question.text,
        }
    })
    self.state = "accepting_answers"

    # Timer: 10 seconds, tick every 1 second
    for remaining in range(10, -1, -1):
        await self.manager.broadcast({
            "event": "timer_tick",
            "data": {"remaining": remaining}
        })
        if remaining > 0:
            await asyncio.sleep(1)

    # Timer expired -- compute result
    self.state = "showing_result"
    result = self._compute_round_result(question)
    self.round_results.append(result)

    # Broadcast round_result to all
    await self.manager.broadcast({
        "event": "round_result",
        "data": result
    })

    # Update scores
    if result["winner"] == "player1":
        self.p1_score += 1
    elif result["winner"] == "player2":
        self.p2_score += 1

    # Broadcast score_update to admin only
    await self.manager.send_to_admin({
        "event": "score_update",
        "data": {
            "player1_score": self.p1_score,
            "player2_score": self.p2_score,
            "round_number": self.current_round,
        }
    })

    # 3-second pause between rounds
    await asyncio.sleep(3)
```

**Answer collection pattern** (from 02-RESEARCH.md lines 302-309):
```python
def submit_answer(self, player_num: int, answer: int):
    """Called from the WebSocket event dispatcher. First answer per player wins."""
    if self.state != "accepting_answers":
        return  # Round not active
    if player_num == 1 and self.p1_answer is None:
        self.p1_answer = answer
    elif player_num == 2 and self.p2_answer is None:
        self.p2_answer = answer
```

**Proximity scoring pattern** (from 02-RESEARCH.md lines 311-338):
```python
def _compute_round_result(self, question) -> dict:
    """Compute winner by absolute difference proximity scoring."""
    correct = question.answer

    def diff(answer):
        if answer is None:
            return float("inf")
        if not isinstance(answer, int) or answer < 0 or answer > 1_000_000:
            return float("inf")
        return abs(answer - correct)

    d1 = diff(self.p1_answer)
    d2 = diff(self.p2_answer)

    if d1 < d2:
        winner = "player1"
    elif d2 < d1:
        winner = "player2"
    else:
        winner = "draw"

    return {
        "round_number": self.current_round,
        "correct_answer": correct,
        "player1_answer": self.p1_answer if self.p1_answer is not None else None,
        "player2_answer": self.p2_answer if self.p2_answer is not None else None,
        "winner": winner,
    }
```

**Game end + shielded persistence pattern** (from 02-RESEARCH.md lines 340-374, with _persist_game from lines 594-626):
```python
async def _finish_game(self):
    """Broadcast game_end with full results and persist to SQLite."""
    self.state = "finished"

    if self.p1_score > self.p2_score:
        winner = self.manager.player1_nickname
    elif self.p2_score > self.p1_score:
        winner = self.manager.player2_nickname
    else:
        winner = None  # "Ничья"

    game_end_data = {
        "player1_nickname": self.manager.player1_nickname or "",
        "player2_nickname": self.manager.player2_nickname or "",
        "player1_score": self.p1_score,
        "player2_score": self.p2_score,
        "winner": winner,
        "rounds": [
            {
                "round_number": r["round_number"],
                "winner": r["winner"],
                "player1_answer": r["player1_answer"],
                "player2_answer": r["player2_answer"],
            }
            for r in self.round_results
        ],
    }

    await self.manager.broadcast({
        "event": "game_end",
        "data": game_end_data,
    })

    # Shield-protected DB persistence
    await asyncio.shield(self._persist_game())

async def _persist_game(self):
    """Persist game results to SQLite. Wrapped in shield to survive task cancellation."""
    async with self.session_factory() as db:
        game_session = models.GameSession(
            player1_nickname=self.manager.player1_nickname,
            player2_nickname=self.manager.player2_nickname,
            player1_score=self.p1_score,
            player2_score=self.p2_score,
            winner_nickname=winner,
            ended_at=datetime.now(timezone.utc),
        )
        db.add(game_session)
        await db.flush()

        for r in self.results:
            round_record = models.Round(
                game_session_id=game_session.id,
                question_id=self.questions[r["round_number"] - 1].id,
                round_number=r["round_number"],
                player1_answer=r["player1_answer"],
                player2_answer=r["player2_answer"],
                winner={"player1": 1, "player2": 2, "draw": None}.get(r["winner"]),
            )
            db.add(round_record)

        stat = await db.execute(select(models.Stat).limit(1))
        stat_record = stat.scalar_one_or_none()
        if stat_record:
            stat_record.game_count += 1

        await db.commit()
```

---

### `backend/game/__init__.py` (config, N/A)

**Analog:** `backend/__init__.py`

**Pattern:** Empty file. All existing `__init__.py` files in the backend (`backend/__init__.py`, `backend/services/__init__.py`, `backend/routers/__init__.py`) are empty. The `game/` package init follows the same convention.

---

### `backend/game/tokens.py` (utility, request-response)

**Role:** In-memory session token store for JOIN-05 reconnect support. Module-level dict with `generate_token()` and `restore_from_token()` functions.

**No close codebase analog.** This is a standard Python module-level dict pattern. Pattern source: 02-RESEARCH.md lines 629-653.

**Imports pattern:**
```python
import uuid
```

**Core pattern** (from 02-RESEARCH.md lines 634-653):
```python
# Module-level store
_reconnect_tokens: dict[str, dict] = {}

def generate_token(nickname: str, role: str) -> str:
    token = uuid.uuid4().hex
    _reconnect_tokens[token] = {"nickname": nickname, "role": role}
    return token

def restore_from_token(token: str) -> dict | None:
    return _reconnect_tokens.get(token)
```

**Alternative:** This logic can live directly in `backend/main.py` as module-level globals alongside `manager` and `active_session`. The CONTEXT.md lists `tokens.py` as optional. The token store is simple enough (3 functions, 1 dict) to inline in `main.py`.

---

### `backend/main.py` (controller, event-driven + request-response)

**Role:** FastAPI application entry point. Existing file extended to dispatch game events from the WebSocket receive loop to the active GameSession. Owns global references to `active_session: Optional[GameSession]` and `game_task: Optional[asyncio.Task]`.

**Analog:** Existing `backend/main.py` (self-analog -- extends lines 48-105)

**Existing imports pattern** (lines 1-11, UNCHANGED -- keep existing):
```python
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from connection_manager import ConnectionManager
from models import Base
from routers import questions as questions_router
```

**New imports to add** (after existing imports):
```python
from typing import Optional

from game.session import GameSession
# Optional: from game.tokens import generate_token, restore_from_token
```

**New global variables** (after `manager = ConnectionManager()` on line 13):
```python
manager = ConnectionManager()
active_session: Optional[GameSession] = None
game_task: Optional[asyncio.Task] = None
# Optional in-memory session token store:
_session_tokens: dict[str, dict] = {}
```

**Extended WebSocket endpoint pattern** -- modify the `while True` event loop (lines 93-94 currently empty `receive_json()`):

Current pattern (lines 93-94):
```python
while True:
    await websocket.receive_json()
```

Extended pattern (from 02-RESEARCH.md lines 416-436):
```python
# Event dispatch loop (extended from Phase 1 passive loop)
while True:
    msg = await websocket.receive_json()
    event = msg.get("event")
    payload = msg.get("data", {})

    if websocket == manager.player1 or websocket == manager.player2:
        player_num = 1 if websocket == manager.player1 else 2
        if event == "submit_answer":
            answer = payload.get("answer")
            if isinstance(answer, int) and 0 <= answer <= 1_000_000:
                if active_session:
                    active_session.submit_answer(player_num, answer)

    elif websocket == manager.admin:
        if event == "start_game" and active_session:
            if active_session.state == "ready":
                active_session.start_event.set()
        elif event == "restart":
            await _reset_game(websocket)
```

**Disconnect cleanup pattern** (extend existing lines 96-104):
```python
except WebSocketDisconnect:
    if manager.player1 == websocket:
        manager.player1 = None
        manager.player1_nickname = None
    elif manager.player2 == websocket:
        manager.player2 = None
        manager.player2_nickname = None
    elif manager.admin == websocket:
        manager.admin = None
        # If admin disconnects mid-game, consider cancelling the game task
        if game_task and not game_task.done():
            game_task.cancel()
```

**Session token in joined response** -- add `token` field to the `joined` event sent to players (modify existing lines 87-90):
```python
# After assigning player1 or player2 (around line 87-90):
import uuid
token = uuid.uuid4().hex
_session_tokens[token] = {"nickname": nickname, "role": "player"}
await websocket.send_json({
    "event": "joined",
    "data": {
        "player_number": player_num,
        "nickname": nickname,
        "token": token,  # ADD for reconnect
    }
})
```

---

### `frontend/src/types/ws.ts` (model/utility, N/A)

**Role:** TypeScript interfaces for WebSocket event types. Extended with game event types for Phase 2. Phase 3 (Player Frontend) will consume these.

**Analog:** Existing `frontend/src/types/ws.ts` (self-analog -- add game event types)

**Existing pattern** (lines 1-28, UNCHANGED -- keep existing types):
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

**New types to add** (after existing types):
```typescript
// Phase 2: Game event types
export interface SubmitAnswer extends WsMessage {
  event: "submit_answer";
  data: {
    answer: number;
  };
}

export interface StartGame extends WsMessage {
  event: "start_game";
  data: Record<string, never>;
}

export interface Restart extends WsMessage {
  event: "restart";
  data: Record<string, never>;
}

// Server events
export interface GameStartedEvent extends WsMessage {
  event: "game_started";
  data: {
    player1_nickname: string;
    player2_nickname: string;
  };
}

export interface RoundStartedEvent extends WsMessage {
  event: "round_started";
  data: {
    round_number: number;
    total_rounds: number;
    question_text: string;
  };
}

export interface TimerTickEvent extends WsMessage {
  event: "timer_tick";
  data: {
    remaining: number;
  };
}

export interface RoundResultEvent extends WsMessage {
  event: "round_result";
  data: {
    round_number: number;
    correct_answer: number;
    player1_answer: number | null;
    player2_answer: number | null;
    winner: "player1" | "player2" | "draw";
  };
}

export interface ScoreUpdateEvent extends WsMessage {
  event: "score_update";
  data: {
    player1_score: number;
    player2_score: number;
    round_number: number;
  };
}

export interface GameEndEvent extends WsMessage {
  event: "game_end";
  data: {
    player1_nickname: string;
    player2_nickname: string;
    player1_score: number;
    player2_score: number;
    winner: string | null;
    rounds: Array<{
      round_number: number;
      winner: "player1" | "player2" | "draw";
      player1_answer: number | null;
      player2_answer: number | null;
    }>;
  };
}
```

---

### `frontend/src/stores/gameStore.ts` (store, event-driven)

**Role:** Zustand store for client-side game state. Extended with game phase, scores, player info, timer fields. Will be fully consumed by Phase 3 (Player Frontend).

**Analog:** Existing `frontend/src/stores/gameStore.ts` (self-analog -- add game state fields)

**Existing pattern** (lines 1-9, EXTEND):
```typescript
import { create } from "zustand";

interface GameState {
  phase: string;
}

export const useGameStore = create<GameState>((set) => ({
  phase: "idle",
}));
```

**Extended store pattern:**
```typescript
import { create } from "zustand";

interface GameState {
  phase: string;
  playerNumber: 1 | 2 | null;
  player1Nickname: string;
  player2Nickname: string;
  player1Score: number;
  player2Score: number;
  currentRound: number;
  totalRounds: number;
  questionText: string;
  remaining: number;
  // Phase 3 will add: wsConnection, submittedAnswer, roundResult, gameEndResult
}

interface GameActions {
  setPhase: (phase: string) => void;
  setPlayerNumber: (num: 1 | 2 | null) => void;
  setGameStarted: (p1: string, p2: string) => void;
  setRoundStarted: (round: number, total: number, text: string) => void;
  setTimer: (remaining: number) => void;
  setScoreUpdate: (p1Score: number, p2Score: number) => void;
  reset: () => void;
}

type GameStore = GameState & GameActions;

const initialState: GameState = {
  phase: "idle",
  playerNumber: null,
  player1Nickname: "",
  player2Nickname: "",
  player1Score: 0,
  player2Score: 0,
  currentRound: 0,
  totalRounds: 9,
  questionText: "",
  remaining: 10,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setPlayerNumber: (num) => set({ playerNumber: num }),
  setGameStarted: (p1, p2) =>
    set({
      phase: "playing",
      player1Nickname: p1,
      player2Nickname: p2,
    }),
  setRoundStarted: (round, total, text) =>
    set({
      currentRound: round,
      totalRounds: total,
      questionText: text,
      remaining: 10,
    }),
  setTimer: (remaining) => set({ remaining }),
  setScoreUpdate: (p1Score, p2Score) =>
    set({
      player1Score: p1Score,
      player2Score: p2Score,
    }),
  reset: () => set(initialState),
}));
```

---

## Shared Patterns

### 1. Server-Authoritative Game Loop with asyncio.create_task()

**Source:** 02-RESEARCH.md lines 191-235 (Pattern 1: GameSession State Machine)
**Apply to:** `backend/game/session.py` (GameSession.run()), `backend/main.py` (admin start_game handler)

The game loop runs as an independent asyncio Task, not tied to any WebSocket lifecycle. The task is launched via `asyncio.create_task()` from the admin `start_game` handler. The task reference is stored as a module-level variable for lifecycle management (cancel on restart/disconnect).

```python
# In main.py admin handler:
if event == "start_game" and active_session:
    if active_session.state == "ready":
        active_session.start_event.set()

# Creation happens before wait in some other admin handler:
questions = await QuestionService.random_selection(db, 9)
active_session = GameSession(manager, app.state.session_factory)
game_task = asyncio.create_task(active_session.run(questions))
```

### 2. asyncio.Event for Admin Start Signal

**Source:** 02-RESEARCH.md lines 191-235 (Pattern 1), lines 484-486 (Don't Hand-Roll)
**Apply to:** `backend/game/session.py`

The GameSession awaits `self.start_event.wait()` before entering the round loop. The admin's WebSocket handler calls `active_session.start_event.set()` to signal the game to begin. Both run in the same event loop, so no thread-safety issues.

```python
# In GameSession.__init__:
self.start_event = asyncio.Event()

# In GameSession.run():
await self.start_event.wait()
self.start_event.clear()

# In main.py (admin WebSocket handler):
if event == "start_game" and active_session:
    if active_session.state == "ready":
        active_session.start_event.set()
```

### 3. asyncio.shield() for Critical DB Persistence

**Source:** 02-RESEARCH.md lines 510-518 (Pitfall 3), lines 591-626 (Code Examples)
**Apply to:** `backend/game/session.py` (_persist_game)

Critical SQLite writes at game end must be protected from task cancellation. If a client disconnects during `_persist_game()`, the cancellation propagates and interrupts the DB transaction. `asyncio.shield()` prevents this.

```python
await asyncio.shield(self._persist_game())
```

### 4. First-Answer-Wins Policy for Answer Collection

**Source:** 02-RESEARCH.md lines 302-309 (Pattern 1: submit_answer), D-12 decision
**Apply to:** `backend/game/session.py`

Both `submit_answer()` validation and the WebSocket dispatcher validate answers. The dispatcher checks type and range (0-1,000,000). `submit_answer()` only accepts already-validated ints and enforces first-answer-wins via `self.p1_answer is None` checks.

```python
# In main.py WebSocket dispatcher (validate):
if isinstance(answer, int) and 0 <= answer <= 1_000_000:
    if active_session:
        active_session.submit_answer(player_num, answer)

# In GameSession.submit_answer() (enforce first-wins):
if self.state == "accepting_answers":
    if player_num == 1 and self.p1_answer is None:
        self.p1_answer = answer
    elif player_num == 2 and self.p2_answer is None:
        self.p2_answer = answer
```

### 5. asyncio.gather() for Parallel Broadcast

**Source:** `backend/connection_manager.py` lines 28-30, 02-RESEARCH.md lines 581-588
**Apply to:** `backend/game/session.py` (via ConnectionManager methods)

GameSession does NOT implement its own broadcast logic. It delegates to ConnectionManager which already uses `asyncio.gather(*tasks, return_exceptions=True)`. This pattern is reused as-is -- GameSession passes dict messages to `self.manager.broadcast()`, `self.manager.send_to_players()`, `self.manager.send_to_admin()`.

### 6. Proximity Scoring with Absolute Difference

**Source:** 02-RESEARCH.md lines 535-554 (Scoring Function), 02-RESEARCH.md lines 311-338
**Apply to:** `backend/game/session.py` (_compute_round_result)

```python
def diff(answer):
    if answer is None:
        return float("inf")
    return abs(answer - correct)

d1 = diff(p1_answer)
d2 = diff(p2_answer)

if d1 < d2: return "player1"
elif d2 < d1: return "player2"
else: return "draw"
```

### 7. Route Ordering (API Before StaticFiles) -- UNCHANGED

**Source:** `backend/main.py` lines 42-107, 01-PATTERNS.md Shared Pattern 2
**Apply to:** `backend/main.py`

Already established in Phase 1. No changes needed. The ordering remains:
1. API routes (`app.include_router`)
2. WebSocket endpoint (`@app.websocket`)
3. StaticFiles mount (LAST)

### 8. Request Validation Separation

**Source:** 02-RESEARCH.md lines 681-684 (Open Question 2)
**Apply to:** `backend/main.py` WebSocket dispatcher, `backend/game/session.py` submit_answer()

Validation of answer format (type, range) happens in the WebSocket dispatcher in `main.py`. Only validated ints reach `submit_answer()`. This keeps GameSession focused on game logic.

```python
# main.py: validate first
if isinstance(answer, int) and 0 <= answer <= 1_000_000:
    active_session.submit_answer(player_num, answer)
# else: silently ignore (treated as no answer per D-12)

# session.py: accepts only valid ints
def submit_answer(self, player_num: int, answer: int):
    # answer is guaranteed to be int in 0..1_000_000
    ...
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/game/tokens.py` | utility | request-response | Module-level dict pattern is a standard Python idiom not represented by any existing codebase file. Pattern source is 02-RESEARCH.md lines 629-653. |

## Metadata

**Analog search scope:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/`, `/home/petr/IdeaProjects/PetProjects/number_game/frontend/src/`
**Files scanned:** 10 (6 Python backend, 2 TypeScript frontend, 2 config)
**Pattern extraction date:** 2026-05-30
**Pattern source:** Existing Phase 1 codebase (connection_manager.py, main.py, models.py, question_service.py, ws.ts, gameStore.ts) + 02-RESEARCH.md (Pattern 1: GameSession, Pattern 2: WebSocket Dispatcher Extension, Pattern 3: Session Tokens, Code Examples)
