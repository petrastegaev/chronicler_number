---
phase: 04-admin-panel-question-management
reviewed: 2026-06-10T12:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - backend/main.py
  - backend/routers/questions.py
  - backend/routers/stats.py
  - backend/schemas.py
  - backend/services/question_service.py
  - frontend/src/components/admin/BottomTabBar.tsx
  - frontend/src/components/admin/ConfirmDialog.tsx
  - frontend/src/components/admin/CsvImportTab.tsx
  - frontend/src/components/admin/GameControlTab.tsx
  - frontend/src/components/admin/GameStats.tsx
  - frontend/src/components/admin/PlayerSlot.tsx
  - frontend/src/components/admin/QuestionAddTab.tsx
  - frontend/src/components/admin/QuestionListTab.tsx
  - frontend/src/components/admin/QuestionsTab.tsx
  - frontend/src/components/admin/Toast.tsx
  - frontend/src/hooks/useAdminWebSocket.ts
  - frontend/src/pages/AdminPage.tsx
  - frontend/src/stores/adminStore.ts
  - backend/game/session.py
  - backend/game/tokens.py
  - backend/connection_manager.py
  - backend/models.py
  - backend/database.py
  - frontend/src/types/ws.ts
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 04: Code Review Report — Admin Panel + Question Management

**Reviewed:** 2026-06-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This review covers the admin panel backend (FastAPI routes for questions and stats, CSV import, question service layer) and frontend (admin React components, WebSocket hook, Zustand store). The code is generally well-structured with good separation of concerns. However, several critical issues were found: CSV injection vulnerability via the question text field, a data loss edge case during CSV import with partial commit semantics, and a wrong HTTP method (POST instead of GET) for stats display. Several warnings around inconsistent error handling and race conditions in the admin WebSocket connection flow are also present.

## Critical Issues

### CR-01: CSV Injection — malicious question text can execute formulas in Excel/Google Sheets

**File:** `backend/services/question_service.py:51-93`
**Issue:** The `csv_import` method reads CSV rows and stores question text verbatim in the database. When a CSV row like `=HYPERLINK("http://evil.com","Click here"),42` is imported, the text field starts with `=`. If an admin later exports questions or views them in a spreadsheet application, Excel/Google Sheets will execute the formula. This is a classic CSV injection (aka formula injection) vulnerability. The question text is displayed in the admin panel and could be used as an attack vector against booth staff who might export data.

Note: This code does not itself generate a CSV export, but importing formula-prefixed data creates a downstream risk if any CSV export feature is added later or if the admin pastes data into a spreadsheet. The safe practice is to sanitize at import time.

**Fix:** In `csv_import`, after extracting `text = row[0].strip()`, prepend a single quote or reject text starting with `=`, `+`, `-`, `@`:

```python
text = row[0].strip()
if text and text[0] in ('=', '+', '-', '@'):
    errors.append(f"Строка {row_num}: Текст вопроса не может начинаться с '{text[0]}' (защита от CSV-инъекции)")
    continue
```

### CR-02: CSV import commits valid rows even when some rows fail, without transactional rollback

**File:** `backend/services/question_service.py:56-93`
**Issue:** The `csv_import` method calls `await QuestionService.create(db, ...)` inside the loop (line 90), which performs `db.commit()` inside the `create` method (question_service.py line 29). This means each successfully imported row is committed individually. If an error occurs on a later row, the earlier rows are already persisted. There is no outer transaction wrapping the entire import. The caller (`upload_csv` in `questions.py:44-46`) does not manage a transaction either. This leads to partial imports, which can leave the database in an inconsistent state from the user's perspective (they see "added: 8" but may retry and get duplicates).

**Fix:** Move the commit out of the individual `create` method and wrap the entire CSV import in a single transaction:

```python
@staticmethod
async def csv_import(db: AsyncSession, file_content: bytes) -> dict:
    added = 0
    errors: list[str] = []
    reader = csv.reader(io.StringIO(file_content.decode("utf-8-sig")))
    for row_num, row in enumerate(reader, start=1):
        # ... validation logic (same) ...
        question = Question(text=text, answer=answer, category=category)
        db.add(question)
        added += 1
    if added > 0:
        await db.commit()
    return {"added": added, "errors": errors}
```

And revert `create` to not auto-commit, or introduce a separate bulk import method that doesn't commit per-row.

### CR-03: `game_reset` event on admin disconnect triggers full game cancellation with no confirmation

**File:** `backend/main.py:228-233`
**Issue:** When the admin's WebSocket disconnects for any reason (network blip, phone goes to sleep, accidental page close), the code immediately cancels the `game_task` and sets `active_session = None`, terminating any in-progress game for both players. This is unrecoverable — both players are kicked and the game state is destroyed. The `reset_game()` function broadcasts `game_reset` to both players. There is no grace period, no reconnect window, and no way for the admin to resume the game that was in progress. While the admin reconnection path exists (lines 78-129, via token), it only handles the admin re-joining — the destroyed game session cannot be recovered because `active_session` is set to None.

