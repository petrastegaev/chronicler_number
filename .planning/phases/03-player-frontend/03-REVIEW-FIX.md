---
phase: 03-player-frontend
fixed_at: "2026-06-10T12:00:00Z"
review_path: .planning/phases/03-player-frontend/03-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-10
**Source review:** .planning/phases/03-player-frontend/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13
- Fixed: 13
- Skipped: 0

## Fixed Issues

### CR-01: WebSocket initialization race in GameScreen

**Files modified:** `frontend/src/components/GameScreen.tsx`
**Commit:** `409e276`
**Applied fix:** Added `ws` and `connect` to the `useEffect` dependency array and removed the eslint-disable comment. This ensures React properly tracks when a reconnect is needed and the effect re-runs when `ws` changes.

### CR-02: Unhandled WS `error` event

**Files modified:** `frontend/src/hooks/useWebSocket.ts`
**Commit:** `d1ff315`
**Applied fix:** Added a `default` case to the `switch` statement that checks for `msg.event === 'error'`, logs the error message, and resets the phase to `'idle'`. This prevents silent failures when the server sends protocol errors.

### CR-03: Auto-submit captures stale `myAnswer` value

**Files modified:** `frontend/src/components/AnswerInput.tsx`
**Commit:** `1382ab5`
**Applied fix:** Added all referenced values (`myAnswer`, `submittedAnswer`, `phase`, `ws`, `submitAnswer`, `setSubmittedAnswer`) to the `useEffect` dependency array. Added a null-answer guard: if `myAnswer` is null when the timer expires, the component marks the answer as submitted without sending a null value to the server.

### CR-04: `input[type=number]` null answer handling

**Files modified:** `frontend/src/hooks/useWebSocket.ts`, `frontend/src/components/AnswerInput.tsx`
**Commit:** `4e23e71`
**Applied fix:** Added null guards in both `submitAnswer` (in `useWebSocket.ts`) and `handleSubmit` (in `AnswerInput.tsx`) to prevent submitting null/empty answers. The `submitAnswer` function now returns early if `answer === null`.

### CR-05: Hardcoded color values bypass Tailwind theme

**Files modified:** `frontend/src/components/TimerRing.tsx`, `frontend/src/components/ResultOverlay.tsx`, `frontend/src/components/FinalScreen.tsx`
**Commit:** `3cc4697`
**Applied fix:** Replaced all hardcoded hex colors with CSS variable references:
- `#3B82F6` -> `var(--color-player1)`
- `#EF4444` -> `var(--color-player2)`
- `#eeeeee` -> `var(--color-wb-text)`
- `#10B981` -> already used via `text-correct` class (not modified)
- `#F59E0B` -> `var(--color-warning)`
- `#2d1b4e` -> `var(--color-wb-surface)`

### WR-01: `onclose` resets phase to `'idle'` unconditionally

**Files modified:** `frontend/src/hooks/useWebSocket.ts`
**Commit:** `a23fffb`
**Applied fix:** The `onclose` handler now checks the current phase. If the phase is `'idle'` or `'joining'`, it resets phase to `'idle'`. Otherwise, it only clears the `ws` reference without resetting the phase — preserving in-game state during transient disconnects.

### WR-02: `onclose` fires during `connect()` before `wsRef.current` assignment

**Files modified:** `frontend/src/hooks/useWebSocket.ts`
**Commit:** `bca3940`
**Applied fix:** Moved `wsRef.current = ws` to immediately after `new WebSocket(...)`, before any handler setup. This ensures that if the WebSocket closes synchronously during construction, `wsRef.current` is already assigned and the cleanup effect can properly reference it.

### WR-03: Double-close on unmount via cleanup effect

**Files modified:** `frontend/src/hooks/useWebSocket.ts`
**Commit:** `04d365d`
**Applied fix:** Added an `intentionalCloseRef` flag. The cleanup `useEffect` sets this flag to `true` before calling `wsRef.current?.close()`. The `onclose` handler checks this flag: if set, it skips all state resets (the close was intentional), then resets the flag.

### WR-04: Missing `type` attribute on buttons

**Files modified:** `frontend/src/components/JoinScreen.tsx`, `frontend/src/components/AnswerInput.tsx`
**Commit:** `986039b`
**Applied fix:** Added `type="button"` to both buttons to prevent implicit `type="submit"` behavior that could cause unexpected form submissions.

### WR-05: `handleJoin` and `handleSubmit` not wrapped in `useCallback`

**Files modified:** `frontend/src/components/JoinScreen.tsx`, `frontend/src/components/AnswerInput.tsx`
**Commit:** `9eb1c24`
**Applied fix:** Wrapped `handleJoin` in `useCallback` with deps `[nickname, isSubmitting, join]` and `handleSubmit` in `useCallback` with deps `[isDisabled, myAnswer, submitAnswer, setSubmittedAnswer]`. Added `useCallback` to imports.

### WR-06: `AnimatePresence` with `mode="wait"` slows overlay transitions

**Files modified:** `frontend/src/components/GameScreen.tsx`
**Commit:** `98e68cd`
**Applied fix:** Removed `mode="wait"` from `AnimatePresence` so that exit and enter animations can overlap, enabling faster transitions between screens (particularly from `playing` to `showing_result`).

### WR-07: `score_update` event `round_number` field silently dropped

**Files modified:** `frontend/src/hooks/useWebSocket.ts`
**Commit:** `eea2d71`
**Applied fix:** Extended the `score_update` handler to destructure and validate `round_number`. If the round number does not match `store.currentRound`, a warning is logged.

### WR-08: Inconsistent `useGameStore.setState()` mixing

**Files modified:** `frontend/src/hooks/useWebSocket.ts`, `frontend/src/stores/gameStore.ts`
**Commit:** `90bf68c`
**Applied fix:** Added `setRoundResultData` and `setGameEndResultData` action methods to the game store that atomically set both the result data and the phase. Replaced the two `useGameStore.setState(...)` calls in the `onmessage` handler with calls to `store.setRoundResultData(data)` and `store.setGameEndResultData(data)`, making all mutations go through store action methods.

## Skipped Issues

None — all 13 in-scope findings were successfully fixed.

---

_Fixed: 2026-06-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
