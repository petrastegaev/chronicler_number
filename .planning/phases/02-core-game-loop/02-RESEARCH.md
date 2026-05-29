# Phase 2: Core Game Loop - Research

**Researched:** 2026-05-30
**Domain:** Server-authoritative game state machine, WebSocket game protocol, proximity scoring
**Confidence:** HIGH

## Summary

Phase 2 builds the heart of the product: a server-authoritative game state machine that drives 9 rounds of numeric gameplay. The `GameSession` class (async, class-based) manages a linear state machine with per-round sub-states, broadcasting `timer_tick`, `round_started`, `round_result`, and `game_end` events via the existing `ConnectionManager`. The server runs a 10-second countdown via `asyncio.sleep(1)` loop, collects integer answers silently (first submission per player per round locks in), computes round winners by absolute difference proximity scoring, and persists results to SQLite at game end.

The existing WebSocket handler in `main.py` must be extended from a passive `receive_json()` loop into an event dispatcher that routes `submit_answer` (from players) and `start_game`/`restart` (from admin) to the active `GameSession`. The `GameSession` is a singleton, created at game start and destroyed on restart, launched via `asyncio.create_task()`. Critical cleanup operations (SQLite persistence at game end) must use `asyncio.shield()` to survive task cancellation on WebSocket disconnect.

Game flow synchronisation uses `asyncio.Event` or a message queue pattern: the `GameSession.run()` coroutine waits for the admin to send `start_game`, then advances through 9 rounds with a 3-second pause between each. Scoring is simple: absolute difference to correct answer determines the round winner (1 point), ties award 0 points. After round 9, the `game_end` event carries full results including round-by-round summaries.

**Primary recommendation:** Build `GameSession` as a standalone class in `backend/game/session.py` with explicit state transitions, an `asyncio.Event`-based wait for external inputs (admin start, player answers), and shield-protected SQLite writes. Extend `main.py` to dispatch WebSocket messages by event type and player role. Store all 9 questions in memory at game start. Use single-threaded asyncio throughout -- no threading, no multiprocessing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Timer Implementation
- **D-01:** Server broadcasts `timer_tick` event every 1 second for the full 10-second round duration. Server-authoritative, prevents client clock manipulation.
- **D-02:** Client-side audio switch to `tick_fast` when remaining time <= 3 seconds. Server continues sending ticks at 1/second rate throughout -- no server-side rate change.
- **D-03:** Answer is auto-captured on timer expiry -- whatever is in the input field at expiry. No explicit submit button required (though one may exist for early submission).
- **D-04:** Round always uses the full 10 seconds. If a player submits early, their answer is locked in but the timer continues for both players until expiry.
- **D-05:** Server tracks timer internally with `asyncio.sleep(1)` loop. Drift (~1-5ms/tick) is negligible for a 10-second round.
- **D-06:** If a player disconnects mid-round, the round continues. On reconnect, server sends current state snapshot (remaining time, current question). If they reconnect after round ended, they receive `round_result`.

#### Game State Machine Design
- **D-07:** Class-based `GameSession` with async `run()` coroutine, launched via `asyncio.create_task()`. Clean separation from the WebSocket handler. Holds references to `ConnectionManager` for broadcasting and `async_sessionmaker` for DB writes.
- **D-08:** Linear state machine with round sub-states:
  - `waiting_for_players` -> both players connected, waiting for admin
  - `ready` -> both players ready, admin can start
  - `in_progress` -> round loop with sub-states:
    - `presenting_question` -> broadcast `round_started`, begin ticks
    - `accepting_answers` -> timer running, accepting submissions
    - `showing_result` -> broadcast `round_result`, 3-second pause
  - `finished` -> broadcast `game_end`, persist results, wait for restart
- **D-09:** Singleton `GameSession` -- exactly one game at a time. Global module-level reference to the active session.
- **D-10:** Admin restart destroys the current `GameSession`, broadcasts reset to all clients, and returns to `waiting_for_players` state. Both players must remain connected (no need to re-join WebSocket).

