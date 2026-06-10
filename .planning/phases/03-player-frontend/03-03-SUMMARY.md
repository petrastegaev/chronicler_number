---
phase: 03-player-frontend
plan: 03
type: execute
wave: 3
gap_closure: true
tags:
  - gap-closure
  - player-join-broadcast
  - waiting-screen
requires:
  - 03-01
  - 03-02
provides:
  - JOIN-04
affects:
  - backend/main.py
  - frontend/src/stores/gameStore.ts
  - frontend/src/hooks/useWebSocket.ts
tech-stack:
  added: []
  patterns:
    - Server join handler broadcasts player_joined event to existing player when second player connects
    - Joined response includes both player1_nickname and player2_nickname for immediate opponent awareness
key-files:
  modified:
    - backend/main.py
    - frontend/src/stores/gameStore.ts
    - frontend/src/hooks/useWebSocket.ts
decisions:
  - "Minimal change: no new protocol events, just added fields to existing joined response + server-side player_joined broadcast"
metrics:
  duration: ~10 min
  completed: 2026-06-10
  tasks: 2/2
  files_modified: 3
  commits: 1
---

# Phase 3 Plan 3: Gap Closure — Player Join Broadcast

**One-liner:** Fixed the WaitingScreen "Ожидание запуска администратором" never shown by having the server share opponent nickname on player join.

## What was fixed

**Root cause from UAT Test 3:** The server sent `joined` only to the connecting player with no info about the other connected player. `player2Nickname` in the frontend store was ONLY populated via `game_started` event — never during the waiting phase.

## Changes Made

### Server (`backend/main.py`)
1. **`joined` response now includes `player1_nickname` and `player2_nickname`** — the connecting player immediately knows if the opponent is already connected
2. **When player 2 joins, server broadcasts `player_joined` to player 1** — player 1 gets notified and updates their WaitingScreen

### Frontend
1. **`gameStore.ts`** — added `setOpponentNickname(name)` action that sets `player2Nickname`
2. **`useWebSocket.ts`** — `joined` handler extracts opponent nickname from response; added `player_joined` event handler

## Verification

- TypeScript compiles clean (`npx tsc --noEmit`)
- Playwright confirmed: both players see "Ожидание запуска администратором" after both join
- UAT Test 3 status: issue → resolved

## Commits

[Will be committed after summary creation]
