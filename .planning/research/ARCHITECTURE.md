# Architecture Research

**Domain:** Local multiplayer quiz game system
**Researched:** 2026-05-28
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Docker Network (172.x.x.x)                    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                FastAPI Backend (uvicorn, port 8000)          │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────┐        │    │
│  │  │              FastAPI Application                  │        │    │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │        │    │
│  │  │  │ REST Router │  │  WS Router   │  │ Static │ │        │    │
│  │  │  │ /api/...    │  │  /ws         │  │ Files  │ │        │    │
│  │  │  └──────┬──────┘  └──────┬───────┘  └────────┘ │        │    │
│  │  │         │                │                       │        │    │
│  │  │  ┌──────┴────────────────┴──────────────────┐   │        │    │
│  │  │  │          Game Engine Layer                │   │        │    │
│  │  │  │  ┌────────────────┐ ┌────────────────┐   │   │        │    │
│  │  │  │  │ ConnectionMgr  │ │  GameSession   │   │   │        │    │
│  │  │  │  │ (WebSocket     │ │  (state        │   │   │        │    │
│  │  │  │  │  lifecycle)    │ │   machine)     │   │   │        │    │
│  │  │  │  └────────────────┘ └────────┬───────┘   │   │        │    │
│  │  │  │  ┌───────────────────────────┴────────┐  │   │        │    │
│  │  │  │  │     Question Service               │  │   │        │    │
│  │  │  │  │  (random select, CRUD)             │  │   │        │    │
│  │  │  │  └────────────────┬───────────────────┘  │   │        │    │
│  │  │  └───────────────────┼──────────────────────┘   │        │    │
│  │  │                      │                           │        │    │
│  │  │  ┌───────────────────┴──────────────────────┐   │        │    │
│  │  │  │         SQLite Database (data.db)        │   │        │    │
│  │  │  │  questions │ game_sessions │ rounds      │   │        │    │
│  │  │  └──────────────────────────────────────────┘   │        │    │
│  │  └──────────────────────────────────────────────────┘        │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │           React / Vite Frontend (nginx, port 80)            │    │
│  │                                                              │    │
│  │  ┌────────────────────┐  ┌────────────────────┐             │    │
│  │  │   Player App       │  │   Admin App        │             │    │
│  │  │  / → JoinScreen    │  │  /admin →          │             │    │
│  │  │  → GameScreen      │  │  LobbyView         │             │    │
│  │  │  → ResultScreen    │  │  → ControlView     │             │    │
│  │  │                    │  │  → QuestionsView   │             │    │
│  │  └────────┬───────────┘  └────────┬───────────┘             │    │
│  │           │                       │                         │    │
│  │  ┌────────┴───────────────────────┴─────────────────────┐   │    │
│  │  │           Zustand State Stores                       │   │    │
│  │  │  ┌──────────┐ ┌───────────┐ ┌──────────────────┐    │   │    │
│  │  │  │GameStore │ │ AdminStore│ │ QuestionStore    │    │   │    │
│  │  │  └──────────┘ └───────────┘ └──────────────────┘    │   │    │
│  │  │  ┌──────────────────────────────────────────────┐    │   │    │
│  │  │  │        WebSocket Client Layer                │    │   │    │
│  │  │  │  (standalone module, outside React tree)     │    │   │    │
│  │  │  │  events → getState()/setState()              │    │   │    │
│  │  │  └──────────────────────────────────────────────┘    │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| FastAPI Application | HTTP server, async request handling, lifespan management | FastAPI + uvicorn, lifespan context manager for background tasks |
| REST Router | Question CRUD, admin-only HTTP endpoints | FastAPI `APIRouter`, Pydantic validation |
| WebSocket Router | Real-time game events, connection acceptance | FastAPI `@app.websocket("/ws")`, JSON message routing |
| Connection Manager | Track active WebSocket connections per role, broadcast messages | Singleton class with dict of `{role: WebSocket}` + helper methods |
| Game Session | Game state machine (waiting/playing/round_result/game_over), round logic, scoring | Class with state enum, round counter, asyncio timer tasks |
| Question Service | Random question selection for game rounds, CSV parsing, CRUD | Class wrapping SQLite queries, CSV validation logic |
| SQLite Database | Persistent storage for questions, game sessions, rounds | sqlite3 or aiosqlite, schema with 3-4 tables |
| Player React App | Player join, question display, answer input, round results | React SPA, Zustand store, WebSocket client module |
| Admin React App | Game control (start, restart), question management, stats | React SPA (separate route), Zustand store + REST API calls |
| Zustand Stores | Client-side reactive state, decoupled from WebSocket lifecycle | Zustand with `getState()`/`setState()` called from WS handlers |
| WebSocket Client Module | WS connection lifecycle, JSON message handling, dispatch to stores | Standalone TypeScript module, no React dependency |

