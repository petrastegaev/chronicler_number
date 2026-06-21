---
phase: quick-260621-g2x
plan: 01
subsystem: backend-websocket, static-assets, validation
tags: [bugfix, websocket, reconnect, docker, fonts, favicon, pydantic]
requires: []
provides:
  - "WebSocket reconnect tokens that survive disconnect (no premature remove_token)"
  - "Unknown-role / non-join first message closes the socket with a Russian error"
  - "Game-end nickname snapshots immune to mid-game disconnect blanking"
  - "Dockerfile chmod making the copied static tree readable to non-root appuser"
  - "Local offline favicon.svg + index.html rel=icon link"
  - "QuestionCreate validator rejecting whitespace-only text (422) and trimming"
affects: [backend/main.py, backend/game/session.py, Dockerfile, frontend/index.html, frontend/public/favicon.svg, backend/schemas.py]
tech-stack:
  added: []
  patterns:
    - "pydantic v2 @field_validator classmethod for cross-field-style text normalization"
    - "snapshot mutable manager state at task start to avoid disconnect races"
    - "chmod -R a+rX on static asset tree in Docker build before USER drop"
key-files:
  created:
    - frontend/public/favicon.svg
  modified:
    - backend/main.py
    - backend/game/session.py
    - Dockerfile
    - frontend/index.html
    - backend/schemas.py
decisions:
  - "Dropped remove_token import + call entirely rather than gating it; periodic cleanup_expired_tokens + 1h TTL already reap tokens, so no leak"
  - "Favicon is a hand-authored static SVG (dark theme + two facing duel numerals) — no CDN, fully offline per booth constraint"
  - "Pre-existing E402/F811 ruff warnings in main.py SPA-fallback section left untouched (out of scope, identical on base commit)"
metrics:
  duration: ~12 min
  completed: 2026-06-21
  tasks: 3
  files: 6
---

# Phase quick-260621-g2x: Fix Bugs From Manual Testing Swarm Summary

Surgical fixes for 7 real bugs found by the manual testing swarm (TEST-REPORT-2026-06-21.md): WebSocket reconnect/heartbeat survival, unknown-role socket hang, mid-game nickname-persistence race, Docker font-permission `ERR_CONTENT_LENGTH_MISMATCH`, missing offline favicon, and whitespace-only question acceptance. Three atomic commits, no surrounding refactor. The two non-bugs (BUG-PAGINATION, BUG-PLAYER-JOINED-FIELD) were left untouched.

## What Was Built

### Task 1 — Backend WebSocket + session fixes (`bb72b7f`)
- **Fix A (BUG-RECONN + BUG-ADMIN-HEARTBEAT, P0):** Removed the `remove_token(token)` call (and its `getattr`/`if token:` lines + stale comment) from the `except WebSocketDisconnect:` block in `backend/main.py`, and dropped the now-unused `remove_token` from the `game.tokens` import. Reconnect tokens now live to their 1h TTL and are reaped by the existing periodic `cleanup_expired_tokens` task — so a player refresh or the admin's 30s heartbeat reconnect no longer gets `Недействительный токен сессии`. The lobby-slot clearing and admin game-cancel logic in that block were kept intact.
- **Fix B (BUG-UNKNOWN-ROLE, P1):** Added an `else` for unknown roles (after the `elif role == "player":` block) that sends `{"event":"error","data":{"message":"Неизвестная роль"}}`, closes the socket, and returns; and an `else` on the outer `if data.get("event") == "join":` that sends `Ожидалось событие join` and closes. Sockets no longer hang open on bad first messages.
- **Fix C (BUG-NICKNAME-NULL, P3):** In `backend/game/session.py`, snapshot `self.player1_nickname` / `self.player2_nickname` at the top of `run()`, and use those snapshots in the `game_started` broadcast, `_finish_game` (winner + `game_end_data`), and `_persist_game`. A mid-game disconnect that nulls `manager.playerN_nickname` can no longer blank the persisted/broadcast names. Redundant `or ""` dropped at those sites (snapshots are already non-None strings). Happy-path behavior unchanged.

### Task 2 — Static asset fixes (`c28db8b`)
- **Fix D (BUG-FONT-MISMATCH, P1):** Added `RUN chmod -R a+rX ./static` to the `Dockerfile` (after `COPY --from=frontend-build /app/dist ./static`, before `USER appuser`). COPY can land the `.otf` fonts as root-only mode 0600; `StaticFiles` then sends a `Content-Length` header but 0 body bytes to the non-root `appuser`, which the browser aborts as `ERR_CONTENT_LENGTH_MISMATCH`. `a+rX` grants read to all + traverse on directories only. Also `chmod 644` on the source `.otf` files for defense in depth.
- **Fix E (BUG-FAVICON, P3):** Created `frontend/public/favicon.svg` — a self-contained 64×64 SVG using the project palette (`#161616` bg, player1 `#7f30e3`, player2 `#ff00fe`) showing two facing duel numerals; no external refs, fully offline. Linked it from `frontend/index.html` via `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`. Vite copies `public/` verbatim, so it serves at `/favicon.svg` instead of falling through the SPA catch-all to `index.html`.

