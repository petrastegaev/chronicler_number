---
phase: 03-player-frontend
plan: 01
subsystem: core-ui
tags: [websocket-client, zustand-store, screens, timer, answer-input, game-screen, animatepresence]
provides: [extended-game-store, use-websocket-hook, join-screen, waiting-screen, playing-screen, timer-ring, answer-input, game-header, game-screen]
requires: [02-02]
affects: [gameStore.ts, JoinPage.tsx, ws.ts]
tech-stack:
  added: []
  patterns:
    - WebSocket message handler using Zustand getState/setState outside React tree (Pattern 1)
    - SVG circle timer with Motion pathLength for counter-clockwise countdown (Pattern 2)
    - AnimatePresence mode="wait" for phase-based screen transitions (Pattern 3)
key-files:
  created:
    - frontend/src/hooks/useWebSocket.ts
    - frontend/src/components/JoinScreen.tsx
    - frontend/src/components/WaitingScreen.tsx
    - frontend/src/components/PlayingScreen.tsx
    - frontend/src/components/TimerRing.tsx
    - frontend/src/components/AnswerInput.tsx
    - frontend/src/components/GameHeader.tsx
    - frontend/src/components/GameScreen.tsx
  modified:
    - frontend/src/stores/gameStore.ts
    - frontend/src/pages/JoinPage.tsx
decisions:
  - "WebSocket connection initiated on GameScreen mount via useEffect calling connect() from useWebSocket hook"
  - "PlayingScreen, TimerRing, AnswerInput use Zustand selectors for re-render optimization (not full store subscription)"
  - "ResultOverlay and FinalScreen are inline stub components (return null) in GameScreen -- will be replaced in 03-02"
  - "Auto-submit guard uses !submittedAnswer && phase === 'playing' && ws triple condition per Pitfall 4 mitigation"
metrics:
  duration: ~10 min
  completed: 2026-06-10
  tasks: 3/3
  files_created: 8
  files_modified: 2
  commits: 3
---

# Phase 3 Plan 01: Player Frontend Core UI

Built the complete player frontend foundation: extended Zustand store with WebSocket reference and game state fields, created useWebSocket hook with connect/join/submitAnswer and full message event routing, and built three primary screens (Join, Waiting, Playing) with TimerRing, AnswerInput, GameHeader, and GameScreen root component. All 10 files compile clean with TypeScript.

## Deviations from Plan

None -- plan executed exactly as written.

## Key Decisions

- **WebSocket connection initiated on GameScreen mount:** The `useEffect` with `connect()` runs once on mount. This is simpler than the plan's mention of an IIFE approach -- `useEffect` is the idiomatic React pattern and works correctly with the hook's cleanup on unmount.

- **PlayingScreen created in Task 2 as stub, replaced in Task 3:** Since Task 2's GameScreen imports PlayingScreen, we created a minimal stub in Task 2 that was fully replaced in Task 3 when the real PlayingScreen was implemented. This kept TypeScript compilation clean throughout.

- **AnswerInput auto-submit with triple guard:** The effect watches `remaining` and only fires when `remaining === 0 && !submittedAnswer && phase === 'playing' && ws` per Pitfall 4 mitigation. The `ws` check added to prevent auto-submit before connection.

- **TimerRing color for player2:** Player 2's accent color (`#EF4444`) matches the plan's D-02 default. At `<=3s` danger state, it uses the same `#EF4444` -- this is intentional since danger red is the same as player2 accent.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `return null` | frontend/src/components/GameScreen.tsx:12 | ResultOverlay stub -- will be replaced in Plan 03-02 |
| `return null` | frontend/src/components/GameScreen.tsx:16 | FinalScreen stub -- will be replaced in Plan 03-02 |

## Files Created