### Role-to-Connection Mapping

The Connection Manager maintains a clear map of exactly three connections:

```
ConnectionManager
├── player1: { websocket, nickname, connected: bool }
├── player2: { websocket, nickname, connected: bool }
└── admin:   { websocket, connected: bool }
```

This is simpler than a room-based pattern (which would be overkill for exactly 2+1 clients). The connection manager knows each role explicitly and can target messages precisely:

- `send_to_player(role, event)` — send to specific player only
- `send_to_players(event)` — broadcast to player1 + player2
- `send_to_admin(event)` — game control status updates
- `broadcast(event)` — all three connections

## Recommended Project Structure

### Backend (FastAPI)

```
backend/
├── main.py                       # FastAPI app, lifespan, CORS, static mount
├── requirements.txt              # Python dependencies
├── Dockerfile
├── app/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py             # Main APIRouter aggregation
│   │   ├── questions.py          # POST/GET/DELETE /api/questions
│   │   └── stats.py              # GET /api/stats
│   ├── ws/
│   │   ├── __init__.py
│   │   ├── handler.py            # WebSocket endpoint, message dispatch
│   │   ├── manager.py            # ConnectionManager class
│   │   └── messages.py           # Message type definitions (Pydantic)
│   ├── game/
│   │   ├── __init__.py
│   │   ├── session.py            # GameSession state machine, round logic
│   │   ├── scoring.py            # Score calculation logic
│   │   └── timer.py              # Server-side timer management
│   ├── services/
│   │   ├── __init__.py
│   │   ├── question_service.py   # Random question selection, CRUD
│   │   └── csv_service.py        # CSV parsing and validation
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py           # SQLite connection, init, migration
│   │   └── models.py             # Table schemas, query helpers
│   └── models/
│       ├── __init__.py
│       ├── question.py           # Question Pydantic models
│       ├── game.py               # GameSession, Player, Round models
│       └── messages.py           # WS event envelope models
├── data/
│   └── data.db                   # SQLite database file (volume mounted)
└── static/                       # React production build (copied at Docker build)
    └── index.html
```

### Frontend (React / Vite)

```
frontend/
├── package.json
├── vite.config.ts
├── Dockerfile
├── tsconfig.json
├── public/
│   └── sounds/
│       ├── tick.mp3
│       ├── tick_fast.mp3
│       ├── end_round.mp3
│       └── winner.mp3
├── src/
│   ├── main.tsx                  # React entry point, router setup
│   ├── App.tsx                   # Route switching
│   ├── routes/
│   │   ├── PlayerRoute.tsx       # / → PlayerApp
│   │   └── AdminRoute.tsx        # /admin → AdminApp
│   ├── features/
│   │   ├── player/
│   │   │   ├── PlayerApp.tsx     # Player state orchestration component
│   │   │   ├── JoinScreen.tsx    # Nickname entry, waiting state
│   │   │   ├── GameScreen.tsx    # Question display, answer input, timer
│   │   │   └── FinalScreen.tsx   # Game over, winner display
│   │   └── admin/
│   │       ├── AdminApp.tsx      # Admin state orchestration + tabs
│   │       ├── GameControl.tsx   # Launch, restart, live score
│   │       ├── QuestionList.tsx  # Question table with delete
│   │       ├── QuestionAdd.tsx   # Single question form
│   │       ├── CsvImport.tsx     # CSV upload with preview
│   │       └── GameStats.tsx     # Game count display
│   ├── components/
│   │   ├── Timer.tsx             # Circular countdown timer component
│   │   ├── ScoreBoard.tsx        # Score display (player + opponent)
│   │   ├── AnswerInput.tsx       # Numeric answer field
│   │   ├── RoundResult.tsx       # Round outcome overlay
│   │   └── ConnectionStatus.tsx  # WS connection indicator
│   ├── stores/
│   │   ├── gameStore.ts          # Game state (phase, round, score)
│   │   ├── adminStore.ts         # Admin panel state
│   │   └── questionStore.ts      # Question list state (for admin panel)
│   ├── ws/
│   │   ├── client.ts             # WebSocket connect, reconnect, send
│   │   ├── events.ts             # Event type definitions
│   │   └── handler.ts            # Route WS events → store updates
│   ├── hooks/
│   │   ├── useWebSocket.ts       # React hook for WS lifecycle
│   │   └── useSound.ts           # Sound playback hook
│   ├── audio/
│   │   └── SoundManager.ts       # Audio context, preload, play triggers
│   └── utils/
│       ├── api.ts                # REST API client (for admin panel)
│       └── format.ts             # Number formatting, etc.
└── index.html
```