**Fix:** Implement a grace period before destroying the game state. For example, set a timer when admin disconnects during an active game, and only cancel if the admin doesn't reconnect within 15 seconds. OR, keep the game session alive and let reconnecting admin get a `state_snapshot` (which the reconnection path already partially supports on lines 111-121).

```python
elif manager.admin == websocket:
    manager.admin = None
    # Don't immediately cancel if game is in progress
    if active_session is not None and active_session.state not in ("waiting_for_players", "ready", "finished"):
        # Set admin as disconnected but keep game running for a grace period
        # A reconnecting admin can resume via token
        pass
    else:
        if game_task is not None and not game_task.done():
            game_task.cancel()
            game_task = None
            active_session = None
```

## Warnings

### WR-01: Stats endpoint returns wrong HTTP method — POST used where GET should be used

**File:** `frontend/src/components/admin/GameStats.tsx:9`
**Issue:** The `GameStats` component correctly uses `fetch` (GET semantics), but the route at `/api/stats` exists. The issue is that the backend `stats.py` router uses the same response type as `CsvImportResponse` pattern but the stats data is not refreshed after game completion. More importantly, the `GameControlTab.tsx` component has a comment on line 28: "Game count fetched by <GameStats /> component". The `GameStats` component fetches stats via `fetch` in a `useEffect` with an empty dependency array, meaning it only fetches once on mount and never refreshes after a game finishes. This means the game count displayed in the admin panel will be stale for the entire session after the first load.

**Fix:** Trigger a stats refresh when the game phase transitions to `finished`. For example, expose a `refreshGameCount` callback from `GameStats` or move the fetch trigger into a `useEffect` that depends on a game-ended event:

```typescript
// In GameControlTab.tsx, add a key prop that changes when phase becomes 'finished'
// This forces GameStats to remount and re-fetch
<GameStats key={phase === 'finished' ? 'finished-' + Date.now() : 'lobby'} />
```

### WR-02: Admin WebSocket `connect` has no guard against duplicate connections

**File:** `frontend/src/hooks/useAdminWebSocket.ts:9-88`
**Issue:** The `connect` function creates a new WebSocket every time it is called. The `GameControlTab` component uses a `connectedRef` to call it only once (line 22-26), but this is a local ref in the component. If `GameControlTab` unmounts and remounts (which can happen due to React Strict Mode in development, or if the admin switches tabs and React re-renders the component tree), the ref resets and a duplicate WebSocket connection is created. The old one is closed via the cleanup effect (line 110-114), but there is a race window where two connections exist simultaneously and the server may reject the second one ("Admin slot already taken"). The cleanup effect closes the old connection on unmount, but the new connection's `onopen` fires before the old one is fully torn down.

**Fix:** Move the `wsRef` check into the `connect` function itself:

```typescript
const connect = useCallback(() => {
  if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
    return // Already connected or connecting
  }
  // ... rest of connect logic
}, [])
```

### WR-03: `player_joined` event handler does not set player1 nickname

**File:** `frontend/src/hooks/useAdminWebSocket.ts:66-69`
**Issue:** The `player_joined` event only updates `player2Nickname` (line 68). However, the `GameControlTab.tsx` component (line 36-37) checks `player1Nickname.length > 0` to determine if player 1 is online. When player 1 joins before player 2, the `joined` event for the admin (line 30-36 in the same hook) does not include `player1_nickname` or `player2_nickname` in the data — it only processes `role` and `token`. The `game_started` event (line 38-42) does set both nicknames via `setGameStarted`, but until the game starts, the admin UI will show player 1 as disconnected. The `joined` event from the server (main.py line 148-151) only sends `role` and `token` for admin — it does not include any player nicknames.

**Fix:** Either the server should include current player nicknames in the admin's `joined` event, or the client should request them after joining. The fix on the server side in `main.py`:

```python
await websocket.send_json({
    "event": "joined",
    "data": {
        "role": "admin",
        "token": token,
        "player1_nickname": manager.player1_nickname or "",
        "player2_nickname": manager.player2_nickname or "",
    }
})
```

And on the client, handle them:
```typescript
case 'joined': {
  const data = msg.data as { role?: string; token?: string; player1_nickname?: string; player2_nickname?: string }
  store.setPhase('lobby')
  if (data.token) store.setToken(data.token)
  if (data.player1_nickname) store.setPlayer1Nickname(data.player1_nickname)
  if (data.player2_nickname) store.setPlayer2Nickname(data.player2_nickname)
  break
}
```

### WR-04: `restart` event is sent but `reset_game()` does not update connection state for the admin

