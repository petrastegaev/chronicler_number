---
phase: 02-core-game-loop
reviewed: 2026-06-10T19:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - backend/game/__init__.py
  - backend/game/session.py
  - backend/game/tokens.py
  - backend/main.py
  - frontend/src/types/ws.ts
  - frontend/src/stores/gameStore.ts
findings:
  critical: 4
  warning: 4
  info: 3
  total: 11
status: issues_found
---

# Phase 02: Core Game Loop -- Code Review Report

**Reviewed:** 2026-06-10T19:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The implementation is structurally complete with a well-designed GameSession state machine, session token store, WebSocket event dispatch, TypeScript types, and Zustand store. However, there are 4 critical issues -- one data loss risk from an atomicity violation in `_persist_game`, two race conditions in the admin disconnect/restart path that can orphan WebSocket connections, and a blocking import cycle that prevents the application from starting. Additionally, 4 warnings and 3 info items should be addressed before shipping.

## Critical Issues

### CR-01: Transaction atomicity violation -- Stat.game_count increment not guarded by fetch-lock or serialized

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/game/session.py:210-213`
**Issue:** `_persist_game()` performs a read-then-write on `Stat.game_count` without any locking or serialization mechanism. The code reads `Stat.game_count`, increments it in memory, and commits. With SQLite's default transaction isolation (`DEFERRED`), two concurrent game sessions that finish at nearly the same time will both read the same `game_count` value (e.g., 5), both increment to 6, and the second write silently overwrites the first. This is a classic lost-update bug. While the project is currently single-game session, this is a fragile invariant (the count is supposed to track total games played) that will silently drift if multiple sessions ever overlap. Additionally, the existing `Stat` table has no unique constraint beyond `id` -- the `LIMIT 1` fetch is non-deterministic if multiple rows exist.
**Fix:** Use an atomic SQL `UPDATE stats SET game_count = game_count + 1 WHERE id = (SELECT id FROM stats LIMIT 1)` or use SQLAlchemy's `for_update()` within a serialized isolation level. Alternatively, remove the read-then-write pattern entirely by using a raw SQL update:

```python
await db.execute(
    text("UPDATE stats SET game_count = game_count + 1 WHERE id = (SELECT id FROM stats ORDER BY id LIMIT 1)")
)
```

This also requires importing `text` from `sqlalchemy`.

### CR-02: Admin WebSocket disconnect orphans players -- no `game_reset` broadcast sent

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/main.py:217-222`
**Issue:** When the admin WebSocket disconnects, the code cancels `game_task`, sets `game_task = None`, and sets `active_session = None`. However, it does NOT broadcast a `game_reset` event to the remaining player connections. Players will still be connected, waiting for events that will never arrive, with no indication that the game was terminated. Since the disconnect handler only fires for the disconnecting socket, `manager.broadcast()` would need to be called explicitly for the remaining players. This results in silently orphaned player WebSocket connections with no error feedback.
**Fix:** Add a broadcast call before clearing state in the admin disconnect path:

```python
elif manager.admin == websocket:
    manager.admin = None
    await manager.broadcast({
        "event": "game_reset",
        "data": {"message": "Admin disconnected -- game terminated"}
    })
    if game_task is not None and not game_task.done():
        game_task.cancel()
        game_task = None
        active_session = None
```

### CR-03: `reset_game()` broadcasts after setting `active_session = None` -- race with reconnect path

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/main.py:23-35`
**Issue:** The `reset_game()` function sets `active_session = None` on line 31 and then broadcasts `game_reset` on line 32-35. Between these two operations (in an async context), a reconnecting client's WebSocket handler at line 108 (`if active_session is not None and ...`) could execute and find `active_session` already `None`, thus NOT sending the `state_snapshot` that the client needs. This is a TOCTOU race with every concurrently executing WebSocket handler. The broadcast is also a `send_json` that could fail silently -- if the broadcast fails (e.g., connection already closed), state was already cleared for no benefit.
**Fix:** Broadcast `game_reset` BEFORE clearing `active_session`, and consider wrapping the broadcast in a try-except:

```python
async def reset_game():
    global active_session, game_task
    if active_session is None or active_session.state in ("waiting_for_players",):
        return
    await manager.broadcast({
        "event": "game_reset",
        "data": {"message": "Game has been reset by admin"}
    })
    if game_task is not None and not game_task.done():
        game_task.cancel()
        game_task = None
    active_session = None
```

### CR-04: `remove_token()` is never called -- tokens accumulate indefinitely

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/game/tokens.py:19-21` and `/home/petr/IdeaProjects/PetProjects/number_game/backend/main.py`
**Issue:** The `remove_token()` function is defined in `tokens.py` but is never imported or called anywhere in `main.py` (or any other file in the project). Every player connect, reconnect, and disconnect generates a new token via `generate_token()`, but tokens are never cleaned up. Since tokens are stored in an in-memory dict with no TTL or eviction policy, long-running booth operation will cause unbounded memory growth. This is a memory leak that becomes a denial-of-service risk over a multi-day conference.
**Fix:** Call `remove_token()` when a player/admin WebSocket disconnects. Also consider adding a TTL-based cleanup mechanism (e.g., `@dataclass` with `expires_at` timestamp) for stale tokens.

```python
# In main.py disconnect handler:
if manager.player1 == websocket:
    # remove_token(?) -- need to store token ref on ConnectionManager as well
    manager.player1 = None
    manager.player1_nickname = None
```

Note: This fix requires also storing the token string on the `ConnectionManager` so it can be looked up on disconnect. Alternatively, implement a periodic cleanup of stale tokens.

## Warnings