### Structure Rationale

- **`app/ws/` separated from `app/api/`:** WebSocket and REST have fundamentally different lifecycles (persistent vs request/response). Mixing them in the same module creates confusion. The WS handler maintains long-lived connections; REST handlers are stateless.

- **`app/game/` separated from `app/services/`:** The GameSession state machine manages the live game (in-memory, volatile, timing-sensitive). QuestionService manages persistent data (SQLite, stateless). Different failure modes: game session dies on server restart (acceptable), question data survives.

- **`app/models/` for shared schemas:** Pydantic models used by both API and WS routers live in one place. This prevents duplicate validation logic. The WS message models in `app/models/messages.py` mirror the protocol defined in gdd.md.

- **`frontend/src/ws/` outside React tree:** The WebSocket client module does not import React. It connects, receives JSON, and updates Zustand stores via `getState()`/`setState()`. This prevents stale closures and decouples network logic from component lifecycle. Verified as the dominant pattern in real production game clients.

- **`frontend/src/stores/` per responsibility:** GameStore (round, phase, scores), AdminStore (control state), QuestionStore (question list for admin CRUD). Three small stores are easier to reason about than one large store. GameStore is updated by WS events; QuestionStore is updated by REST responses.

- **`frontend/src/audio/`:** Sound playback needs special initialization (AudioContext must be unlocked by user gesture). Keeping it in a dedicated module with explicit `init()` and `play()` methods avoids the common pitfall of "sounds don't work on first click on mobile."

## Architectural Patterns

### Pattern 1: Server-Authoritative State (Game Loop)

**What:** The server is the single source of truth for all game state. Clients send inputs (join, answer). The server computes state changes and broadcasts them. No client-side game logic is trusted.

**When to use:** Required for any multiplayer game where consistency matters. Essential here because two players see the same question and timer — any drift between their views would break the experience.

**How it works in this system:**

```
1. Server owns the timer (asyncio sleep-based tick)
2. Server selects questions from the pool
3. Server receives answers, stamps them with time
4. Server computes who was closer after timer expires
5. Server broadcasts results to both players + admin
6. Client responsibilities: display state, capture input, play sounds
```

**Trade-offs:**
- Pro: Perfect consistency between player and admin views
- Pro: No cheating possible (all logic in server)
- Con: If WebSocket disconnects mid-round, player misses state until reconnect
- Con: Server must schedule all timer events via asyncio

**Example (Python):**

```python
# GameSession round flow (simplified)
async def run_round(self, question: Question) -> RoundResult:
    self.state = GameState.ROUND_ACTIVE
    await self.broadcast({
        "event": "round_start",
        "data": {
            "question": question.text,
            "round": self.current_round,
            "total_rounds": TOTAL_ROUNDS
        }
    })
    # Timer runs on server
    for remaining in range(10, -1, -1):
        await self.broadcast({"event": "timer_tick", "data": {"remaining": remaining}})
        await asyncio.sleep(1)
    # Collect answers, compute result
    self.state = GameState.ROUND_RESULT
    result = self.score_round(question)
    await self.broadcast({"event": "round_result", "data": result.to_dict()})
    await asyncio.sleep(3)  # pause before next round
    return result
```

### Pattern 2: Explicit Role-Based Connection Management

**What:** Instead of generic rooms or channels, the server assigns fixed roles (player1, player2, admin) at connection time and targets messages by role.

**When to use:** When the system has a fixed, small number of known roles rather than dynamic rooms. Perfect for this project (exactly 2+1).

