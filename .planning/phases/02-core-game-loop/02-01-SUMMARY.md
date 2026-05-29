---
phase: 02-core-game-loop
plan: 01
subsystem: core-game-engine
tags: [game-session, state-machine, timer, scoring, persistence, tokens]
provides: [GameSession, session-token-store]
affects: [main.py]
metrics:
  duration: ~5 min
  completed: 2026-05-30
  tasks: 2/2
  files_created: 3
  commits: 2
---

# Phase 2 Plan 01: Core Game Engine -- GameSession and Session Tokens

Server-authoritative game state machine (`GameSession`) with 10-second `asyncio.sleep(1)` timer loop, proximity scoring by absolute difference (closest wins, ties draw), first-answer-wins collection policy, and `asyncio.shield()`-protected SQLite persistence at game end. Also provides a module-level in-memory token store (`backend/game/tokens.py`) for JOIN-05 player reconnect support.

## Deviations from Plan

None -- plan executed exactly as written.

## Key Decisions

- **`_persist_game(winner_nickname)` takes winner as parameter** (not reading from `self`, matching the RESEARCH.md Code Example signature). The call `asyncio.shield(self._persist_game(winner))` passes the computed winner.
- **Token store uses `dict.get()` for restore** (returns `None` for missing keys, matching the `restore_from_token` spec).
- **Fairness window is 50ms** (`asyncio.sleep(0.05)` after timer expiry before state transitions to `showing_result`), following Pitfall 2 mitigation from RESEARCH.md.
- **`_remaining` stored at `self._remaining`** on each timer tick, available for D-06 reconnect state snapshots (consumed in 02-02).

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `backend/game/__init__.py` | Package init (empty, matching backend convention) | 1 |
| `backend/game/session.py` | GameSession class -- state machine, timer, scoring, persistence | 215 |
| `backend/game/tokens.py` | Session token store -- generate, restore, remove | 21 |

## Implementation Details

### GameSession State Machine

```
waiting_for_players -> ready -> in_progress (presenting_question -> accepting_answers -> showing_result) -> finished
```

### Methods

1. **`run(questions)`** -- Main game loop: stores questions, broadcasts `game_started`, awaits admin start event, iterates 9 rounds, calls `_finish_game()`.
2. **`_run_round(question)`** -- Single round: resets answers, broadcasts `round_started` + 11 `timer_tick` events (10 down to 0), waits 50ms fairness window, computes result, broadcasts `round_result` + admin `score_update`, 3-second pause.
3. **`submit_answer(player_num, answer)`** -- Synchronous method, first-answer-wins, silently ignores if state != `accepting_answers`.
4. **`_compute_round_result(question)`** -- Proximity scoring: `abs(answer - correct)`, smaller wins, tie = "draw".
5. **`_finish_game()`** -- Determines winner nickname, broadcasts `game_end` with full round-by-round data, calls `asyncio.shield(_persist_game(winner))`.
6. **`_persist_game(winner_nickname)`** -- SQLite: creates GameSessionModel + 9 Round records + increments Stat.game_count.

### Session Token Store (tokens.py)

- `generate_token(nickname, role)` -- Returns 32-char UUID v4 hex string.
- `restore_from_token(token)` -- Returns session dict or None.
- `remove_token(token)` -- Removes token from in-memory dict.

### Threat Model Mitigations

- **T-02-01 (First-answer-wins):** `submit_answer()` checks `self.p1_answer is None` before accepting; state guard prevents out-of-phase submissions.
- **T-02-02 (Answer secrecy):** No broadcast calls involving `p1_answer` / `p2_answer` outside `round_result` (verified by grep).
- **T-02-03 (Timer manipulation):** Server-authoritative timer via `asyncio.sleep(1)` loop.
- **T-02-04 (Late answer injection):** State check `self.state == "accepting_answers"` before accepting answers.
- **T-02-05 (Task cancellation):** `asyncio.shield()` wraps `_persist_game()` call.
- **T-02-07 (Token guessing):** UUID v4 hex (122 bits entropy), accepted risk for local WiFi booth.
- **T-02-06 (Admin restart double-tap):** Idempotency guard will be handled in 02-02.

## Verification

### Automated Checks

```bash
$ cd backend && python -c "from game.session import GameSession; print('OK')"
OK
$ cd backend && python -c "from game.tokens import generate_token, restore_from_token, remove_token; print('OK')"  
OK
$ cd backend && python -c "
from game.tokens import generate_token, restore_from_token, remove_token
token = generate_token('TestPlayer', 'player')
assert token and len(token) == 32
data = restore_from_token(token)
assert data == {'nickname': 'TestPlayer', 'role': 'player'}
assert restore_from_token('nonexistent') is None
remove_token(token)
assert restore_from_token(token) is None
print('All token tests passed')
"
All token tests passed
```

### Acceptance Criteria Checklist

- [x] `backend/game/__init__.py` exists and is empty
- [x] `backend/game/session.py` exists, 215 lines (minimum 200)
- [x] `backend/game/session.py` contains `class GameSession`
- [x] Contains `async def run(self`
- [x] Contains `async def _run_round(self`
- [x] Contains `def submit_answer(self`
- [x] Contains `def _compute_round_result`
- [x] Contains `async def _finish_game`
- [x] Contains `async def _persist_game`
- [x] Contains `asyncio.shield`
- [x] Contains `self.start_event = asyncio.Event()`
- [x] Contains `import asyncio`
- [x] Contains `from connection_manager import ConnectionManager`
- [x] Contains `self._remaining`
- [x] `python -c "from game.session import GameSession"` exits 0
- [x] No `multiprocessing` or `threading`
- [x] No broadcast of individual answers (GAME-04)
- [x] `backend/game/tokens.py` contains `generate_token`, `restore_from_token`, `remove_token`
- [x] `backend/game/tokens.py` contains `uuid.uuid4().hex`
- [x] `backend/game/tokens.py` contains `_reconnect_tokens: dict[str, dict] = {}`
- [x] All token verification assertions pass

## Self-Check: PASSED

All files exist, imports succeed, token tests pass, grep invariants verified.