### WR-01: `state_snapshot` sent during admin reconnect but `state_snapshot` type is missing `player1_nickname` and `player2_nickname`

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/frontend/src/types/ws.ts:117-125` and `/home/petr/IdeaProjects/PetProjects/number_game/backend/main.py:108-118`
**Issue:** The `state_snapshot` event sent on reconnect (server line 108-118) includes `state`, `current_round`, `remaining`, and `question_text`. However, it does NOT include `player1_nickname`, `player2_nickname`, `player1_score`, or `player2_score`. A reconnecting client will have no idea who the players are or what the current score is. The frontend type `StateSnapshotEvent` only declares `state`, `current_round`, `remaining`, and `question_text`, but a UI component would likely need the nicknames and scores to render the game state correctly.
**Fix:** Add `player1_nickname`, `player2_nickname`, and current scores to the `state_snapshot` payload on both server and frontend type.

### WR-02: `restart` event accepted even when `active_session` is in `waiting_for_players` state

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/main.py:207-208`
**Issue:** The admin `restart` event unconditionally calls `reset_game()`. Inside `reset_game()`, the guard at line 26 (`if active_session is None or active_session.state in ("waiting_for_players",)`) causes the function to return early if the session is in `waiting_for_players` state. However, the admin receives no error feedback -- they pressed "restart" and nothing happened, silently. This is a poor UX that the admin may interpret as a bug. Additionally, `reset_game()` checks `active_session.state` after the null check, but `active_session` is a global that could be set to `None` by another coroutine between lines 26 and 27 (TOCTOU).
**Fix:** Either (a) add a `game_reset` broadcast in the early-return path to confirm "no active game", or (b) change the early return to allow "resetting" even from `waiting_for_players` (which would just broadcast `game_reset` and return to lobby cleanly).

### WR-03: `_finish_game` can race with `reset_game`/admin disconnect for task cancellation

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/game/session.py:148-182` and `/home/petr/IdeaProjects/PetProjects/number_game/backend/main.py:28-29`
**Issue:** `_finish_game` runs `asyncio.shield(self._persist_game(winner))` to protect persistence from cancellation. However, the `manager.broadcast()` call at line 176 (the `game_end` broadcast) runs BEFORE the shield. If the admin sends `restart` or disconnects WHILE `_finish_game` is running (between the broadcast and the shield), `game_task.cancel()` at line 29/time 220 will cancel the task. The broadcast at line 176 will be interrupted, meaning players may not receive `game_end` even though the game completed naturally. The shield only protects `_persist_game`, not the broadcast.
**Fix:** Either (a) await the broadcast before allowing cancellation, or (b) shield the entire `_finish_game` method body (not just `_persist_game`), or (c) in the `reset_game()` function, send the `game_reset` cancellation message from the admin side rather than cancelling the game task directly.

### WR-04: `JoinedEvent` frontend type is missing `token` field

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/frontend/src/types/ws.ts:14-21`
**Issue:** The `JoinedEvent` interface has `player_number` and `nickname` as optional fields but is missing the `token` field entirely. The server sends `token` in the `joined` event payload at both the admin join (main.py:146: `"token": token`) and player join (main.py:170: `"token": token`) paths. The frontend will receive this data but TypeScript will not know about it at compile time, requiring `as any` casts or accessing `data.token` with a type error. The reconnect path also sends `token` in the `joined` event data (main.py:85: `"token": reconnect_token`, main.py:105: `"token": reconnect_token`). The admin join does NOT send `nickname` (main.py:146), so `nickname` being optional is correct for admin, but the admin join sends no `player_number` which is already correct.
**Fix:** Add `token: string` to `JoinedEvent.data`:

```typescript
export interface JoinedEvent extends WsMessage {
  event: 'joined'
  data: {
    role: 'player' | 'admin'
    player_number?: number
    nickname?: string
    token: string
  }
}
```

## Info

### IN-01: Empty `__init__.py` -- no exports for the `game` package

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/game/__init__.py:1`
**Issue:** The `__init__.py` is completely empty (0 lines). While this is valid Python (package marker only), the neighboring `main.py` imports from `game.session` and `game.tokens` using fully qualified paths. Users of the `game` package outside of `main.py` would need to know these module paths. Exposing `GameSession`, `generate_token`, `restore_from_token`, and `remove_token` in `__init__.py` would provide a cleaner public API.
**Fix (optional):**
```python
from game.session import GameSession
from game.tokens import generate_token, restore_from_token, remove_token
```

### IN-02: `remove_token` defined but dead -- no callers anywhere

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/backend/game/tokens.py:19-21`
**Issue:** As noted in CR-04, `remove_token` is never called. Beyond the memory leak concern, dead code that is exported should either be removed or wired. If left dead, it will silently rot as the codebase evolves (callers may appear that expect it to work, only to find it was never tested in practice).
**Fix:** Remove the function if no immediate use case exists, or wire it into the disconnect handler in main.py.

### IN-03: `setPlayerNumber` action exists but no WebSocket handler calls it

**File:** `/home/petr/IdeaProjects/PetProjects/number_game/frontend/src/stores/gameStore.ts:46`
**Issue:** The Zustand store exposes `setPlayerNumber` action, and the `playerNumber` state field is defined. However, there is no WebSocket message handler in the reviewed files that calls `setPlayerNumber`. The server sends `player_number` in the `joined` event (main.py:168), and the `JoinedEvent.data` type includes `player_number`, but no code in the reviewed store wires the two together. This field will remain `null` throughout the game lifecycle. This is either (a) deferred to Phase 3 as implied by the comment on line 14, or (b) an omission. If intentionally deferred, a code comment should note this. If an oversight, the join handler should call `setPlayerNumber`.
**Fix:** Either add a comment documenting this as deferred, or wire the join handler to call `setPlayerNumber` when the `joined` event is received.

---

_Reviewed: 2026-06-10T19:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
