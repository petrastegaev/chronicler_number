---
phase: 04-admin-panel-question-management
reviewed: 2026-06-10T21:30:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - backend/main.py
  - backend/routers/questions.py
  - backend/routers/stats.py
  - backend/schemas.py
  - backend/services/question_service.py
  - backend/game/tokens.py
  - backend/game/session.py
  - backend/connection_manager.py
  - backend/database.py
  - backend/models.py
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
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 04: Admin Panel and Question Management -- Code Review Report

**Reviewed:** 2026-06-10T21:30:00Z
**Depth:** standard
**Files Reviewed:** 18 (across backend/ and frontend/)
**Status:** issues_found

## Summary

This review covers the admin panel backend (FastAPI routes for questions and stats, CSV import, question service layer, game session management, WebSocket handling) and frontend (admin React components, WebSocket hook, Zustand store). The codebase is generally well-structured with good separation of concerns. Two critical issues were found: an unauthenticated/unbounded CSV upload that can exhaust server memory, and a WebSocket answer injection race that bypasses the timer fairness window. Several warnings around resource leaks, missing input validation depth, and race conditions are also present.

## Critical Issues

### CR-01: CSV upload reads entire file into memory with no size limit (denial of service)

**File:** `backend/routers/questions.py:43-46`
**Issue:** The `upload_csv` endpoint reads the entire uploaded file into memory with `await file.read()` before any size validation. FastAPI's `UploadFile` does not impose any default size limit. An admin (or anyone on the local WiFi) could upload a multi-gigabyte CSV that exhausts server memory and crashes the Docker container. The parsed content is decoded and iterated in `question_service.csv_import`, which holds every row in memory simultaneously and commits per-row (see WR-06). There is also no maximum row count enforced, so even a moderately large CSV with hundreds of thousands of valid rows creates an unbounded transaction that blocks the single SQLite connection.

**Fix:** Impose a file size limit and a row count limit:

In `backend/routers/questions.py`:
```python
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/upload-csv", response_model=CsvImportResponse)
async def upload_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    result = await QuestionService.csv_import(db, content)
    return CsvImportResponse(**result)
```

In `backend/services/question_service.py`, add a row cap:
```python
MAX_ROWS = 5000
# Inside the loop, after added += 1:
if added >= MAX_ROWS:
    errors.append(f"Import stopped: maximum {MAX_ROWS} rows exceeded")
    break
```

### CR-02: Player answer submission race -- fairness window is ineffective due to event loop concurrency

**File:** `backend/main.py:194-198` + `backend/game/session.py:70-80`
**Issue:** The `submit_answer` handler in `main.py` (line 194-198) validates the answer type/range and calls `active_session.submit_answer(player_num, answer)`. Inside `GameSession.submit_answer()` (session.py:112-119), the only guard is `if self.state != "accepting_answers": return`. However, the game loop and the WebSocket message handler run as concurrent asyncio tasks. The timer loop (session.py:70-77) uses `asyncio.sleep(1)` between ticks, which _does_ yield to the event loop -- meaning `submit_answer` calls from the WebSocket can be processed _during_ the timer loop, before the fairness window at line 80. The 50ms fairness window comes after the last `asyncio.sleep(1)`, but `submit_answer` calls that arrived during `remaining=0` sleep were already accepted (since `remaining=0` still has the state at `"accepting_answers"`). Additionally, answers arriving during the 50ms sleep after the loop are accepted before `self.state` changes to `"showing_result"`. The result: a player whose answer arrives just before or during the fairness window can have their answer counted even though the timer has expired on the server side.

**Fix:** Use a deadline timestamp instead of relying on the state machine and sleep-based window. In `_run_round`:
```python
import time

async def _run_round(self, question):
    self.p1_answer = None
    self.p2_answer = None
    self.state = "accepting_answers"
    self.answer_deadline = time.monotonic() + 10.0

    for remaining in range(10, -1, -1):
        await self.manager.broadcast({"event": "timer_tick", "data": {"remaining": remaining}})
        self._remaining = remaining
        if remaining > 0:
            await asyncio.sleep(1)

    # Fairness window: give in-flight answers time to arrive
    await asyncio.sleep(0.05)
    self.state = "showing_result"
```

In `submit_answer`:
```python
def submit_answer(self, player_num: int, answer: int):
    if self.state != "accepting_answers":
        return
    if time.monotonic() > getattr(self, 'answer_deadline', 0):
        return
    if player_num == 1 and self.p1_answer is None:
        self.p1_answer = answer
    elif player_num == 2 and self.p2_answer is None:
        self.p2_answer = answer
```

## Warnings

### WR-01: Reconnect tokens grow unboundedly with no cleanup mechanism