#### WebSocket Event Protocol
- **D-11:** Server sends explicit `round_started` event before timer ticks begin. Payload: `{"event": "round_started", "data": {"round_number": N, "total_rounds": 9, "question_text": "..."}}`. Correct answer is NEVER sent to players.
- **D-12:** Player submits answer via `{"event": "submit_answer", "data": {"answer": int}}`. First answer wins -- subsequent submissions from the same player in the same round are silently ignored. Server validates answer is integer 0-1,000,000; invalid answers treated as no answer.
- **D-13:** `round_result` is the same payload broadcast to both players: `{"event": "round_result", "data": {"round_number": N, "correct_answer": int, "player1_answer": int|null, "player2_answer": int|null, "winner": "player1"|"player2"|"draw"}}`. Each client highlights its own answer.
- **D-14:** Admin triggers game start with `{"event": "start_game"}` (no payload). Server broadcasts `{"event": "game_started", "data": {"player1_nickname": "...", "player2_nickname": "..."}}` to all connections.

#### Round Flow Timing
- **D-15:** Fixed 3-second pause between `round_result` broadcast and next `round_started`. Server uses `asyncio.sleep(3)`. During this pause, players view the result overlay.
- **D-16:** After round 9 `round_result`, same 3-second delay, then single `game_end` event: `{"event": "game_end", "data": {"player1_nickname": "...", "player2_nickname": "...", "player1_score": int, "player2_score": int, "winner": "..."|null, "rounds": [{"round_number": 1, "winner": "...", "player1_answer": int|null, "player2_answer": int|null}, ...]}}`. Winner is `null` for draws ("Ничья").
- **D-17:** Admin receives all game events (`timer_tick`, `round_started`, `round_result`, `game_end`) plus a `score_update` event after each `round_result`: `{"event": "score_update", "data": {"player1_score": int, "player2_score": int, "round_number": int}}`.

### Claude's Discretion

No areas were deferred to Claude -- all decisions were explicitly selected by the user.

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOIN-02 | Server assigns roles in order of connection -- first player gets "Игрок 1", second gets "Игрок 2" | **Completed in Phase 1** -- `connection_manager.py` assigns `player1`/`player2` slots in connection order. No changes needed in Phase 2. |
| JOIN-05 | Player nickname is stored in server memory and preserved on WebSocket reconnect via session cookie | Server-side session token pattern: generate UUID on join, store in memory dict `{token: {nickname, role}}`, send token to client. Client passes token as query param or first message on reconnect. Server looks up and restores role/nickname. See DON'T HAND-ROLL and Code Examples sections. |
| GAME-02 | Each round has a 10-second server-authoritative countdown timer broadcast via WebSocket `timer_tick` events every second | `asyncio.sleep(1)` loop in GameSession broadcasts `timer_tick` with `remaining` field. 11 ticks (10 down to 0). Uses `asyncio.gather()` for parallel sends. See Architecture Patterns section. |
| GAME-04 | Player answers are NOT broadcast to the opponent mid-round (prevents cheating) | GameSession stores answers in instance variables (`self.p1_answer`, `self.p2_answer`). No broadcast on receipt. Both answers revealed simultaneously in `round_result` after timer expiry. See Pitfall section for enforcement strategy. |
| GAME-05 | After timer expires, server computes round winner by absolute difference to correct answer and broadcasts `round_result` | Proximity scoring: `abs(player_answer - correct_answer)`. Smaller is better. Same `round_result` payload sent to both players. Winner determination in Code Examples section. |
| GAME-07 | 9 random questions drawn without replacement from the question pool per game session | `QuestionService.random_selection(9)` via `ORDER BY RANDOM() LIMIT 9`. Called once at game start. Questions stored in `self.questions` list for the session duration. |
| GAME-08 | Round winner gets 1 point; ties split 0 points each | Each round winner gets +1. Ties (equal absolute difference) award 0 to both. Total after 9 rounds determines game winner. Draw ("Ничья") if scores are tied after round 9. |
| GAME-09 | After 9 rounds, `game_end` event sent with final scores and winner announcement (or "Ничья") | Single `game_end` event with: scores, winner/null for draw, full round-by-round summary array. Same 3-second delay as regular round transitions. Shield-protected SQLite persistence of `GameSession` + 9 `Round` records + increment `Stat.game_count`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timer countdown | Backend (GameSession) | Browser (display only) | Server-authoritative timer prevents clock manipulation. Browser only renders `remaining` from `timer_tick`. |
| Answer collection | Backend (GameSession) | Browser (input capture) | Server stores and validates answers. Browser only collects input and sends on timer expiry. |
| Answer secrecy (mid-round) | Backend (GameSession) | -- | Server NEVER broadcasts answers mid-round. Only `round_result` after timer expiry contains both answers. |
| Scoring computation | Backend (GameSession) | -- | Proximity scoring by absolute difference. Pure server logic -- no client involvement. |
| Question selection | Backend (QuestionService) | -- | `random_selection(9)` called once at game start. No client involvement. |
| Game state persistence | Backend (GameSession + SQLite) | -- | SQLite writes at game end only. Shielded from task cancellation. |
| Session cookie / reconnect | Backend (ConnectionManager) | Browser (cookie storage / query param) | Server generates and validates session tokens. Client stores and re-sends on reconnect. |
| Admin game control | Backend (WebSocket handler) | Admin browser (send events) | Server dispatches `start_game`/`restart` from admin WebSocket. Admin UI built in Phase 4. |