**Trade-offs:**
- Pro: Simple, no room lookup overhead, no room codes needed
- Pro: Messages can be precisely targeted (send to player1 only, players only, admin only)
- Pro: Reconnection logic is straightforward (re-assign same role)
- Con: Only supports exactly 2 players per game session (matches the requirement)

**Example (Python):**

```python
class ConnectionManager:
    def __init__(self):
        self.players: dict[str, Optional[PlayerConnection]] = {
            "player1": None,
            "player2": None
        }
        self.admin: Optional[WebSocket] = None

    async def connect_player(self, websocket: WebSocket, nickname: str) -> str:
        """Assigns player1 or player2 role. Returns the assigned role."""
        if self.players["player1"] is None:
            role = "player1"
        elif self.players["player2"] is None:
            role = "player2"
        else:
            raise GameFullError("Both player slots are taken")

        self.players[role] = PlayerConnection(ws=websocket, nickname=nickname)
        return role

    async def broadcast_to_players(self, event: str, data: dict):
        """Send to both players (not admin)."""
        for role, conn in self.players.items():
            if conn and conn.connected:
                await conn.ws.send_json({"event": event, "data": data})
```

### Pattern 3: Server-Side Timer with Synchronized Broadcasts

**What:** The game timer runs entirely on the server via `asyncio.sleep()` ticks. Each tick broadcasts to all connected clients. Clients do not run their own timers — they display the server-reported remaining time.

**When to use:** Essential for any quiz game where both players must see the same countdown. Client-side timers inevitably drift, causing one player to see "3 seconds left" while the other sees "5 seconds left."

**Trade-offs:**
- Pro: Perfect sync between both player screens and admin panel
- Pro: Immune to clock drift, network jitter (time is authoritative)
- Con: One tick per second means clients are 1 second behind real time (acceptable for a quiz game)
- Con: Network latency adds small delay to display updates (not noticeable at 1Hz tick rate)

**Important nuance:** The server does not wait for client acknowledgments between ticks. Each `timer_tick` is fire-and-forget broadcast. If a client's WebSocket is briefly congested, it catches up on next tick — the display may stutter but the game logic (scoring, time-out) is always correct.

```python
async def countdown(self, seconds: int):
    """Server-authoritative countdown. No client feedback needed."""
    for remaining in range(seconds, -1, -1):
        await self.broadcast({
            "event": "timer_tick",
            "data": {"remaining": remaining}
        })
        await asyncio.sleep(1)
```

### Pattern 4: WebSocket Event Dispatcher (Hub Pattern)

**What:** A single WebSocket endpoint receives all messages, inspects the `event` field, and routes to the appropriate handler. No separate WS endpoints for different message types.

**When to use:** When the number of distinct event types is small (under ~20) and all events share the same connection lifecycle. Overkill for larger systems that need separate channels, but ideal for this game's ~10 event types.

**Trade-offs:**
- Pro: Single `@app.websocket("/ws")` endpoint — clean, easy to reason about
- Pro: Easy to add new event types — just add a new `elif` or dispatch entry
- Pro: Reconnection is simple — reconnect to same URL, re-join
- Con: All message types share the same connection — can't prioritize game events over admin events at the transport level (not needed at this scale)

**Protocol (mirrors gdd.md):**

```python
# All messages follow this envelope:
# { "event": "<event_type>", "data": { ... } }

# Server → Client events:
# player_joined, player_left, game_started,
# round_start, timer_tick, round_result, game_end, game_reset

# Client → Server events:
# join (with role + nickname), answer (with value)

# Admin Client → Server events:
# start_game, restart_game

# Server → Admin events (same events as above, admin subscribes to all)
```

### Pattern 5: WebSocket Client as Standalone Module (Zustand Integration)

**What:** The WebSocket client is a plain TypeScript module with no React imports. It connects to the server, receives JSON messages, and updates Zustand stores directly via `useGameStore.getState()` and `useGameStore.setState()`. React components subscribe to Zustand slices and re-render only when their slice changes.

**When to use:** The standard pattern for real-time game clients. Separating network I/O from the React render cycle prevents stale closures, avoids unnecessary re-renders, and keeps the codebase modular.

**Trade-offs:**
- Pro: No stale closure bugs (WS handlers always read current state via `getState()`)
- Pro: React only re-renders when data actually changes (Zustand selector granularity)
- Pro: WebSocket module can be unit-tested independently of React
- Con: Slightly more boilerplate than using React context for WS state
- Con: Need to manually manage Zustand subscriptions for cleanup on unmount

