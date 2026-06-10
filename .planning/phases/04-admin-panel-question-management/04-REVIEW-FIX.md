---
phase: 04-admin-panel-question-management
fixed_at: 2026-06-11T00:00:00Z
review_path: .planning/phases/04-admin-panel-question-management/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 04: Admin Panel and Question Management -- Code Review Fix Report

**Fixed at:** 2026-06-11T00:00:00Z
**Source review:** .planning/phases/04-admin-panel-question-management/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: CSV upload reads entire file into memory with no size limit (denial of service)

**Files modified:** `backend/routers/questions.py`, `backend/services/question_service.py`
**Commit:** 32eee6f
**Applied fix:**
- Added `MAX_UPLOAD_SIZE = 10 * 1024 * 1024` (10 MB) constant in `questions.py`
- Added size check after `file.read()` — raises `HTTPException(413)` if exceeded
- Added `MAX_ROWS = 5000` constant in `question_service.py`
- Added row count guard in `csv_import` loop — stops at 5000 rows with an error message

### CR-02: Player answer submission race — fairness window is ineffective due to event loop concurrency

**Files modified:** `backend/game/session.py`
**Commit:** c4f70ed
**Applied fix:**
- Added `import time` to session.py
- Added `self.answer_deadline` field initialized to 0.0
- In `_run_round`, set `self.answer_deadline = time.monotonic() + 10.0` when entering `accepting_answers` state
- In `submit_answer`, added deadline check: `if time.monotonic() > self.answer_deadline: return` — rejects answers that arrive past the fairness window even if the state machine hasn't transitioned yet

### WR-01: Reconnect tokens grow unboundedly with no cleanup mechanism

**Files modified:** `backend/game/tokens.py`, `backend/main.py`
**Commit:** 03c7916
**Applied fix:**
- Added `TOKEN_TTL = 3600` (1 hour) to tokens.py
- Store `created_at` timestamp in each token entry
- `restore_from_token` now checks TTL and evicts expired tokens
- In main.py, added `remove_token` import
- Store `_reconnect_token` on WebSocket objects at every generation/reconnect point (join, admin reconnect, player reconnect)
- On `WebSocketDisconnect`, read `_reconnect_token` from the websocket and call `remove_token`

### WR-02: Reconnecting player can displace existing player without closing old socket

**Files modified:** `backend/main.py`
**Commit:** fabbf71
**Applied fix:**
- In the reconnect path for players, added nickname-based slot matching
- When a reconnecting player matches an existing slot (by nickname), the old WebSocket is closed via `await old_ws.close()` before assigning the new one
- Falls through to empty-slot assignment if no nickname match or old slot is already empty

### WR-03: Admin WebSocket authentication is absent — anyone on the LAN can claim admin

**Files modified:** `backend/main.py`
**Commit:** ffa021c
**Applied fix:**
- Added `import os` and `ADMIN_KEY = os.environ.get("ADMIN_KEY", "booth-admin-2026")` constant
- In the admin join handler, extract `admin_key` from the `data.data` payload
- Reject with `"Unauthorized admin access"` error and close the WebSocket if the key doesn't match

### WR-04: GameStats component never refreshes after game completion

**Files modified:** `frontend/src/components/admin/GameStats.tsx`
**Commit:** e1ed9b1
**Applied fix:**
- Imported `useAdminStore` from the Zustand store
- Added `const phase = useAdminStore((s) => s.phase)` subscription
- Changed `useEffect` dependency array from `[]` to `[phase]` — stats re-fetch whenever the game phase transitions (e.g., from `playing` to `finished`)

### WR-05: CSV preview parser is naive — does not handle quoted fields or encoding

**Files modified:** `frontend/src/components/admin/CsvImportTab.tsx`
**Commit:** 956fd10
**Applied fix:**
- Added BOM (byte order mark) stripping: `if (text.charCodeAt(0) === 0xFEFF) { text = text.slice(1) }`
- Added `parseCsvLine()` function that handles:
  - Commas inside quoted fields (respects quote boundaries)
  - Escaped quotes (`""` inside quoted fields)
  - Correct field splitting
- Replaced `line.split(',')` with `parseCsvLine(line)`

### WR-06: question_service.create commits per-insert, enabling the partial-import anti-pattern in CSV import

**Files modified:** `backend/services/question_service.py`, `backend/routers/questions.py`
**Commit:** 183ccd4
**Applied fix:**
- Changed `QuestionService.create` to use `await db.flush()` instead of `await db.commit()`
- Moved `db.commit()` and `db.refresh(question)` to the `create_question` route handler
- Changed `QuestionService.delete` to remove `commit` entirely (no explicit flush needed for delete)
- Added `await db.commit()` to the `delete_question` route handler
- Added single `await db.commit()` at the end of `csv_import` (after the loop), so the entire CSV import is one atomic transaction instead of committing per-row

---

_Fixed: 2026-06-11T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