## Standard Stack

No new libraries are needed for Phase 2. The implementation uses only:
- Python 3.12+/3.13 stdlib: `asyncio`, `uuid`, `dataclasses`
- Existing dependencies: FastAPI, SQLAlchemy, ConnectionManager, QuestionService

### Core

| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `asyncio` | stdlib | Game loop scheduling, timer, task management | Built-in async framework used by FastAPI. `asyncio.create_task()` for game loop, `asyncio.sleep()` for timer, `asyncio.Event` for state synchronization, `asyncio.shield()` for critical DB writes. |
| `GameSession` class | Phase 2 | Server-authoritative state machine | Clean separation from WebSocket handler. Holds references to ConnectionManager and async_sessionmaker. Launched via `asyncio.create_task()`. |
| `ConnectionManager` | Phase 1 | Message broadcasting | D-08: `asyncio.gather()` for parallel multi-client sends. Phase 2 calls `broadcast()`, `send_to_players()`, `send_to_admin()`. |
| `QuestionService.random_selection()` | Phase 1 | Random question draw | `ORDER BY RANDOM() LIMIT 9`. Already async. Called at game start. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `asyncio.Event` for admin start signal | `asyncio.Condition` or direct method call | `Event` is simpler: admin calls `game_session.start_event.set()`, GameSession awaits `start_event.wait()`. Direct method call via a thread-safe queue is also valid. Event preferred for single-threaded asyncio. |
| In-memory answer dict per round | SQLite write per round | Avoids SQLite write contention during active round. Game state is in memory; only game end persists to SQLite. |
| UUID session token | JWT or opaque cookie | UUID is sufficient for local WiFi booth. No signing needed -- collision odds are negligible. No JWT library dependency. |

## Architecture Patterns

### System Architecture Diagram