| File | Description | Lines |
|------|-------------|-------|
| `frontend/src/hooks/useWebSocket.ts` | WebSocket lifecycle hook with connect/join/submitAnswer and routing of 9 event types to store | 119 |
| `frontend/src/components/JoinScreen.tsx` | Nickname input (max 15 chars) + "Присоединиться" button, idle/submitting states | 48 |
| `frontend/src/components/WaitingScreen.tsx` | "Ожидание соперника..." or "Ожидание запуска администратором" based on player2Nickname | 28 |
| `frontend/src/components/PlayingScreen.tsx` | Three-section layout: question (36px, ~40%), AnswerInput + TimerRing (~30%), footer (~30%) | 42 |
| `frontend/src/components/TimerRing.tsx` | 88px SVG circle, Motion pathLength animation, 3 color states, 64px timer digits, aria-live | 71 |
| `frontend/src/components/AnswerInput.tsx` | type=number input (0-1M), "Ответить" button, disabled+confirmation, auto-submit triple guard | 70 |
| `frontend/src/components/GameHeader.tsx` | Fixed top bar: nickname (left), title (center), score+round (right) during playing phases | 31 |
| `frontend/src/components/GameScreen.tsx` | AnimatePresence mode="wait" root with phase-based routing to 5 sub-components | 59 |

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/stores/gameStore.ts` | Added `ws`, `submittedAnswer`, `myAnswer`, `roundResult`, `gameEndResult` fields; `setSubmittedAnswer`, `setMyAnswer`, `resetRound` actions; exported `initialState` |
| `frontend/src/pages/JoinPage.tsx` | Replaced placeholder with `<GameScreen />` delegation |

## Threat Model Mitigations

| Threat ID | Category | Component | Status |
|-----------|----------|-----------|--------|
| T-03-01 | Spoofing | WebSocket message handler | Mitigated: Client only sends `join` and `submit_answer` events per protocol |
| T-03-02 | Tampering | AnswerInput auto-submit | Mitigated: Triple guard (`remaining === 0 && !submittedAnswer && phase === 'playing'`) prevents double-fire and stale expiry |
| T-03-03 | Information Disclosure | TimerRing render | Mitigated: Only displays `remaining` seconds already public via `timer_tick` broadcast |
| T-03-04 | Tampering | XSS via nickname | Mitigated: React JSX escaping handles injection; no `dangerouslySetInnerHTML` used |
| T-03-05 | Tampering | Answer input range bypass | Accepted: Server re-validates and treats invalid as no answer |
| T-03-SC | Tampering | npm install | Accepted: All packages already installed, no new installs |

## Verification

### Automated Checks

```bash
$ cd frontend && npx tsc --noEmit
TypeScript compilation: OK
```

### Acceptance Criteria Checklist

- [x] 10 files exist: gameStore.ts, useWebSocket.ts, GameScreen.tsx, JoinScreen.tsx, WaitingScreen.tsx, PlayingScreen.tsx, TimerRing.tsx, AnswerInput.tsx, GameHeader.tsx, JoinPage.tsx
- [x] gameStore.ts contains `ws: WebSocket | null`, `submittedAnswer: boolean`, `myAnswer: number | null`, `roundResult`, `gameEndResult`
- [x] gameStore.ts contains `setSubmittedAnswer`, `setMyAnswer`, `resetRound` actions
- [x] gameStore.ts exports `useGameStore` and `initialState`
- [x] useWebSocket.ts exports `function useWebSocket()` returning `{ connect, join, submitAnswer }`
- [x] useWebSocket.ts uses `useGameStore.getState()` and `.setState()` in onmessage handler
- [x] useWebSocket.ts handles 9 event types: joined, game_started, round_started, timer_tick, round_result, score_update, game_end, game_reset, state_snapshot
- [x] JoinScreen has input[maxLength=15], "Присоединиться" button, calls join()
- [x] WaitingScreen shows correct text per player count
- [x] GameHeader has nickname (left), title (center), score+round (right)
- [x] TimerRing has SVG circle (88px, radius 41, stroke 6), pathLength animation, 3 color states, 64px text, role="timer" aria-live
- [x] AnswerInput has type=number input (0-1M), 36px font, 56px height, "Ответить" button, auto-submit guard, "Ответ принят" confirmation, hint text
- [x] PlayingScreen has three-section layout with question text, AnswerInput, TimerRing
- [x] GameScreen uses AnimatePresence mode="wait" with phase-based routing
- [x] GameHeader appears during playing/showing_result/finished phases
- [x] `npx tsc --noEmit` compiles clean

## Commits

| Hash | Message |
|------|---------|
| `052353a` | feat(03-01): extend Zustand store and create WebSocket hook |
| `b722b81` | feat(03-01): build JoinScreen, WaitingScreen, GameHeader, GameScreen and update JoinPage |
| `d86ab72` | feat(03-01): build TimerRing, AnswerInput, and real PlayingScreen |

## Self-Check: PASSED

All 10 files exist. TypeScript compiles clean (`npx tsc --noEmit` passes). All git commits verified.