**File:** `backend/main.py:218-219`
**Issue:** When the admin clicks "Restart", the client sends `{event: "restart"}`, which calls `reset_game()`. This function sets `active_session = None` and broadcasts `game_reset` to all connections. However, after the restart, the admin's WebSocket connection is still the same connection that was used during the game. The `resume` path in `main.py` (line 78-129) checks for a `token` query parameter, but the restart flow does not send a new token or re-establish the admin's state. The admin will receive the `game_reset` event and the client's `resetForRestart` action sets the phase to `lobby`, but the admin's WebSocket is still connected with the old join — this works in practice but relies on the admin connection not having been cleaned up. More critically, if `reset_game()` runs while a game is in progress and the admin has a reconnect token that refers to the old session, that token is never invalidated.

**Fix:** Clear reconnect tokens for all participants when resetting:

```python
# In reset_game() or nearby
from game.tokens import _reconnect_tokens
_reconnect_tokens.clear()
```

### WR-05: CSV preview parsing is naive — does not handle quoted commas or newlines in fields

**File:** `frontend/src/components/admin/CsvImportTab.tsx:46-55`
**Issue:** The CSV preview function splits by newline and then by comma (`line.split(',')`). This does not handle:
1. Commas inside quoted fields (e.g., `"Question, part 2",42`)
2. Newlines inside quoted fields (multi-line questions)
3. BOM character at start of file (the backend handles this with `utf-8-sig` but the frontend uses `readAsText` without any encoding parameter)

The preview will show incorrect data for any CSV that uses quoting, which is common for user-generated CSV files. The backend `QuestionService.csv_import` uses Python's `csv.reader` which handles all of these correctly, so the backend will import correctly but the preview will mislead the user.

**Fix:** Either parse the CSV properly in the frontend (using a library like `papaparse` or a manual CSV parser), or send the file to the server for preview parsing:

```typescript
// Minimal improvement: send to backend for preview rows
// This is more complex but avoids duplicating CSV parsing logic
```

### WR-06: `question_service.py::create` method on line 29 calls `db.commit()` per-insert, making bulk operations unsafe

**File:** `backend/services/question_service.py:26-31`
**Issue:** The `create` method commits the session after every single question insert. This is called both from the single-question POST endpoint (expected) and from the CSV import loop (unexpected — see CR-02). Even for the single-question endpoint, auto-committing at this layer means any future code that calls this method within a larger transaction will have its inner transaction committed prematurely, violating the caller's transactional expectations. This is a design smell that encourages the partial-commit pattern.

**Fix:** Remove `db.commit()` and `db.refresh()` from `create`, and let the caller (the route handler) manage the transaction:

```python
@staticmethod
async def create(db: AsyncSession, text: str, answer: int, category: str = None):
    question = Question(text=text, answer=answer, category=category)
    db.add(question)
    return question  # caller commits
```

Then in the route handler:
```python
@router.post("/", response_model=QuestionResponse, status_code=201)
async def create_question(data: QuestionCreate, db: AsyncSession = Depends(get_db)):
    question = await QuestionService.create(db, text=data.text, answer=data.answer, category=data.category)
    await db.commit()
    await db.refresh(question)
    return question
```

## Info

### IN-01: `GameStats.tsx` catch block is empty with only a comment

**File:** `frontend/src/components/admin/GameStats.tsx:13-15`
**Issue:** The `.catch()` handler is empty — it silently swallows network errors. While this is a common pattern in React for non-critical data, there is no visual feedback to the admin that stats failed to load. At minimum, the error should be logged to console for debugging.

**Fix:** Add `console.warn` or a comment explaining the intentional silence:

```typescript
.catch((err) => {
  console.warn('[Stats] Failed to fetch game count:', err)
})
```

### IN-02: Magic number `9` appears in multiple places without a named constant

**Files:** `backend/main.py:208`, `backend/services/question_service.py:43-45`, `backend/game/session.py:45`
**Issue:** The number `9` (number of questions per game) appears hardcoded in three different files. It is used as the round count (`range(1, 10)`), the random selection count, and the minimum check. If the round count ever changes, all three locations must be updated. This should be a named constant.

**Fix:** Define `GAME_ROUND_COUNT = 9` in a shared config module:

```python
# config.py or constants.py
GAME_ROUND_COUNT = 9
```

### IN-03: `useAdminWebSocket` hook never sends `token` on reconnection

**File:** `frontend/src/hooks/useAdminWebSocket.ts:12-23`
**Issue:** The `connect` function opens a WebSocket but does not include the stored `token` as a query parameter, even though the server supports reconnection via `token` query parameter (main.py lines 78-129). If the admin's WebSocket disconnects and the `GameControlTab` component remounts (triggering a new `connect` call), the new connection will not pass a token and will be treated as a fresh connection. This means a reconnecting admin cannot resume their session.

**Fix:** Include the token in the WebSocket URL if one exists in the store:

```typescript
const connect = useCallback(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const token = useAdminStore.getState().token
  const wsUrl = token ? `${protocol}//${host}/ws?token=${token}` : `${protocol}//${host}/ws`
  // ... rest of the function
}, [])
```

---

_Reviewed: 2026-06-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