```
Admin WebSocket                        Player 1 WebSocket              Player 2 WebSocket
       |                                      |                              |
       v                                      v                              v
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FastAPI /ws endpoint                                │
│  (accept connection → parse role → dispatch events)                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    Event Dispatcher (per connection)                │     │
│  │                                                                     │     │
│  │  admin_conn: ["start_game", "restart"] → GameSession                │     │
│  │  player_conn: ["submit_answer"] → GameSession.submit_answer()       │     │
│  │  disconnect → ConnectionManager cleanup (if mid-round, continue)    │     │
│  └──────────────────────────┬─────────────────────────────────────────┘     │
│                             │                                                 │
│                             v                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    GameSession (singleton)                         │     │
│  │                                                                     │     │
│  │  run() ─► for round in 1..9:                                       │     │
│  │    │  broadcast(round_started)                                      │     │
│  │    │  broadcast(timer_tick...) × 10 sec                             │     │
│  │    │  compute_result()                                              │     │
│  │    │  broadcast(round_result)                                       │     │
│  │    │  broadcast(score_update) [admin only]                          │     │
│  │    │  sleep(3)                                                      │     │
│  │    └─────────────────────────────────────────────────────────┐     │     │
│  │  broadcast(game_end)                                          │     │     │
│  │  persist_to_db()                                              │     │     │
│  └──────────────────────────┬─────────────────────────────────────┘     │     │
│                             │                                              │     │
│                             v                                              │     │
│  ┌────────────────────────────────────────────────────────────────────┐  │     │
│  │  ConnectionManager                                                 │  │     │
│  │  broadcast(), send_to_players(), send_to_admin() via gather()      │  │     │
│  └──────────────────────────┬─────────────────────────────────────────┘  │     │
│                             │                                              │     │
│                             v                                              │     │
│  ┌────────────────────────────────────────────────────────────────────┐  │     │
│  │  SQLite (at game end only)                                        │  │     │
│  │  GameSession record + 9 Round records + Stat.game_count++          │  │     │
│  └────────────────────────────────────────────────────────────────────┘  │     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Phase 2 adds a new `game/` package and modifies existing files:

```
backend/
├── main.py                       # MODIFIED — extended WS message dispatch
├── game/                         # NEW package
│   ├── __init__.py
│   ├── session.py                # GameSession class (state machine, round loop, timer, scoring)
│   └── tokens.py                 # Session token store for JOIN-05 (optional, can live in main.py)
├── connection_manager.py         # UNCHANGED — Phase 1
├── models.py                     # UNCHANGED — Phase 1 (schema already includes GameSession, Round, Stat)
├── services/
│   └── question_service.py       # UNCHANGED — Phase 1
└── routers/
    └── questions.py              # UNCHANGED — Phase 1

frontend/src/
├── types/
│   └── ws.ts                     # MODIFIED — add game event types
└── stores/
    └── gameStore.ts              # MODIFIED — add game state fields (Phase 3 will fully implement)
```

### Pattern 1: GameSession State Machine with asyncio.Event Synchronization

**What:** The GameSession `run()` coroutine is a linear state machine. It awaits `asyncio.Event` for the admin start signal and stores answers in instance variables filled by the WebSocket event dispatcher (running concurrently via `create_task`).

**When to use:** Required for any server-authoritative game loop in a single-process asyncio server. The `Event` pattern decouples the game loop from the WebSocket receive loop while keeping everything in the same event loop.

**Example:**
```python
# Source: Synthesized from FastAPI WebSocket patterns and the project's locked decisions D-07 through D-09

import asyncio
from typing import Optional

from connection_manager import ConnectionManager


class GameSession:
    """Server-authoritative game state machine. Singleton — one game at a time."""

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
        self._answer_received = asyncio.Event()

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

        # Timer expired — compute result
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

    def submit_answer(self, player_num: int, answer: int):
        """Called from the WebSocket event dispatcher. First answer per player wins."""
        if self.state != "accepting_answers":
            return  # Round not active
        if player_num == 1 and self.p1_answer is None:
            self.p1_answer = answer
        elif player_num == 2 and self.p2_answer is None:
            self.p2_answer = answer

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
```

### Pattern 2: WebSocket Event Dispatcher Extension in main.py

**What:** The existing passive `receive_json()` loop in the WebSocket handler is extended to dispatch game events based on the sender's role.

**When to use:** Required when the WebSocket connection serves multiple purposes (join + game events). The role is determined at connection time; subsequent messages are routed accordingly.

**Example:**
```python
# Source: Synthesized from Phase 1 code and locked decisions D-08, D-09, D-10, D-12, D-14

# In main.py — modified WebSocket endpoint

# Global GameSession reference (singleton per D-09)
active_session: Optional[GameSession] = None

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        data = await websocket.receive_json()
        if data.get("event") == "join":
            role = data.get("data", {}).get("role")
            nickname = data.get("data", {}).get("nickname", "")
            # ... existing join logic (Phase 1) ...
            # Generate session token for JOIN-05
            token = str(uuid.uuid4())
            session_tokens[token] = {"nickname": nickname, "role": role}
            await websocket.send_json({
                "event": "joined",
                "data": {
                    "role": role,
                    "player_number": player_num,
                    "nickname": nickname,
                    "token": token,  # for reconnect
                }
            })

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
                    # Destroy current session, return to lobby
                    await _reset_game(websocket)

    except WebSocketDisconnect:
        # ... cleanup logic (Phase 1) ...