**Example (TypeScript):**

```typescript
// ws/client.ts — no React imports
import { useGameStore } from '../stores/gameStore';

let ws: WebSocket | null = null;

export function connect(url: string) {
    ws = new WebSocket(url);

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const store = useGameStore.getState();

        switch (message.event) {
            case 'timer_tick':
                store.setRemaining(message.data.remaining);
                break;
            case 'round_start':
                store.startRound(message.data);
                break;
            case 'round_result':
                store.showResult(message.data);
                break;
            case 'game_end':
                store.endGame(message.data);
                break;
            // ... more events
        }
    };

    ws.onclose = () => {
        useGameStore.getState().setDisconnected(true);
        // Reconnection logic here (exponential backoff)
    };
}
```

## Data Flow

### Game Round Data Flow (one iteration)

```
Admin clicks "Start Game"
    │
    ▼
AdminClient (WebSocket) ── send({"event": "start_game"}) ──► FastAPI WS Router
                                                                     │
                                                                     ▼
                                                            GameSession.start()
                                                                     │
                                              ┌──────────────────────┴─────┐
                                              │   Select random question   │
                                              │   from QuestionService     │
                                              └──────────────────────┬─────┘
                                                                     │
                                                                     ▼
                                              broadcast({"event": "round_start", ...})
                                              ┌───────────┬───────────┬───────────┐
                                              ▼           ▼           ▼
                                          Player 1    Player 2     Admin
                                          (shows       (shows       (shows
                                           question)    question)    scores)
                                              │
           ┌──────────────────────────────────┤
           ▼                                  │
    Player types answer                       │
           │                                  │
           ▼                                  ▼
    send({"event":           Server timer ticks every second
     "answer",               broadcast({"event": "timer_tick"})
     "data": {"value": 42}})      │
           │                      │
           ▼                      ▼
    Server stores answer    All clients update timer display
    (does NOT broadcast           │
     individual answers           │
     to opponent)                 ▼
                          Timer reaches 0
                               │
                               ▼
                    Server computes scores
                    (closest by absolute difference)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            broadcast({"event":      Save round to
             "round_result",         SQLite (optional
             "data": {                game log)
              correct_answer, 42,
              player1_answer, 38,
              player2_answer, 50,
              winner: "player1",
              player1_score: 3,
              player2_score: 2
             }})
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
    Player1  Player2  Admin
    shows    shows    shows
    result   result   live scores
                               │
                    3 sec pause (async sleep)
                               │
                    ┌──────────┘
                    ▼
            Next round or game_end
```

### Key Data Flow Rules

1. **Individual answers are NEVER broadcast to the other player during the round.** Broadcasting an answer early would let the second player adjust their answer. The server silently accepts answers and only reveals them in `round_result`.

2. **The admin receives the SAME events as players (round_start, timer_tick, round_result, game_end).** This lets the admin panel display live game state. The admin does NOT need a separate data feed.

3. **Questions are fetched ONCE at game start (9 random questions), not one-at-a-time.** This prevents IO during the critical timing window. The GameSession holds the question list in memory for the duration of the game.

4. **REST and WebSocket traffic do not mix.** Question management (CRUD) goes through REST. Game events go through WebSocket. The admin app uses both: WS for game control, REST for question management. This separation allows them to be tested and versioned independently.

### State Management (Frontend)

```
WebSocket JSON message arrives
    │
    ▼
ws/handler.ts (outside React)
    │  useGameStore.getState().someMethod(message.data)
    ▼
Zustand Store (gameStore.ts)
    │  State changed via setState()
    ▼
React Components
    │  Subscribe via useSelector / useStore hooks
    │  Only re-render when selected slice changes
    ▼
DOM update
```

The Zustand store structure:

