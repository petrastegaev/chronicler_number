# Phase 05 Plan 01: Audio Engine Summary

**Subsystem:** Frontend audio system
**Tags:** sound, audio, howler, singleton, hooks
**Duration:** ~15 minutes
**Completed:** 2026-06-11

## Objective

Implement the complete audio system: SoundManager singleton, useSoundEffects hook, generate/deliver MP3 files, wire into GameScreen. Transform the game into a game-show experience by playing 4 distinct sounds per game phase transitions.

## Accomplishments

- Generated 4 MP3 sound files (tick, tick_fast, end_round, winner) using Python pydub/numpy and ffmpeg with libmp3lame encoding
- Created `frontend/src/audio/SoundManager.ts` singleton: preloads Howl instances, exposes play()/stop()/stopAll() API
- Created `frontend/src/audio/useSoundEffects.ts` React hook: subscribes to gameStore state transitions via Zustand vanilla subscribe API
- Wired `useSoundEffects()` into `GameScreen.tsx` after the existing `useWebSocket()` call
- Installed `@types/howler` for TypeScript type safety
- Full frontend build passes with zero TypeScript errors

## Sound File Specifications

| File | Duration | Size | Description | Generation Method |
|------|----------|------|-------------|-------------------|
| `tick.mp3` | 120ms | 4.4 KB | Short click (800Hz sine + pink noise, fade envelope) | pydub + ffmpeg |
| `tick_fast.mp3` | 80ms | 3.8 KB | Higher-pitch tick (1200Hz, sharper attack) | pydub + ffmpeg |
| `end_round.mp3` | 1.5s | 37.7 KB | Bell-like gong (C major chord C4-E4-G4, long fade-out) | pydub + ffmpeg |
| `winner.mp3` | ~3s | 78.4 KB | Triumphant fanfare (C-E-G-C arpeggio, final power chord) | pydub + ffmpeg |

## Sound Trigger Map

| Store Transition | Sound | Condition |
|-----------------|-------|-----------|
| `state.remaining` decrements from >3 | `tick` | `state.remaining < prevState.remaining && state.remaining > 3` |
| `state.remaining` decrements to <=3 | `tick_fast` | `state.remaining < prevState.remaining && state.remaining <= 3` |
| `state.roundResult` null -> non-null | `end_round` | `state.roundResult !== null && prevState.roundResult === null` |
| `state.gameEndResult` null -> non-null | `winner` | `state.gameEndResult !== null && prevState.gameEndResult === null` |
| `state.phase` -> `idle` or `waiting` | `stopAll()` | Phase transition to idle/waiting |

## Deviations from Plan

### Technical Corrections (auto-fix, Rule 2)

**1. [Rule 2 - Missing type definitions] Installed @types/howler**
- **Found during:** Task 2/3 verification
- **Issue:** `tsc` reported `error TS7016: Could not find a declaration file for module 'howler'`. The Howl constructor and its type definitions were unavailable for TypeScript compilation.
- **Fix:** Installed `@types/howler` as a dev dependency
- **Commit:** acfea0c

**2. [Rule 2 - API incompatibility] Adapted Zustand subscribe calls to vanilla API**
- **Found during:** Task 3 verification
- **Issue:** Plan specified `useGameStore.subscribe(selector, callback)` which is the `subscribeWithSelector` middleware API, not the vanilla Zustand v5 `subscribe` API. The vanilla API takes a single listener `(state, prevState) => void`.
- **Fix:** Restructured all 4 subscription blocks to use the vanilla `subscribe((state, prevState) => { ... })` pattern with inline state comparison
- **Commit:** acfea0c

**3. [Rule 2 - Type mismatch] Fixed onloaderror callback signature**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `HowlErrorCallback` types have second parameter as `unknown`, not `number`
- **Fix:** Changed `onloaderror: (_id, errCode) => number` to `onloaderror: (_id, error: unknown)`
- **Commit:** acfea0c

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Generated sounds programmatically | No ffmpeg binary on dev machine initially; downloaded static ffmpeg build for MP3 encoding. |
| Zustand vanilla subscribe API | The project does not use `subscribeWithSelector` middleware. Testing revealed the vanilla API uses `(state, prevState)` signature. Adapting to the actual API instead of adding middleware. |
| @types/howler | TypeScript requires declaration files. The type definitions match the installed howler@2.2.4 API correctly. |

## Build Verification

```
npx tsc --noEmit  # PASSED (zero errors)
npx vite build    # PASSED (473 modules, ~491KB JS, ~15KB CSS)
```

## Threat Surface Scan

No new threat surface introduced. Audio files are static assets served via existing StaticFiles mount. WebSocket events trigger playback client-side only. Howler.js onloaderror callback logs warnings (does not throw). AudioContext unlock handled by Howler.js autoUnlock on first user gesture.

## Files Created

| File | Size | Description |
|------|------|-------------|
| `frontend/src/audio/SoundManager.ts` | 56 lines | Singleton Howler.js preloader + play() API |
| `frontend/src/audio/useSoundEffects.ts` | 75 lines | React hook subscribing to gameStore transitions |
| `frontend/public/sounds/tick.mp3` | 4.4 KB | Short click sound |
| `frontend/public/sounds/tick_fast.mp3` | 3.8 KB | Higher-pitch click |
| `frontend/public/sounds/end_round.mp3` | 37.7 KB | Gong/bell for round end |
| `frontend/public/sounds/winner.mp3` | 78.4 KB | Fanfare for game end |
| `frontend/public/sounds/ATTRIBUTION.md` | ~600 B | License and generation documentation |

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/components/GameScreen.tsx` | Added import + hook call (2 lines added) |
| `frontend/package.json` | Added `@types/howler` dev dependency |

## Commits

| Hash | Message |
|------|---------|
| `91706c5` | feat(05-01): add 4 MP3 sound files and ATTRIBUTION.md |
| `1670328` | feat(05-01): create SoundManager singleton for audio playback |
| `acfea0c` | feat(05-01): create useSoundEffects hook and wire into GameScreen |

## Self-Check: PASSED

- [x] All 4 MP3 files exist in frontend/public/sounds/ -- valid playable audio (verified by `file` command)
- [x] ATTRIBUTION.md documents generation method
- [x] SoundManager.ts exports class and singleton with preload/play/stop/stopAll
- [x] useSoundEffects.ts subscribes to remaining, roundResult, gameEndResult, phase
- [x] GameScreen.tsx imports and calls useSoundEffects() after useWebSocket()
- [x] TypeScript compilation passes with zero errors
- [x] Vite build succeeds
- [x] All files committed individually with proper commit format