```

### Pattern 3: Session Token for JOIN-05 (Nickname Reconnect)

**What:** Generate a UUID token on initial join, store in a dict `{token: {nickname, role}}`. Send token to client in the `joined` event response. On reconnect, the client passes the token as a query parameter; server looks it up to restore nickname and role.

**When to use:** Simple, stateless-compatible reconnect for a local WiFi booth game. No database writes, no cookie manipulation. The token dict is in memory -- lost on server restart but acceptable for a booth demo.

**Example:**
```python
# Source: FastAPI WebSocket reconnect patterns (WebSearch 2025-2026)

import uuid

# In-memory session store
session_tokens: dict[str, dict] = {}

# On initial join:
token = str(uuid.uuid4())
session_tokens[token] = {"nickname": nickname, "role": role}
await websocket.send_json({
    "event": "joined",
    "data": {"role": role, "player_number": player_num, "nickname": nickname, "token": token}
})

# On reconnect (check query param):
# Client: ws://server-ip:8000/ws?token=xxx
token = websocket.query_params.get("token")
if token and token in session_tokens:
    restored = session_tokens[token]
    # Re-assign to same role slot
    # ...
```

### Anti-Patterns to Avoid

- **Sequential `await ws.send()` per connection:** Always use `asyncio.gather()` as the ConnectionManager already does. Sequential sends cause Player 2 to receive messages measurably later than Player 1 (see Pitfall 8 in Phase 1 research).
- **Writing game state to SQLite mid-round:** Keep game state in memory. Only persist at game end (one GameSession record + 9 Round records + one Stat update). SQLite writes during a timer round risk lock contention and timing issues.
- **Using `BackgroundTasks` for game loop:** `BackgroundTasks` depends on the HTTP request lifecycle and is non-functional in WebSocket contexts. Always use `asyncio.create_task()`.
- **Broadcasting individual answers:** GameSession must NOT broadcast `submit_answer` events. Answers are only revealed in `round_result`. This is GAME-04 and must be enforced at the protocol level.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State synchronisation between WebSocket dispatcher and GameSession | Custom condition variable or pipe | `asyncio.Event` for admin start signal; instance variables (`self.p1_answer`, `self.p2_answer`) for answer collection | Single event loop means no thread-safety issues. `Event` is the stdlib primitive for "wait until something happens." Instance vars work because both the WS dispatcher and GameSession run in the same event loop via `create_task()`. |
| Session token generation | Custom token scheme | `uuid.uuid4()` hex string | Python stdlib, cryptographically random, no collisions for booth-scale use (at most hundreds of reconnects). Stored in a plain dict. |
| Timer loop | Additional scheduling library | `for remaining in range(10, -1, -1): ... await asyncio.sleep(1)` | 10-second round with 1-second ticks. Drift (~1-5ms/tick) is negligible. No need for `asyncio` clock calculation or third-party timer libraries. |

**Key insight:** Phase 2 is pure stdlib Python and existing project dependencies. No new libraries needed. The complexity is in the event-driven state machine design, not in the tooling.

## Common Pitfalls

### Pitfall 1: GameSession Background Task Not Cancelled on Disconnect
**What goes wrong:** A GameSession `run()` task continues running after the admin WebSocket disconnects. Timer ticks broadcast to stale connections. The game "runs" but no one sees it.
**Why it happens:** `asyncio.create_task()` schedules the task independently. The task reference is in a global variable but the task itself has no lifecycle connection to any WebSocket handler.
**How to avoid:**
- Store the task reference as a module-level variable alongside the session.
- On admin restart: `game_task.cancel()` then `game_task = None`.
- In `main.py` disconnect cleanup: if no players/admin remain connected and the game is in progress, cancel the task.
- Use `try/finally` in the game loop to broadcast a "game cancelled" event if the task is cancelled mid-game.

### Pitfall 2: Race Condition Between Timer Expiry and Late Answer
**What goes wrong:** A player submits an answer at `remaining=0` (last tick). The server has already moved to the "showing_result" state. The answer is silently ignored.
**Why it happens:** The timer loop sends tick `0`, then immediately transitions to `showing_result`. Meanwhile the client, upon receiving tick `0`, sends the answer. The answer arrives when the server is no longer accepting.
**How to avoid:**
- This is by design -- D-01 specifies server-authoritative timing. The server's `remaining=0` tick marks the real end. Any answer arriving after that state transition is correctly late.
- But to be fair: after the last tick (`remaining=0`), add a very short `await asyncio.sleep(0.05)` before transitioning to `showing_result`. This allows in-flight messages to be processed. The event loop will process any pending `submit_answer` calls from the WebSocket handler during this sleep.
- Document that the server timestamp is authoritative; the client auto-capture at `remaining=0` is a best-effort UX feature, not a guarantee.

### Pitfall 3: Task Cancellation Kills SQLite Persistence at Game End
**What goes wrong:** The game completes 9 rounds, broadcasts `game_end`, then starts persisting to SQLite. During `await db.commit()`, a player disconnects. Uvicorn cancels the WebSocket handler's task, which cascades to the GameSession task (if it was spawned from the same parent or is a child task). The DB write is interrupted mid-transaction, leaving partial data or a rolled-back game record.
**Why it happens:** Task cancellation propagates from the parent task (WebSocket handler) to child tasks (GameSession). Any `await` point in the persistence code raises `CancelledError`.
**How to avoid:**
- Always wrap game-end persistence in `asyncio.shield()`:
```python
await asyncio.shield(self._persist_game())
```
- For extra safety, use a try/except/finally inside the shielded coroutine to catch any internal cancellation.
- Alternative: queue-based persistence (push write to a dedicated background worker), but shield() is simpler for this scale.

### Pitfall 4: GameSession Re-creation Race on Multiple Admin Events
**What goes wrong:** Admin rapidly clicks "Restart" twice. Two `restart` events arrive at the server. The first creates a new GameSession and cancels the old one. The second tries to cancel `None` or the newly created session, causing an error.
**Why it happens:** No idempotency check on restart events.
**How to avoid:**
- Guard the restart handler: if no active session or if session is already in `waiting_for_players`, ignore the restart event.
- Use a simple state check:
```python
if active_session and active_session.state not in ("waiting_for_players", "ready"):
    # Actually restart
    pass