```typescript
interface GameStore {
    // Phase control
    phase: 'join' | 'lobby' | 'playing' | 'round_result' | 'game_over';

    // Player identity (set on join, never changes)
    playerRole: 'player1' | 'player2' | null;
    nickname: string | null;

    // Round state
    currentRound: number;
    totalRounds: number;
    question: string | null;
    remaining: number;

    // Answer state
    myAnswer: number | null;
    hasSubmitted: boolean;

    // Results
    roundResult: RoundResult | null;
    finalResult: FinalResult | null;

    // Scores
    myScore: number;
    opponentScore: number;
    opponentNickname: string;

    // Connection
    connected: boolean;

    // Actions
    setPhase: (phase: GameStore['phase']) => void;
    startRound: (data: RoundStartData) => void;
    submitAnswer: (value: number) => void;
    showResult: (data: RoundResultData) => void;
    endGame: (data: FinalResultData) => void;
    reset: () => void;
}
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1 concurrent game (this project) | No adjustments needed. Single in-memory GameSession. SQLite is fine. Single-process uvicorn. |
| 10-100 concurrent games | Move to Redis for live game state (SQLite/disk IO becomes bottleneck for round-trip writes). Add connection pool for SQLite or switch to PostgreSQL. Add an async task queue for game session background work. |
| 100+ concurrent games | Horizontally scale backend behind a load balancer with WebSocket affinity (sticky sessions). Use Redis Pub/Sub to broadcast game events across server instances. Replace SQLite with PostgreSQL. Consider dedicated game server frameworks (Colyseus, Nakama) if this becomes a product focus. |

### Scaling Priorities for This Project

1. **Only bottleneck to consider:** SQLite concurrent writes. At 0-1 game writes per minute, this is a non-issue. The game state lives in memory; SQLite writes happen at game end (one row) and question CRUD (admin-initiated, rare).

2. **Not to optimize preemptively:** Redis, message brokers, container orchestration, load balancers. None of these are needed for a booth game running on a laptop.

## Anti-Patterns

### Anti-Pattern 1: Client-Authoritative Timer

**What people do:** Start a `setInterval(1000)` in the browser to count down from 10. Each client runs its own clock.

**Why it's wrong:** Two clients will drift. JavaScript timers are unreliable (throttled in background tabs, subject to CPU load). Players in the same room will see different remaining times. The player with the "slower" timer gets an unfair advantage (more real time to answer).

**Do this instead:** The server owns the timer. Every second, the server broadcasts the current remaining time. Clients display it. If a client misses a tick, they wait for the next one — the displayed time may stutter, but the game outcome is fair.

### Anti-Pattern 2: Storing Game Session State in SQLite Per-Tick

**What people do:** Write every timer tick, every answer submission, every score update to the database in real-time.

**Why it's wrong:** SQLite is not designed for high-frequency writes. Each write acquires a file-level lock. Even at 10 writes/second, this introduces latency spikes. The game session state changes too fast for disk persistence to keep up. It also creates unnecessary IO on the booth laptop's SSD.

**Do this instead:** Keep the live game session in memory (a Python class instance). Persist to SQLite only at meaningful boundaries:
- After a round completes (optional logging)
- After the game ends (final scores, winner)

In-memory state is volatile — acceptable here because a server crash during a round means the round is lost regardless. The conference staff restarts and players replay.

### Anti-Pattern 3: Single React useEffect for WebSocket + All State

**What people do:** Put `const [phase, setPhase] = useState(...)` and `useEffect(() => { ws.onmessage = ... })` all in one giant component. State and WS lifetime are coupled to component mount/unmount.

**Why it's wrong:** If the component re-renders (parent state change, React StrictMode), the effect re-runs, creating a new WebSocket connection. The old one leaks. State resets. The game disconnects mid-round. Stale closures in the effect callback miss state updates.

**Do this instead:** WebSocket lives outside React (standalone module). Components subscribe to Zustand slices. The component only manages UI concerns (animation state, local input validation). Verified as the correct pattern from WebSearch results on production game clients.

### Anti-Pattern 4: Broadcasting Individual Answers Mid-Round

**What people do:** When a player submits an answer, broadcast it to both players immediately.

**Why it's wrong:** If Player 1 submits an answer at second 8 and the server broadcasts it, Player 2 sees Player 1's answer and can adjust their own. This breaks the core fairness mechanic of the game.

**Do this instead:** The server silently accepts answers. It does NOT broadcast individual answers. Both answers are revealed simultaneously in the `round_result` event after the timer expires. The admin panel also does not show individual answers until the round is over.

### Anti-Pattern 5: Using FastAPI BackgroundTasks for Game Loop

**What people do:** `BackgroundTasks.add_task(run_game_loop)` or `BackgroundTasks.add_task(countdown)`.

**Why it's wrong:** `BackgroundTasks` is designed for the HTTP request-response lifecycle. WebSocket connections are long-lived. The background task runs once after the HTTP response completes and is not tied to the WebSocket lifecycle. It cannot be cancelled when the game ends. It does not have access to the WebSocket object.

**Do this instead:** Use `asyncio.create_task()` to spawn game loop tasks. Cancel them explicitly via `task.cancel()` when the game ends or a player disconnects. Manage these tasks in the GameSession or ConnectionManager, not in BackgroundTasks.

```python
# Correct:
self._timer_task = asyncio.create_task(self._run_countdown())
# Later:
self._timer_task.cancel()