### Task 3 — Validation fix (`b89fbac`)
- **Fix F (BUG-WHITESPACE-TEXT, P3):** Added a `@field_validator("text")` classmethod to `QuestionCreate` in `backend/schemas.py` (extending the import with `field_validator`) that strips the value, raises `ValueError("Текст вопроса не может быть пустым")` (→ 422) when empty after stripping, and returns the trimmed text. A question of only spaces can no longer be stored as 201; accepted text is trimmed before persistence. `min_length=1, max_length=500` kept on the `Field`.

## Source-Level Verification Results

All SOURCE-LEVEL `<verify>` steps from the plan were run (no container — LIVE steps are the orchestrator's job post-merge):

**Task 1**
- `grep remove_token backend/main.py` → no matches (import + call gone). ✓
- `grep self.player(1|2)_nickname backend/game/session.py` → 10 matches (snapshots + all game-end uses). ✓
- `grep "Неизвестная роль"` → 1 match; `grep "Ожидалось событие join"` → 1 match. ✓
- `python -c "ast.parse(...)"` on main.py + session.py → exit 0. ✓
- `ruff check main.py game/session.py` → **no F401 for remove_token**. ✓

**Task 2**
- `frontend/public/fonts/*.otf` are mode `-rw-r--r--` (644). ✓ (`backend/static/fonts/*.otf` are gitignored Vite build artifacts, absent in the worktree — the Dockerfile chmod is the load-bearing runtime fix for them.)
- `grep "chmod -R a+rX ./static" Dockerfile` → line 29, after `COPY ... ./static` (line 17), before `USER appuser` (line 31). ✓
- `favicon.svg` exists, starts with `<svg`, and is well-formed XML. ✓
- `grep 'rel="icon"' frontend/index.html` → line 7 referencing `/favicon.svg`. ✓

**Task 3**
- `grep field_validator backend/schemas.py` → import (line 3) + on QuestionCreate (line 34). ✓
- Plan inline pydantic assertion → `OK: rejects whitespace + strips valid`, exit 0 (`"   "` rejected, `"  привет  "` → `"привет"`). ✓
- `ruff check schemas.py` → All checks passed. ✓

**Overall**
- `python -c "ast.parse(...)"` on main.py, schemas.py, session.py → exit 0. ✓
- `ruff check .` → 4 errors, all **pre-existing** E402 (×3) + F811 (×1) in the main.py SPA-fallback `import` section (lines 408-410); confirmed identical on the base commit `07b310e`. **No F401, no remove_token lint.** Left untouched per scope boundary. ✓

## LIVE Verification (NOT run — requires `docker compose up --build`)

Per task instructions, the running container on port 8081 was not disturbed and no Docker/server commands were run. The following remain for the orchestrator after merge-back + rebuild:
- WS reconnect-by-token returns `joined` (not `Недействительный токен сессии`); admin survives the 30s heartbeat cycle.
- Unknown role on `/ws` → Russian error + closed socket.
- `curl /fonts/CoFoSansRegular.otf` → 200 with full ~166848-byte body (no `ERR_CONTENT_LENGTH_MISMATCH`).
- `curl /favicon.svg` → `image/svg+xml 200` (not text/html).
- `POST /api/questions/` (trailing slash) with whitespace-only text → 422; with padded valid text → 201 and trimmed storage.

## Deviations from Plan

None — plan executed exactly as written. The `backend/static/fonts/*.otf` chmods in Fix D(b) produced no git diff because that path is gitignored (`.gitignore:8` `backend/static/`) and the files are Vite build artifacts absent from the worktree; this was anticipated by the plan and task constraints, and the load-bearing Dockerfile `chmod -R a+rX ./static` covers them at build time. The `frontend/public/fonts/*.otf` files were already mode 644 (git tracks only the exec bit). The optional `frontend/src/assets/fonts/__MACOSX/` cleanup was a no-op (directory not present).

## Excluded (Confirmed NOT Bugs — Left Untouched)
- **BUG-PAGINATION:** `backend/routers/questions.py` still uses the `skip` parameter (lines 17, 22) — file not modified.
- **BUG-PLAYER-JOINED-FIELD:** `backend/main.py:311` still sends `{"player2_nickname": nickname}` to player1 — not changed.

## Known Stubs
None. No placeholder/empty-data patterns introduced.

## Commits
- `bb72b7f` — fix(260621-g2x): backend WS reconnect, unknown-role close, nickname snapshots
- `c28db8b` — fix(260621-g2x): font permissions in image + local offline favicon
- `b89fbac` — fix(260621-g2x): reject whitespace-only question text

## Self-Check: PASSED
All modified/created files present (backend/main.py, backend/game/session.py, Dockerfile, frontend/index.html, frontend/public/favicon.svg, backend/schemas.py, SUMMARY.md) and all three commits (`bb72b7f`, `c28db8b`, `b89fbac`) verified in git history.
