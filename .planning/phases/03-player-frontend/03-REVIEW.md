---
phase: 03-player-frontend
review_date: "2026-06-10"
depth: standard
files_reviewed: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-10
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 3 (Player Frontend) implementation for the Number Duel game. The code covers a Zustand game store, WebSocket lifecycle hook, and 11 React components for the player-facing experience. Overall architecture is reasonable, but several high-severity issues were found: a WebSocket initialization race condition, missing error event handling, a stale closure in the auto-submit effect, a reconnection memory leak, incorrect `input[type=number]` value handling, an `onclose` state mutation that can fire during connect, and missing ARIA attributes on interactive elements. Additionally, hardcoded color values bypass the Tailwind theme, making them unreachable by the styling system and risking visual inconsistency.

## Critical Issues

### CR-01: WebSocket initialization race in GameScreen — `connect()` called despite no `ws` dependency tracking

**File:** `frontend/src/components/GameScreen.tsx:20-24`
**Issue:** The `useEffect` that calls `connect()` has an empty dependency array but references `ws` from the store. This violates React's rules of hooks: the linter suppression (`eslint-disable-line react-hooks/exhaustive-deps`) masks a real problem. The effect runs once on mount. If `ws` is already set at mount time (e.g., from a previous React StrictMode double-mount, or if a parent re-renders this component into the tree after `connect` was already called higher up), the effect will still call `connect()` again, creating a redundant WebSocket connection while the old one leaks.

**Fix:** Add `ws` to the dependency array with the reconnection guard in the effect body. Alternatively, implement the reconnection logic in `ConnectionStatus` or the `onclose` handler with exponential backoff. At minimum, remove the eslint disable and add `ws` to deps.

### CR-02: Unhandled WS `error` event — silent failure on all protocol errors

**File:** `frontend/src/hooks/useWebSocket.ts:17-97`
**Issue:** The `onmessage` handler processes 9 event types but has **no `default` case** in the `switch` statement. The server protocol defines an `error` event type (`ErrorEvent`) for reporting protocol violations. If the server sends `{"event": "error", "data": {"message": "Invalid nickname"}}`, this event is silently ignored. The player sees no feedback — the join appears to have succeeded (the client already called `setPhase('joining')`), but nothing happens. The player will stare at "Отправка..." forever.

**Fix:** Add a `default` case that checks for `error` events and surfaces the error to the UI.

### CR-03: Auto-submit captures stale `myAnswer` value due to closure over single effect dependency

**File:** `frontend/src/components/AnswerInput.tsx:24-29`
**Issue:** The auto-submit `useEffect` depends only on `[remaining]` (with the linter suppression). When the timer hits 0, it calls `submitAnswer(myAnswer)` and `setSubmittedAnswer(true)`. The actual bug: if the user types an answer (myAnswer = 42) and then deletes it (myAnswer = null), then the timer fires auto-submit with `null` as the answer. A null numeric answer is semantically different from "no answer" on the server side.

**Fix:** Add all referenced values to the dependency array and handle null answer case.

### CR-04: `input[type=number]` renders `null` as empty string, but on re-render loses controlled value as empty string

**File:** `frontend/src/components/AnswerInput.tsx:34-49`
**Issue:** The type definition `SubmitAnswer` defines `data.answer` as `number` (not `number | null`). If the user submits with an empty input (myAnswer=null), the auto-submit path passes `null` as the answer, which violates the contract.

**Fix:** Ensure the submit path handles null — don't submit empty answers.

### CR-05: Hardcoded color values bypass Tailwind theme — will not respond to theme changes

**Files:** `TimerRing.tsx`, `ResultOverlay.tsx`, `FinalScreen.tsx`
**Issue:** Multiple components use hardcoded hex color strings instead of using Tailwind CSS classes that reference theme tokens or CSS variable references (`var(--color-*)`). This defeats the purpose of having a design token system.

**Fix:** Replace hardcoded colors with CSS variable references (e.g., `var(--color-player1)` instead of `'#3B82F6'`).

## Warnings

### WR-01: `onclose` resets phase to `'idle'` — can erase game state on transient disconnect
**File:** `frontend/src/hooks/useWebSocket.ts:99-101`

### WR-02: `onclose` fires during `connect()` before `wsRef.current` assignment — stale state on close of failed connection
**File:** `frontend/src/hooks/useWebSocket.ts:8-104`

### WR-03: `onclose` handler closes `wsRef.current` in cleanup effect — double-close on unmount
**File:** `frontend/src/hooks/useWebSocket.ts:127-131`

### WR-04: Missing `type` attribute on buttons — implicit `type="submit"`
**Files:** `JoinScreen.tsx:43`, `AnswerInput.tsx:54`

### WR-05: `handleJoin` and `handleSubmit` not wrapped in `useCallback`
**Files:** `JoinScreen.tsx:13-17`, `AnswerInput.tsx:17-21`

### WR-06: `ResultOverlay` uses `AnimatePresence` parent exit animation but sibling `PlayingScreen` has its own exit animation
**File:** `ResultOverlay.tsx:37-40`

### WR-07: `score_update` event has `round_number` field that is silently dropped
**File:** `frontend/src/hooks/useWebSocket.ts:55-58`

### WR-08: `onmessage` reads `useGameStore.getState()` once and then dispatches — inconsistency with `useGameStore.setState()`
**File:** `frontend/src/hooks/useWebSocket.ts:19,52,74`

## Info

### IN-01: Hardcoded `'9'` for total rounds in `state_snapshot` handler
**File:** `frontend/src/hooks/useWebSocket.ts:91`

### IN-02: `ConnectionStatus` checks `phase !== 'idle' && phase !== 'joining'` — incorrect for post-join disconnect
**File:** `frontend/src/components/ConnectionStatus.tsx:8`

### IN-03: Missing `role` and `aria-label` on icon-only elements
**Files:** `GameHeader.tsx`, `JoinScreen.tsx`

### IN-04: `useWebSocket` hook called in both `GameScreen` and `AnswerInput` — duplicate hook instances
**Files:** `GameScreen.tsx:16`, `AnswerInput.tsx:13`

### IN-05: Missing `transform-origin: center` CSS property for TimerRing rotation could be reset by Tailwind
**File:** `frontend/src/components/TimerRing.tsx:46-47`

### IN-06: `font-regular` is not a standard Tailwind utility — no error but potentially no-op
**File:** `frontend/src/components/GameHeader.tsx:21,23,24`

### IN-07: `ResultOverlay` does not close or dismiss — player is stuck until server sends next `round_started`
**File:** `frontend/src/components/ResultOverlay.tsx`

## Summary of Findings

| Severity | Count |
|----------|-------|
| Critical | 5 |
| Warning  | 8 |
| Info     | 7 |
| **Total** | **20** |

The most critical issues are: (1) the WebSocket initialization race with `connect()` not properly guarding against stale closures, (2) missing `error` event handling causing silent failures on protocol violations, (3) auto-submit stale closures and null-answer submission violating the protocol contract, (4) `input[type=number]` handling of `null` vs empty string creating ambiguous state, and (5) pervasive hardcoded color values that bypass the Tailwind theme system.

The `onclose` handler resetting phase to `'idle'` (WR-01) is the most dangerous latent bug — it will erase in-progress game state on any transient network hiccup, with no reconnection mechanism to recover it.
