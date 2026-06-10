---
phase: "04-admin-panel-question-management"
plan: "01"
subsystem: "admin-panel"
tags: ["admin", "zustand", "websocket", "stats", "fastapi"]
requires: ["01-foundation", "02-core-game-loop", "03-player-frontend"]
provides: ["admin-store", "admin-websocket-hook", "admin-page-shell", "stats-endpoint"]
affects: ["backend/main.py", "backend/schemas.py", "frontend/src/pages/AdminPage.tsx"]
tech-stack:
  added: ["zustand (already present)"]
  patterns: ["Admin-specific Zustand store per D-04", "Separate WebSocket hook per D-05"]
key-files:
  created:
    - "backend/routers/stats.py"
    - "frontend/src/stores/adminStore.ts"
    - "frontend/src/hooks/useAdminWebSocket.ts"
    - "frontend/src/components/admin/BottomTabBar.tsx"
    - "frontend/src/components/admin/GameControlTab.tsx"
    - "frontend/src/components/admin/PlayerSlot.tsx"
  modified:
    - "backend/schemas.py"
    - "backend/main.py"
    - "frontend/src/pages/AdminPage.tsx"
decisions: []
metrics:
  duration: "~15 min"
  completed_date: "2026-06-10"
  tasks: 3
  commits: 3
---

# Phase 04 Plan 01: Admin Panel Foundation Summary

**One-liner:** Admin panel foundation with Stats REST endpoint, admin Zustand store and WebSocket hook, and full admin page shell with bottom tab bar, player slots, and game control tab.

## Tasks Executed

### Task 1: Backend — stats endpoint and schema

- Added `StatsResponse(game_count: int)` model to `backend/schemas.py`
- Created `backend/routers/stats.py` with `GET /api/stats` returning game_count from the `stats` SQLite table
- Registered the stats router in `backend/main.py`
- **Commit:** `7c976b6`

### Task 2: Frontend — adminStore and useAdminWebSocket hook

- Created `frontend/src/stores/adminStore.ts` as a standalone Zustand store (per D-04) with:
  - AdminState: phase, player1/2 nickname/online/score, currentRound, totalRounds, ws, gameCount, questions, totalQuestions, csvResult, token
  - AdminActions: setter methods, setGameStarted, setScoreUpdate, resetForRestart, reset
- Created `frontend/src/hooks/useAdminWebSocket.ts` as a standalone hook (per D-05) returning `{ connect, startGame, restart }`:
  - Handles events: joined, game_started, round_started, timer_tick (ignored), score_update, game_end, game_reset, player_joined, error
  - Follows same wsRef/intentionalCloseRef pattern as useWebSocket.ts
- **Commit:** `ae8f828`

### Task 3: Frontend — AdminPage shell, BottomTabBar, GameControlTab, PlayerSlot

- Created `frontend/src/components/admin/BottomTabBar.tsx`:
  - Fixed bottom 64px nav, two tabs (Игра/Вопросы) with 44x44pt minimum touch targets
  - Active tab highlighted in player1 color
- Created `frontend/src/components/admin/PlayerSlot.tsx`:
  - Player color dot (player1/player2), nickname display with fallback placeholders
  - Online status indicator: green dot + "Готов" vs gray dot + "Нет подключения"
- Created `frontend/src/components/admin/GameControlTab.tsx`:
  - Header, two player slots, score row (during playing/finished), action buttons
  - **QUEST-07:** Warning card shown when phase==='lobby' and totalQuestions < 9: "Недостаточно вопросов в базе ({N} / 9). Игра не может начаться."
  - Запустить игру button disabled when nicknames empty or totalQuestions < 9
  - Рестарт button shown after game ends
  - Game count fetched from GET /api/stats on mount via useEffect
- Replaced `frontend/src/pages/AdminPage.tsx`:
  - Full-screen flex column, bottom tab bar, AnimatePresence with fade+slide transitions
  - Questions tab shows placeholder (to be replaced in Plan 04-02)
- **TypeScript compiles clean** with zero errors
- **Commit:** `960e373`

## Verification

- `npx tsc --noEmit` passes with zero errors (frontend/)
- `python -c "from schemas import StatsResponse; print(StatsResponse(game_count=5))"` imports clean (backend/)
- All files modified/created as specified in plan

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- Questions tab in AdminPage.tsx shows placeholder text "Управление вопросами (скоро)" — intentional, to be replaced in Plan 04-02
- GameControlTab's question pool warning shows totalQuestions from store, but no mechanism currently sets totalQuestions — it defaults to 0, so the warning will always display until Plan 04-02 populates it

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced outside the plan's threat model.

## Self-Check: PASSED

- [x] `backend/routers/stats.py` exists
- [x] `backend/schemas.py` contains `StatsResponse`
- [x] `backend/main.py` registers `stats_router`
- [x] `frontend/src/stores/adminStore.ts` exists, exports `useAdminStore`
- [x] `frontend/src/hooks/useAdminWebSocket.ts` exists, exports `useAdminWebSocket`
- [x] `frontend/src/components/admin/BottomTabBar.tsx` exists
- [x] `frontend/src/components/admin/PlayerSlot.tsx` exists
- [x] `frontend/src/components/admin/GameControlTab.tsx` exists
- [x] `frontend/src/pages/AdminPage.tsx` replaced with full admin shell
- [x] Commit 7c976b6 exists
- [x] Commit ae8f828 exists
- [x] Commit 960e373 exists
