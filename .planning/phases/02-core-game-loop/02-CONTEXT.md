# Phase 2: Core Game Loop - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

## Phase Boundary

The game state machine drives 9 rounds of numeric gameplay with server-authoritative timer, proximity scoring, and WebSocket event broadcasts. Player connections are managed with role assignment and session persistence.

**Requirements:** JOIN-02, JOIN-05, GAME-02, GAME-04, GAME-05, GAME-07, GAME-08, GAME-09

## Implementation Decisions

### Timer Implementation
- **D-01:** Server broadcasts `timer_tick` event every 1 second for the full 10-second round duration. Server-authoritative, prevents client clock manipulation.
- **D-02:** Client-side audio switch to `tick_fast` when remaining time <= 3 seconds. Server continues sending ticks at 1/second rate throughout — no server-side rate change.
- **D-03:** Answer is auto-captured on timer expiry — whatever is in the input field at expiry. No explicit submit button required (though one may exist for early submission).
- **D-04:** Round always uses the full 10 seconds. If a player submits early, their answer is locked in but the timer continues for both players until expiry.
- **D-05:** Server tracks timer internally with `asyncio.sleep(1)` loop. Drift (~1-5ms/tick) is negligible for a 10-second round.
- **D-06:** If a player disconnects mid-round, the round continues. On reconnect, server sends current state snapshot (remaining time, current question). If they reconnect after round ended, they receive `round_result`.

### Game State Machine Design
- **D-07:** Class-based `GameSession` with async `run()` coroutine, launched via `asyncio.create_task()`. Clean separation from the WebSocket handler. Holds references to `ConnectionManager` for broadcasting and `async_sessionmaker` for DB writes.
- **D-08:** Linear state machine with round sub-states:
  - `waiting_for_players` → both players connected, waiting for admin
  - `ready` → both players ready, admin can start
  - `in_progress` → round loop with sub-states:
    - `presenting_question` → broadcast `round_started`, begin ticks
    - `accepting_answers` → timer running, accepting submissions
    - `showing_result` → broadcast `round_result`, 3-second pause
  - `finished` → broadcast `game_end`, persist results, wait for restart
- **D-09:** Singleton `GameSession` — exactly one game at a time. Global module-level reference to the active session.
- **D-10:** Admin restart destroys the current `GameSession`, broadcasts reset to all clients, and returns to `waiting_for_players` state. Both players must remain connected (no need to re-join WebSocket).

### WebSocket Event Protocol
- **D-11:** Server sends explicit `round_started` event before timer ticks begin. Payload: `{"event": "round_started", "data": {"round_number": N, "total_rounds": 9, "question_text": "..."}}`. Correct answer is NEVER sent to players.
- **D-12:** Player submits answer via `{"event": "submit_answer", "data": {"answer": int}}`. First answer wins — subsequent submissions from the same player in the same round are silently ignored. Server validates answer is integer 0–1,000,000; invalid answers treated as no answer.
- **D-13:** `round_result` is the same payload broadcast to both players: `{"event": "round_result", "data": {"round_number": N, "correct_answer": int, "player1_answer": int|null, "player2_answer": int|null, "winner": "player1"|"player2"|"draw"}}`. Each client highlights its own answer.
- **D-14:** Admin triggers game start with `{"event": "start_game"}` (no payload). Server broadcasts `{"event": "game_started", "data": {"player1_nickname": "...", "player2_nickname": "..."}}` to all connections.

### Round Flow Timing
- **D-15:** Fixed 3-second pause between `round_result` broadcast and next `round_started`. Server uses `asyncio.sleep(3)`. During this pause, players view the result overlay.
- **D-16:** After round 9 `round_result`, same 3-second delay, then single `game_end` event: `{"event": "game_end", "data": {"player1_nickname": "...", "player2_nickname": "...", "player1_score": int, "player2_score": int, "winner": "..."|null, "rounds": [{"round_number": 1, "winner": "...", "player1_answer": int|null, "player2_answer": int|null}, ...]}}`. Winner is `null` for draws ("Ничья").
- **D-17:** Admin receives all game events (`timer_tick`, `round_started`, `round_result`, `game_end`) plus a `score_update` event after each `round_result`: `{"event": "score_update", "data": {"player1_score": int, "player2_score": int, "round_number": int}}`.

### Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Design & Protocol
- `gdd.md` — Full game mechanics, round structure §3, WebSocket protocol spec §7.1, sound effect mappings §8, architecture overview §7
- `web_design.md` — Visual style, color scheme (player1 blue #3B82F6, player2 orange #EF4444), typography sizes §4.2, timer display design §4.5

### Phase 1 Foundation (prior context)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-08: ConnectionManager singleton design, D-09: 2+1 connection enforcement, D-10: join event protocol. These are LOCKED and must be respected.

### Project-Wide
- `CLAUDE.md` — Stack constraints, WebSocket protocol pattern, version compatibility matrix
- `.planning/ROADMAP.md` — Phase 2 goal, 7 success criteria, dependency graph
- `.planning/REQUIREMENTS.md` — JOIN-02, JOIN-05, GAME-02 through GAME-09 full text

## Existing Code Insights

### Reusable Assets
- **ConnectionManager** (`backend/connection_manager.py`): Singleton with `player1`/`player2`/`admin` WebSocket slots, `player1_nickname`/`player2_nickname`, `broadcast()`, `send_to_player()`, `send_to_players()`, `send_to_admin()`. GameSession should call these methods for event distribution.
- **QuestionService.random_selection()** (`backend/services/question_service.py:40-44`): Draws N random questions via `ORDER BY RANDOM() LIMIT N`. Already async, already tested. Call this when starting a new game.
- **ORM Models** (`backend/models.py`): `GameSession` (player nicknames, scores, winner, started_at/ended_at), `Round` (game_session_id FK, question_id FK, round_number, player answers, winner), `Stat` (game_count counter). Schema is ready — Phase 2 only needs to populate these.

### Established Patterns
- **Server-authoritative architecture**: All game logic runs on the server; client is a thin display+input terminal. Phase 1 established the comm backbone for this.
- **Single `/ws` endpoint**: Player and admin connect to the same WebSocket, differentiated by the first JSON message's `role` field. Phase 2 game events flow through the same connection.
- **REST for CRUD, WebSocket for real-time**: Question management uses REST (`/api/questions`); game events use WebSocket. Phase 2 adds game events to the WebSocket layer.
- **`asyncio.gather()` for parallel sends**: ConnectionManager uses this pattern. GameSession should continue using it for broadcasting to multiple clients.

### Integration Points
- **WebSocket endpoint** (`backend/main.py:48-105`): Currently handles `join` event, then sits in `receive_json()` loop. Phase 2 extends this loop to dispatch player/admin game messages (`submit_answer`, `start_game`) to the active `GameSession`.
- **`manager` global** (`backend/main.py:13`): `GameSession.__init__()` should accept the manager reference for broadcasting.
- **Session factory** (`backend/main.py:30`): `app.state.session_factory` — `GameSession` needs this for persisting game results to SQLite.
- **Frontend types** (`frontend/src/types/ws.ts`): Currently defines `JoinMessage`, `JoinedEvent`, `ErrorEvent`. Phase 2 adds `SubmitAnswer`, `TimerTick`, `RoundStarted`, `RoundResult`, `GameStarted`, `GameEnd` types. Phase 3 (Player Frontend) will complete the client-side event handling.

## Specific Ideas

No external references or "make it like X" examples were mentioned. Standard async Python patterns expected — `asyncio.create_task()` for the game loop, `asyncio.sleep()` for timing, `asyncio.Event` or similar for state synchronization.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 2-Core Game Loop*
*Context gathered: 2026-05-30*