```

## Code Examples

### Scoring Function
```python
# Source: D-05, GAME-05, GAME-08 locked decisions
def compute_winner(p1_answer: int | None, p2_answer: int | None, correct: int) -> str:
    """Return 'player1', 'player2', or 'draw' based on absolute difference."""

    def diff(answer):
        if answer is None:
            return float("inf")
        return abs(answer - correct)

    d1 = diff(p1_answer)
    d2 = diff(p2_answer)

    if d1 < d2:
        return "player1"
    elif d2 < d1:
        return "player2"
    else:
        return "draw"
```

### GameEndWebSocket Event Payload (D-16)
```python
# Source: D-16 locked decision
game_end_payload = {
    "event": "game_end",
    "data": {
        "player1_nickname": "Анна",
        "player2_nickname": "Борис",
        "player1_score": 5,
        "player2_score": 4,
        "winner": "Анна",  # null for draw
        "rounds": [
            {
                "round_number": 1,
                "winner": "player1",
                "player1_answer": 42,
                "player2_answer": 38,
            },
            # ... rounds 2-9 ...
        ],
    },
}
```

### Broadcast with Gather (ConnectionManager -- Phase 1, reused by Phase 2)
```python
# Source: Phase 1 connection_manager.py (D-08), also ARCHITECTURE.md pattern

async def broadcast(self, message: dict):
    """Broadcast a message to all connected clients in parallel."""
    tasks = [ws.send_json(message) for ws in self.all_connections]
    await asyncio.gather(*tasks, return_exceptions=True)
```

### asyncio.shield Pattern for Game Persistence (D-07 + Pitfall 6)
```python
# Source: asyncio shield patterns from Phase 1 PITFALLS.md, verified by WebSearch

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
        await db.flush()  # Get game_session.id

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

        # Increment game count
        stat = await db.execute(select(models.Stat).limit(1))
        stat_record = stat.scalar_one_or_none()
        if stat_record:
            stat_record.game_count += 1

        await db.commit()
```

### Session Token for JOIN-05
```python
# Source: FastAPI WebSocket reconnect patterns (WebSearch 2025-2026)

import uuid

# Module-level store
_reconnect_tokens: dict[str, dict] = {}