**File:** `backend/game/tokens.py:4`
**Issue:** The `_reconnect_tokens` dict grows without bound. Each call to `generate_token` adds an entry, but `remove_token` is defined but never called anywhere in the entire codebase. Every WebSocket connection ever made leaks a token entry. Over a multi-day booth event with many connections/reconnections, this creates a slow memory leak. Additionally, tokens have no time-to-live, so a token from yesterday's session remains valid.

**Fix:** Call `remove_token` on WebSocket disconnect in `main.py`:
```python
# In the WebSocketDisconnect handler (around line 221-233), at the end:
from game.tokens import remove_token
# The token needs to be tracked per connection -- store it on the websocket object
# or pass it through the disconnect handler
```

Also add TTL-based expiry in `tokens.py`:
```python
import time
_reconnect_tokens: dict[str, dict] = {}
TOKEN_TTL = 3600  # 1 hour

def generate_token(nickname: str, role: str) -> str:
    token = uuid.uuid4().hex
    _reconnect_tokens[token] = {"nickname": nickname, "role": role, "created_at": time.time()}
    return token

def restore_from_token(token: str) -> dict | None:
    entry = _reconnect_tokens.get(token)
    if entry is None:
        return None
    if time.time() - entry["created_at"] > TOKEN_TTL:
        _reconnect_tokens.pop(token, None)
        return None
    return entry
```

### WR-02: Reconnecting player can displace existing player without closing old socket

**File:** `backend/main.py:90-98`
**Issue:** During reconnect (token-based resume), the code assigns the new WebSocket to `manager.player1` or `manager.player2` without ever closing the old WebSocket object. If a player's connection drops and they reconnect while the server still holds their old socket reference, the old socket becomes a zombie -- it may still appear to the server as an active connection but produce errors on `send_json` calls. The `all_connections` property (connection_manager.py:25-26) will include both old and new sockets, causing `broadcast` to hit the zombie socket. The `send_to_player` method (connection_manager.py:32-34) already catches exceptions, but this masks the underlying resource leak.

**Fix:** Before reassigning a slot, close the existing connection:
```python
if role == "player":
    nickname = session_data["nickname"]
    # Check if reconnecting to existing slot
    if manager.player1_nickname == nickname and manager.player1 is not None:
        old_ws = manager.player1
        manager.player1 = websocket
        await old_ws.close()
        player_num = 1
    elif manager.player2_nickname == nickname and manager.player2 is not None:
        old_ws = manager.player2
        manager.player2 = websocket
        await old_ws.close()
        player_num = 2
    else:
        # Assign to empty slot
        ...
```

### WR-03: Admin WebSocket authentication is absent -- anyone on the LAN can claim admin

**File:** `backend/main.py:138-151`
**Issue:** The WebSocket `join` event with `role: "admin"` requires no authentication. Any device on the local WiFi can connect as admin by sending `{"event": "join", "data": {"role": "admin"}}`. While this is a booth demo environment, the admin can start/restart games, reset sessions, and control the entire game flow. A malicious attendee could disrupt the demo by connecting as admin and issuing `start_game`, `restart`, or spamming the session. The "Admin slot already taken" check (line 139) prevents concurrent admins but does not prevent a race for the slot.

**Fix:** Require an admin key, configured via environment variable:
```python
import os

ADMIN_KEY = os.environ.get("ADMIN_KEY", "booth-admin-2026")

# In the admin join handler:
if role == "admin":
    admin_key = data.get("data", {}).get("admin_key", "")
    if admin_key != ADMIN_KEY:
        await websocket.send_json({
            "event": "error",
            "data": {"message": "Unauthorized admin access"}
        })
        await websocket.close()
        return
```

On the frontend, pass the admin key from a build-time or runtime configuration.

### WR-04: `GameStats` component never refreshes after game completion

**File:** `frontend/src/components/admin/GameStats.tsx:6`
**Issue:** The `useEffect` that fetches `/api/stats` has an empty dependency array (`[]`), meaning stats are fetched exactly once on mount and never refreshed. After a game finishes, the game count increments in the database (session.py:211-213), but the admin panel continues to display the stale count from page load. The admin would need to refresh the page to see the updated count.

**Fix:** Trigger a re-fetch when the game phase transitions. Add a dependency that changes when a game ends:
```typescript
// In GameControlTab.tsx, force remount by using phase as key:
<GameStats key={phase} />
```

Or add the `phase` from the store as a dependency:
```typescript
// In GameStats.tsx
const phase = useAdminStore((s) => s.phase)
useEffect(() => {
  fetch(...)
    .then(...)
    .catch(...)
}, [phase])  // re-fetch when phase changes
```

### WR-05: CSV preview parser is naive -- does not handle quoted fields or encoding