# Wrong:
background_tasks.add_task(self._run_countdown())
```

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| ConnectionManager ↔ GameSession | Method calls | ConnectionManager notifies GameSession when players connect/disconnect. GameSession calls ConnectionManager.broadcast() to send events. |
| GameSession ↔ QuestionService | Method calls | GameSession calls `QuestionService.get_random_questions(9)` at game start. No calls during active round (questions are pre-loaded). |
| WebSocket Handler ↔ ConnectionManager | Method calls | Handler calls `manager.connect()` / `manager.disconnect()` on WS lifecycle events. |
| WebSocket Handler ↔ GameSession | Event dispatch | Handler routes parsed messages to GameSession methods (e.g., `handle_answer(role, value)`). |
| REST Router ↔ QuestionService | Direct calls | Stateless query/command calls. |
| REST Router ↔ Database | Via QuestionService | No direct DB access from router layer. |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None | N/A | The system is fully offline. No external APIs, no CDN, no authentication providers. All assets are bundled. |

This zero-external-dependency architecture is deliberate: a conference booth cannot rely on internet access. Every resource (fonts, sounds, libraries via the Docker build cache) must be available offline.

## Build Order Implications

Based on the architecture, components should be built in this order:

### Phase 1: Foundation (Backend + Core Protocol)
1. **SQLite schema + database.py** — Everything depends on data. Start with the schema.
2. **QuestionService** — CRUD operations, random selection. Needed before games can run.
3. **REST API for questions** — POST/GET/DELETE. Required for admin to add questions to play with.
4. **ConnectionManager** — WebSocket lifecycle, role assignment. Must exist before any game logic.

### Phase 2: Game Loop (Backend)
5. **GameSession state machine** — Core game flow, round logic, scoring. Depends on ConnectionManager for broadcasts.
6. **WebSocket handler** — Message dispatch, routes WS events to GameSession. Depends on both ConnectionManager and GameSession.
7. **Server timer** — asyncio-based countdown, integrated into GameSession.
8. **Lifespan management** — Background task cleanup, graceful shutdown.

### Phase 3: Player Frontend
9. **Zustand stores** — GameStore, reactive state container.
10. **WebSocket client module** — Connection, event dispatch to stores.
11. **JoinScreen** — Nickname entry, waiting state.
12. **GameScreen (question + timer + input)** — Core player experience.
13. **RoundResult overlay** — Show outcome after each round.
14. **FinalScreen** — Game over display.
15. **SoundManager + audio files** — Sound effect triggers from WS events.

### Phase 4: Admin Frontend
16. **AdminStore + WebSocket client** — Admin-specific state.
17. **GameControl tab** — Start/restart, player status, live scores.
18. **QuestionManagement tab** — CRUD UI, CSV import.

### Phase 5: Deployment
19. **Docker Compose** — Backend + Frontend containers.
20. **Static file serving** — FastAPI serves React build.
21. **Offline verification** — Test without internet.

## Sources

- FastAPI documentation: [WebSockets](https://fastapi.tiangolo.com/advanced/websockets/), [Lifespan Events](https://fastapi.tiangolo.com/advanced/events/)
- Zustand documentation: [Getting started](https://github.com/pmndrs/zustand)
- WebSocket protocol design patterns from real production game clients (WebSearch — real-time multiplayer game server architecture patterns, FastAPI WebSocket game backend patterns)
- Zustand + WebSocket pattern verified by community projects (dev.to article on Nakama + Zustand integration, hpkv.io zustand-multiplayer middleware analysis)
- Game Design Document (gdd.md) — WebSocket protocol, round structure, REST API definitions
- Web Design Specification (web_design.md) — Frontend component structure, screen layouts

---
*Architecture research for: Number Duel (Дуэль чисел)*
*Researched: 2026-05-28*