def generate_token(nickname: str, role: str) -> str:
    token = uuid.uuid4().hex
    _reconnect_tokens[token] = {"nickname": nickname, "role": role}
    return token

def restore_from_token(token: str) -> dict | None:
    return _reconnect_tokens.get(token)

# On reconnect (main.py websocket handler):
token = websocket.query_params.get("token")
if token:
    session = restore_from_token(token)
    if session:
        # Restore nickname and role
        nickname = session["nickname"]
        # ... re-assign to appropriate slot ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BackgroundTasks.add_task()` for game tasks | `asyncio.create_task()` + explicit cancel | FastAPI 0.136 (current) | BackgroundTasks is HTTP-only. WebSocket games must use `create_task()` with manual lifecycle management. |
| Sequential `for ws: await ws.send()` | `asyncio.gather(*sends, return_exceptions=True)` | Phase 1 arch decision | Parallel broadcast prevents accumulated latency disadvantage for Player 2. ConnectionManager already uses this pattern. |
| SQLite writes mid-round | In-memory game state, persist only at game end | Phase 2 | Eliminates write contention during 10-second timer window. Only 1 write per game. |
| Socket.IO with fallback transports | Native WebSocket via FastAPI/Starlette | 2023+ | Socket.IO adds protocol overhead and server-side library. Native WS is simpler for local WiFi where no proxy/firewall blocks WS. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `asyncio.sleep(1)` drift (~1-5ms/tick) is acceptable for a 10-second round | Timer Implementation | At maximum drift (50ms over 10 ticks), one player might see remaining=0 slightly before the other. For a booth game, this is imperceptible. If drift accumulates across 9 rounds (450ms), it might be noticeable. Mitigation: D-05 explicitly accepts drift. |
| A2 | `asyncio.shield()` is sufficient to protect game-end SQLite writes from task cancellation | Persistence | If the cancellation is system-level (SIGTERM to the process), shield does not help -- the process exits. In that case, the game is lost regardless. Shield protects against task cancellation from WebSocket disconnect, which is the common failure mode. |
| A3 | UUID hex tokens are sufficient for JOIN-05 session management | Session Tokens | In-memory token store is lost on server restart. Acceptable for a booth demo. If token storage must survive restart, a SQLite `sessions` table would be needed (adding DB writes to the join path). |
| A4 | `GameSession.submit_answer()` called from the WebSocket handler's event loop is safe without locks | Answer Collection | Both the WS dispatcher and GameSession run in the same asyncio event loop. Setting `self.p1_answer` from the WS handler and reading it from `_compute_round_result()` is safe because both are single-threaded and never truly concurrent -- the event loop interleaves them at `await` points. A dict for answers would also be safe. |
| A5 | The 3-second pause between rounds is implemented as `asyncio.sleep(3)` and is sufficient for result display | Round Flow | If network latency causes `round_result` to arrive late, players may see it for slightly less than 3 seconds. For a booth game, 3s +/- 100ms is acceptable. If precise timing were critical, use an end-timestamp approach. |

## Open Questions (RESOLVED)

1. **How should the global `active_session` reference be managed?**
   - RESOLVED: `main.py` owns the globals `active_session: Optional[GameSession]` and `game_task: Optional[asyncio.Task]`. `main.py` creates the GameSession and launches `create_task()` in the admin `start_game` handler. `game/session.py` is pure stateless logic. Implemented in 02-02-PLAN.md Task 1.

2. **Should `submit_answer` validate the answer format server-side?**
   - RESOLVED: Validate type/range in the WebSocket dispatcher (main.py) before calling `submit_answer()`. `submit_answer()` only accepts already-validated ints. This keeps the GameSession class focused on game logic. Implemented in 02-02-PLAN.md Task 1 step F.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python runtime | Backend execution | Yes | 3.12.6 (dev), Docker targets 3.13-slim | Docker `python:3.13-slim` for production; 3.12.6 is compatible for development |
| fastapi | WebSocket/HTTP server | Yes | 0.136.1 | -- |
| uvicorn | ASGI server | Yes | 0.48.0 | -- |
| sqlalchemy | ORM | Yes | 2.0.49 | -- |
| aiosqlite | Async SQLite driver | Yes | 0.20.0 | -- |
| Node.js | Frontend dev | Yes | v20.20.2 | -- |
| npm | Package management | Yes | 10.8.2 | -- |
| Docker | Production deployment | Yes | 24.0.7 | Direct `uvicorn` without Docker |
| Docker Compose | Orchestration | Yes | v2.21.0 | Manual Docker run |