**File:** `frontend/src/components/admin/CsvImportTab.tsx:46-55`
**Issue:** The CSV preview function splits lines by `\n` and fields by `,` (line.split(',')). This does not handle:
1. Commas inside quoted fields (e.g., `"Question, part 2",42`)
2. Newlines inside quoted fields (multi-line questions)
3. The BOM character -- the backend handles this with `utf-8-sig` but the frontend uses plain `reader.readAsText(file)` without specifying encoding

The backend's `csv.reader` handles all of these correctly, so imports will succeed but the preview will display incorrect data. This misleads the admin into thinking their CSV has parsing errors or shows truncated content.

**Fix:** Either send the first N rows to the backend for preview, or use a proper CSV parser. A pragmatic approach: send the file to a new backend endpoint that returns parsed preview rows:
```typescript
// Send the full file to a preview endpoint
const formData = new FormData()
formData.append('file', selectedFile)
const res = await fetch(`${protocol}//${host}/api/questions/preview-csv`, {
  method: 'POST',
  body: formData,
})
```

### WR-06: `question_service.create` commits per-insert, enabling the partial-import anti-pattern in CSV import

**File:** `backend/services/question_service.py:26-31`
**Issue:** The `create` method calls `db.commit()` and `db.refresh()` after every single insert (lines 29-30). When called from the CSV import loop (line 90), each row is committed individually. If the import hits an error on row 50 (e.g., a database constraint failure), rows 1-49 are already committed. This is the classic partial-import bug (CR-02 in the previous review, which is already addressed by the CSV import refactoring recommendation). But the root cause is the `create` method's premature commit -- any future caller that uses `create` inside a larger transaction will have their transaction silently committed.

**Fix:** Separate the commit responsibility from the `create` method. The route handler should be the transaction boundary:
```python
@staticmethod
async def create(db: AsyncSession, text: str, answer: int, category: str = None):
    question = Question(text=text, answer=answer, category=category)
    db.add(question)
    await db.flush()
    return question
```

The route handler (questions.py:28-32) then calls `db.commit()` and `db.refresh()` itself. This makes the transaction boundary explicit and prevents the CSV import from committing per-row.

## Info

### IN-01: Empty catch block in GameStats silently swallows network errors

**File:** `frontend/src/components/admin/GameStats.tsx:14-15`
**Issue:** The `.catch()` handler is empty with only a comment (`// Network error ...`). Errors during stats fetch are silently swallowed with no console output, making debugging network issues harder during booth setup.

**Fix:** Add a minimal log:
```typescript
.catch((err) => {
  console.warn('[Stats] Failed to fetch game count:', err)
})
```

### IN-02: Magic number `9` (round count) hardcoded in three files

**Files:** `backend/main.py:208`, `backend/services/question_service.py:43,45`, `backend/game/session.py:45`
**Issue:** The number 9 (total rounds per game) is hardcoded as a literal in three separate files. Changing the round count requires updating three independent locations. This should be a named constant in a shared configuration module.

**Fix:**
```python
# backend/config.py
GAME_ROUND_COUNT = 9
```
Then reference it in all three files.

### IN-03: Admin WebSocket `connect` does not pass reconnect token

**File:** `frontend/src/hooks/useAdminWebSocket.ts:12-13`
**Issue:** The WebSocket URL is constructed without including any stored `token` as a query parameter. The server supports reconnection via `?token=<token>` (main.py:78-79), but the `connect` function never reads the token from the store. If the admin's WS disconnects and the component remounts, the new connection is treated as a fresh admin join rather than a reconnection. This means the admin reconnection path is dead code on the client side.

**Fix:**
```typescript
const connect = useCallback(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const token = useAdminStore.getState().token
  const wsUrl = token ? `${protocol}//${host}/ws?token=${encodeURIComponent(token)}` : `${protocol}//${host}/ws`
  // ... rest of logic
}, [])
```

### IN-04: Duplicate URL construction pattern in 5 frontend files

**Files:** `QuestionAddTab.tsx:27-29`, `QuestionListTab.tsx:33-35`, `CsvImportTab.tsx:74-76`, `GameStats.tsx:7-9`, `useAdminWebSocket.ts:9-11`
**Issue:** The same protocol-detection + host concatenation pattern is repeated verbatim in 5 separate files:
```typescript
const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
const host = window.location.host
```
This violates DRY. If the API base URL ever needs to change (e.g., adding a path prefix), all 5 locations must be updated. Extract this to a shared utility.

**Fix:**
```typescript
// frontend/src/lib/api.ts
export function apiBaseURL(): string {
  return `${window.location.protocol}//${window.location.host}`
}

export function wsBaseURL(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}
```

---

_Reviewed: 2026-06-10T21:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
