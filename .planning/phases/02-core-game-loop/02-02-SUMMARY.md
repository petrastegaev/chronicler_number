---
phase: 02-core-game-loop
plan: 02
subsystem: websocket-integration-contracts
tags: [websocket, event-dispatch, gameloop-lifecycle, reconnect, session-tokens, typescript-types, zustand-store]
provides: [main.py-game-event-dispatch, frontend-ws-types, frontend-game-store]
requires: [02-01]
affects: [main.py, ws.ts, gameStore.ts]
tech-stack:
  added: []
  patterns:
    - Role-based event dispatch in WebSocket receive loop (player vs admin routing)
    - Session token generation on join and validation on reconnect
    - State snapshot broadcast on reconnect for in-progress game continuity
key-files:
  created: []
  modified:
    - backend/main.py
    - frontend/src/types/ws.ts
    - frontend/src/stores/gameStore.ts
decisions:
  - "admin start_game event embeds QuestionService.random_selection() inline inside the WebSocket handler, creating GameSession via asyncio.create_task() after sufficient questions verified"
  - "Reconnect path sends state_snapshot with current state, round number, remaining time, and question text (not full scores/answers) per D-06"
  - "game_task lifecycle check prevents double-session race: second start_game is silently ignored if game_task exists and is not done"
  - "admin disconnect cancels game_task and clears active_session to prevent orphan game loops"
metrics:
  duration: ~5 min
  completed: 2026-06-10
  tasks: 3/3
  files_created: 0
  files_modified: 3
  commits: 3
---

# Phase 2 Plan 02: WebSocket Integration + Contracts

Integrated the GameSession engine with the WebSocket layer. Extended `backend/main.py` to dispatch game events (`submit_answer`, `start_game`, `restart`) to the active GameSession, manage GameSession lifecycle (create on admin start, cancel on admin disconnect), and add session token support for JOIN-05 including reconnect flow with state snapshot. Also added frontend contracts: 11 TypeScript interfaces for all game events and an extended Zustand store with game state fields and actions.

## Deviations from Plan

None -- plan executed exactly as written.

## Key Decisions

- **`start_game` embeds question selection inline:** The plan specifies calling `QuestionService.random_selection()` from inside the `start_game` event handler before creating the GameSession. This ensures questions are fetched at game start (not pre-loaded), and the 9-question minimum check happens synchronously before the session is created.
- **Reconnect state snapshot scope:** The `state_snapshot` sends current game phase, round number, remaining time, and question text -- but not scores or player answers, which aligns with D-06 (state snapshot on reconnect, not full state replay).
- **game_task as lifecycle guard:** Uses the task reference (not session state) as the primary double-session race guard (`game_task is not None and not game_task.done()`), which catches races before the GameSession has transitioned out of `waiting_for_players`.

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `backend/main.py` | Added game event dispatch, GameSession lifecycle, session tokens, reconnect path, game_task lifecycle guard, admin disconnect cleanup | 108 -> 226 |
| `frontend/src/types/ws.ts` | Added 11 game event TypeScript interfaces | 29 -> 126 |
| `frontend/src/stores/gameStore.ts` | Replaced simple phase-only store with full game state + actions | 9 -> 68 |

## Threat Model Mitigations

| Threat ID | Category | Component | Status |
|-----------|----------|-----------|--------|
| T-02-01 | Spoofing | Event dispatch | Mitigated: role-based WebSocket reference check (`websocket in (manager.player1, manager.player2)` vs `websocket == manager.admin`) |
| T-02-02 | Tampering | submit_answer | Delegated to GameSession.submit_answer() first-answer-wins |
| T-02-03 | Info Disclosure | Answer secrecy | Delegated to GameSession (no individual answer broadcast) |
| T-02-04 | DoS | Timer manipulation | Delegated to GameSession server-authoritative timer |
| T-02-05 | Tampering | Late answer | Delegated to GameSession state guard |
| T-02-06 | Spoofing | Token guessing | Delegated to tokens.py (UUID v4 hex, accepted risk) |
| T-02-07 | Tampering | Persistence | Delegated to GameSession asyncio.shield() |
| T-02-08 | Tampering | Restart double-tap | Mitigated: reset_game() checks `active_session is None or state == waiting_for_players` before proceeding |
| T-02-09 | Spoofing | Invalid token reconnect | Mitigated: restore_from_token() returns None for unknown tokens; error sent + WebSocket closed |
| T-02-10 | Tampering | Double-session race | Mitigated: start_game guard checks `game_task is not None and not game_task.done()` before creating new session |

## Verification

### Automated Checks

```bash
$ python -c "from game.session import GameSession; from game.tokens import generate_token; import main"
All backend imports OK

$ npx tsc --noEmit
Frontend TypeScript compilation OK
```

### Acceptance Criteria Checklist

- [x] `backend/main.py` contains `from game.session import GameSession`
- [x] `backend/main.py` contains `from game.tokens import generate_token`
- [x] `backend/main.py` contains `active_session: Optional[GameSession] = None`
- [x] `backend/main.py` contains `game_task: Optional[asyncio.Task] = None`
- [x] `backend/main.py` contains `async def reset_game()`
- [x] `backend/main.py` contains `"event": "game_reset"` (inside reset_game)
- [x] `backend/main.py` contains `"submit_answer"` in the event dispatch
- [x] `backend/main.py` contains `"start_game"` in the admin event dispatch
- [x] `backend/main.py` contains `"restart"` in the admin event dispatch
- [x] `backend/main.py` contains `asyncio.create_task(active_session.run`
- [x] `backend/main.py` contains `QuestionService.random_selection`
- [x] `backend/main.py` contains `len(questions) < 9` (question pool check)
- [x] `backend/main.py` contains `generate_token(` in the player join branch
- [x] `backend/main.py` contains `"token": token` in join response
- [x] `backend/main.py` contains `restore_from_token(` for reconnect path (D-06)
- [x] `backend/main.py` contains `"state_snapshot"` for reconnect state restore (D-06)
- [x] `backend/main.py` contains `game_task.cancel()` in admin disconnect handler
- [x] `backend/main.py` contains `game_task is not None and not game_task.done()` for start_game guard
- [x] `backend/main.py` does NOT contain bare `while True: await websocket.receive_json()` without event dispatch
- [x] `python -c "import main"` exits 0
- [x] `frontend/src/types/ws.ts` exports all 11 game event interfaces
- [x] `frontend/src/types/ws.ts` TypeScript compiles clean
- [x] `frontend/src/stores/gameStore.ts` contains interface GameState + GameActions
- [x] `frontend/src/stores/gameStore.ts` contains `playerNumber: 1 | 2 | null`
- [x] `frontend/src/stores/gameStore.ts` contains `setGameStarted`, `setRoundStarted`, `setTimer`, `setScoreUpdate`
- [x] `frontend/src/stores/gameStore.ts` contains `totalRounds: 9`, `remaining: 10`
- [x] `frontend/src/stores/gameStore.ts` TypeScript compiles clean

## Commits

| Hash | Message |
|------|---------|
| `492fe86` | feat(02-core-game-loop-02): extend main.py with game event dispatch, GameSession lifecycle, session token support, and reconnect path |
| `73ee597` | feat(02-core-game-loop-02): add TypeScript interfaces for all Phase 2 game events |
| `9d0814a` | feat(02-core-game-loop-02): extend Zustand store with game state fields and actions |

## Self-Check: PASSED

All files exist, imports succeed, TypeScript compiles clean, grep invariants verified.