**Missing dependencies with no fallback:** None -- all required tools are available.

**Missing dependencies with fallback:** None.

## Validation Architecture

> nyquist_validation is explicitly set to `false` in `.planning/config.json`. Skipping this section per protocol.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No authentication in Phase 2. JOIN-05 session tokens are for reconnect only, not auth. |
| V3 Session Management | Partial | Session tokens (UUID) for reconnect. In-memory only. No expiry -- acceptable for booth demo. |
| V4 Access Control | Yes | WebSocket role assignment prevents players from sending admin-only events (start_game, restart). The WebSocket dispatcher checks `role` before routing events. |
| V5 Input Validation | Yes | Answer validation: integer 0-1,000,000 enforced server-side. Invalid answers treated as no answer. |
| V6 Cryptography | No | No encryption needed for local WiFi booth. Session tokens are not sensitive. |

### Known Threat Patterns for Phase 2

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Player sends `start_game` event | Spoofing | WebSocket dispatcher routes `start_game` only if sender is the admin WebSocket (checked via `websocket == manager.admin`). Player WebSockets cannot trigger admin actions. |
| Player sends fabricated DB write event | Tampering | No client-initiated DB writes exist. All persistence runs server-side in GameSession._persist_game(). WebSocket messages only set in-memory state. |
| Duplicate answer submissions from same player | Denial of Service | D-12: First answer wins. `submit_answer()` checks `self.p1_answer is None` before accepting. Subsequent submissions silently ignored. |
| Answer flooding (1000 submissions/second) | Denial of Service | Rate limiting not implemented in Phase 2. Acceptable for local WiFi booth (physically limited to 2 players, 1 connection each). If needed: simple token-bucket rate limiter per WebSocket connection. |
| Replay attack on `submit_answer` | Tampering | Attacker could re-send a captured WebSocket message. Mitigation: first-answer-wins policy prevents replay advantage. Each new round clears answers. |

## Sources

### Primary (HIGH confidence)
- Phase 1 codebase (`backend/connection_manager.py`, `backend/main.py`, `backend/models.py`, `backend/services/question_service.py`) -- verified existing infrastructure and integration points
- Phase 2 CONTEXT.md -- all 17 locked decisions (D-01 through D-17) specifying timer, state machine, and protocol design
- .planning/REQUIREMENTS.md -- full requirement text for JOIN-02, JOIN-05, GAME-02, GAME-04, GAME-05, GAME-07, GAME-08, GAME-09
- Phase 1 PITFALLS.md -- 12 researched pitfalls with mitigations, directly applicable to Phase 2
- Phase 1 ARCHITECTURE.md -- server-authoritative patterns, timer patterns, WS event dispatcher patterns
- Python asyncio documentation -- `create_task()`, `Event`, `sleep()`, `shield()`, `CancelledError`

### Secondary (MEDIUM confidence)
- FastAPI WebSocket patterns (WebSearch 2025-2026) -- `BackgroundTasks` unusable in WebSocket, `create_task()` is the correct pattern, concurrent reader/writer pattern
- WebSocket reconnect patterns (WebSearch 2025-2026) -- UUID token pattern for session restoration
- asyncio shield patterns (WebSearch 2025-2026) -- shield() protects against cancellation propagation from parent task cancellation

### Tertiary (LOW confidence)
- No items -- all claims are either verified from the codebase, derived from locked decisions, or stdlib behavior that does not change.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, stdlib asyncio + existing Phase 1 modules
- Architecture: HIGH -- patterns directly follow locked decisions D-07 through D-17, all previously verified against codebase
- Pitfalls: HIGH -- derived from Phase 1 research + verified with current WebSearch
- Session tokens: MEDIUM -- UUID token pattern is standard but specific edge cases (reconnect race conditions) are not researched in depth

**Research date:** 2026-05-30
**Valid until:** 2026-07-01 (stable Python stdlib patterns, no fast-moving dependencies)
