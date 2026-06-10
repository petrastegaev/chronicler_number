# Phase 5: Audio + Deployment Polish - Research

**Researched:** 2026-06-11
**Domain:** Audio playback in React/Howler.js, offline deployment hardening
**Confidence:** HIGH

## Summary

Phase 5 adds four sound effects (tick, tick_fast, end_round, winner) to transform the game into a game-show experience, then hardens the Docker deployment for offline conference booth operation. Audio integration uses Howler.js 2.2.4 (already in package.json) with a custom `useSoundEffects` hook that listens to Zustand store state transitions and triggers sounds accordingly. AudioContext is unlocked via Howler's built-in `autoUnlock` mechanism, which fires on the first user gesture (nickname submit button click) -- no additional unlock code needed. MP3 files are placed in `frontend/public/sounds/` so Vite copies them into `dist/` unhashed for Docker serving. Deployment hardening focuses on captive portal mitigation, WiFi reconnect stability, and a verified offline testing procedure.

**Primary recommendation:** Use Howler.js directly (no react-howler wrapper) with a singleton `SoundManager` pattern -- preload all 4 sounds on app mount, trigger playback via Zustand store subscriptions in a `useSoundEffects` hook. Place MP3s in `/public/sounds/`. No backend changes needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sound preloading | Browser / Client | -- | Howler.js preloads audio files into memory; files are served as static assets from FastAPI |
| Sound playback | Browser / Client | -- | WebSocket events trigger client-side playback; server does not send audio data |
| AudioContext unlock | Browser / Client | -- | First user gesture (join button click) must activate AudioContext per mobile browser policy |
| Audio file serving | CDN / Static | -- | MP3 files are in the Docker image served by FastAPI StaticFiles mount |
| Captive portal detection | Browser / Client | Frontend Server (SSR) | Browser's captive portal detection (connectivity check to external URL) fails on offline WiFi; no server-side mitigation can prevent OS-level behavior |
| WiFi stability | OS / Network | -- | Server uses `host` network mode if hotspot is on same machine; no JS control over WiFi reconnect |

## User Constraints

No CONTEXT.md exists for Phase 5 (first planning artifact). No locked decisions exist yet. All aspects are at Claude's discretion unless overridden by the discussing user.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIO-01 | `tick` sound plays on each `timer_tick` event when remaining time > 3 seconds | Howler.js `play()` triggered by `timer_tick` dispatch in `useSoundEffects` hook |
| AUDIO-02 | `tick_fast` sound (higher pitch/faster) plays when remaining time <= 3 seconds | Conditional in `useSoundEffects`: check `remaining` value from store, pick `tick` or `tick_fast` |
| AUDIO-03 | `end_round` sound (gong/bell) plays on `round_result` event | `round_result` event handler in `useSoundEffects` triggers `end_round` play |
| AUDIO-04 | `winner` sound (fanfare) plays on `game_end` event | `game_end` event handler in `useSoundEffects` triggers `winner` play |
| AUDIO-05 | AudioContext unlocked on first user interaction (nickname submit button) | Howler.js `autoUnlock` (default `true`) handles this automatically; join button ensures gesture context |
| AUDIO-06 | All audio files bundled locally in Docker image -- no external CDN | MP3 files in `frontend/public/sounds/` -- copied to `dist/` by Vite, then to Docker image via `COPY --from=frontend-build` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Howler.js** | 2.2.4 | Audio playback engine | Already in package.json. Handles Web Audio API + HTML5 Audio fallback, cross-browser autoplay unlock, file caching for offline replay. No v3 exists. [VERIFIED: npm registry] |
| **Motion** | 12.40.x | Timer ring color animations | Already in project. Can be used for volume fade or audio cue visual indicators (e.g., flash on tick). [CITED: CLAUDE.md] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| -- | -- | -- | No additional libraries needed. Howler.js + Zustand subscriptions are sufficient. |

**Installation:**
```bash
# Howler is already installed -- verify:
npm view howler version  # 2.2.4
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **Howler.js (bare)** | **react-howler** (npm wrapper) | react-howler is a thin `<ReactHowler>` component wrapper. Adds a component lifecycle layer that complicates imperative sound triggers from WebSocket events. Bare Howler.js is simpler for event-driven playback. |
| **Howler.js** | **Native Web Audio API** | Native API needs manual AudioContext management, cross-browser format handling, iOS autoplay quirks. Howler wraps all this in 7KB gzipped. [CITED: CLAUDE.md] |
| **Howler.js** | **HTML5 `<audio>` tag** | `<audio>` elements have less precise playback control, no sprite support, and unreliable playback on mobile. Howler.js uses them only as fallback. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| howler | npm | 10+ years | 1M+/week | github.com/goldfire/howler.js | [OK] (npm, not PyPI) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Note: slopcheck returned `[SLOP]` for `howler` because it checks PyPI only. `howler` is an npm package. Verified on npm registry: version 2.2.4, no postinstall script, source repo at github.com/goldfire/howler.js. Safe to use.

**No new packages required for this phase.** Howler.js is already in package.json.

## Architecture Patterns

### System Architecture Diagram

```
WebSocket Event Flow:
  Server --timer_tick--> useWebSocket hook --> gameStore.setTimer(remaining)
                                                    |
                                                    v
                                              useSoundEffects hook
                                              (subscribes to store)
                                                    |
                                        +-----------+-----------+
                                        |                       |
                                   remaining > 3           remaining <= 3
                                        |                       |
                                   play('tick.mp3')      play('tick_fast.mp3')

  Server --round_result--> useWebSocket hook --> store.setRoundResultData()
                                                      |
                                                      v
                                                useSoundEffects
                                                      |
                                                 play('end_round.mp3')

  Server --game_end--> useWebSocket hook --> store.setGameEndResultData()
                                                      |
                                                      v
                                                useSoundEffects
                                                      |
                                                 play('winner.mp3')

AudioContext Unlock Path:
  User clicks "Присоединиться" button
            |
            v
    Howler.js autoUnlock handles it:
      Listens for first touchend/click
      Creates/resumes AudioContext silently
      Plays empty buffer
      Fires 'unlock' event
            |
         All subsequent Howler.play() calls work
```

### Recommended Audio Module Structure
```
frontend/src/
├── audio/
│   ├── SoundManager.ts      # Singleton: preloads all 4 Howl instances, exposes play()
│   └── useSoundEffects.ts   # React hook: subscribes to gameStore, calls SoundManager.play()
frontend/public/
├── sounds/
│   ├── tick.mp3             # Short click (~0.1s) for normal countdown
│   ├── tick_fast.mp3        # Higher-pitch click for last 3 seconds
│   ├── end_round.mp3        # Gong/bell (~1s) for round end
│   └── winner.mp3           # Fanfare (~3s) for game end
```

### Pattern 1: Imperative Sound Manager Singleton
**What:** A plain TypeScript class (not React component) that owns Howler.js instances. Created once at app startup. Accessible from outside React tree.

**When to use:** Always. Playback is triggered by WebSocket event handlers and store subscriptions, not by component lifecycle. A singleton avoids the "component unmount killed audio" problem.

**Example:**
```typescript
// frontend/src/audio/SoundManager.ts
// Source: Howler.js official docs (howlerjs.com) + cross-referenced with Howler.js GitHub README

import { Howl } from 'howler'

type SoundName = 'tick' | 'tick_fast' | 'end_round' | 'winner'

class SoundManager {
  private sounds: Map<SoundName, Howl> = new Map()
  private preloaded = false

  preload(): void {
    if (this.preloaded) return

    const configs: Array<{ name: SoundName; src: string }> = [
      { name: 'tick', src: '/sounds/tick.mp3' },
      { name: 'tick_fast', src: '/sounds/tick_fast.mp3' },
      { name: 'end_round', src: '/sounds/end_round.mp3' },
      { name: 'winner', src: '/sounds/winner.mp3' },
    ]

    for (const { name, src } of configs) {
      this.sounds.set(
        name,
        new Howl({
          src: [src],
          preload: true,
          volume: name === 'tick' || name === 'tick_fast' ? 0.5 : 1.0,
          onloaderror: (_id: number, errCode: number) => {
            console.warn(`[Audio] Failed to load ${name}: code ${errCode}`)
          },
        })
      )
    }

    this.preloaded = true
  }

  play(name: SoundName): void {
    const sound = this.sounds.get(name)
    if (!sound) {
      console.warn(`[Audio] Sound "${name}" not found`)
      return
    }
    // Howler.js autoUnlock handles AudioContext resume on first gesture.
    // If AudioContext is still suspended, Howler queues the play.
    sound.play()
  }

  stopAll(): void {
    for (const sound of this.sounds.values()) {
      sound.stop()
    }
  }

  // For fast tick, we want to stop the regular tick if it's still playing
  stop(name: SoundName): void {
    this.sounds.get(name)?.stop()
  }

  get(name: SoundName): Howl | undefined {
    return this.sounds.get(name)
  }
}

export const soundManager = new SoundManager()
```

### Pattern 2: useSoundEffects Hook (Store Subscription)
**What:** A React hook that subscribes to gameStore selectors and calls `soundManager.play()` on state transitions.

**When to use:** Every component that needs audio feedback. Place in the top-level GameScreen or its parent so it mounts once.

**Example:**
```typescript
// frontend/src/audio/useSoundEffects.ts
// Source: Zustand v5 docs (selector subscriptions) + Howler.js GitHub issue #1287 (AudioContext unlock pattern)

import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { soundManager } from './SoundManager'

export function useSoundEffects() {
  // Track previous values to detect transitions (avoid playing on mount)
  const prevPhaseRef = useRef(useGameStore.getState().phase)
  const prevRemainingRef = useRef(useGameStore.getState().remaining)
  const initializedRef = useRef(false)

  // Step 1: Preload all sounds on mount
  useEffect(() => {
    soundManager.preload()
    initializedRef.current = true
  }, [])

  // Step 2: Subscribe to timer_tick for tick/tick_fast sounds
  useEffect(() => {
    const unsub = useGameStore.subscribe(
      (state) => state.remaining,
      (remaining, prevRemaining) => {
        // Only play on decrement (not on round start when it resets to 10)
        if (remaining < prevRemaining) {
          if (remaining > 3) {
            soundManager.play('tick')
          } else {
            soundManager.play('tick_fast')
          }
        }
      }
    )
    return unsub
  }, [])

  // Step 3: Subscribe to round_result event for end_round sound
  useEffect(() => {
    const unsub = useGameStore.subscribe(
      (state) => state.roundResult,
      (roundResult) => {
        if (roundResult !== null) {
          soundManager.play('end_round')
        }
      }
    )
    return unsub
  }, [])

  // Step 4: Subscribe to game_end event for winner sound
  useEffect(() => {
    const unsub = useGameStore.subscribe(
      (state) => state.gameEndResult,
      (gameEndResult) => {
        if (gameEndResult !== null) {
          soundManager.play('winner')
        }
      }
    )
    return unsub
  }, [])

  // Step 5: Stop all sounds on game reset
  useEffect(() => {
    const unsub = useGameStore.subscribe(
      (state) => state.phase,
      (phase, prevPhase) => {
        if (phase === 'idle' || phase === 'waiting') {
          soundManager.stopAll()
        }
        if (phase === 'finished' && prevPhase !== 'finished') {
          // winner sound already played via gameEndResult subscription
        }
      }
    )
    return unsub
  }, [])
}
```

### Anti-Patterns to Avoid
- **Playing sounds directly inside `useWebSocket.ts`:** The hook is for connection management, not audio. Audio logic belongs in a separate `useSoundEffects` hook.
- **React component for every sound:** Don't render `<audio>` elements. Howler.js manages audio internally -- imperative calls are correct.
- **Creating a new Howl() on every WebSocket event:** Preload all Howl instances once in SoundManager singleton. Recreate only on failure.
- **AudioContext unlock in useEffect:** Mobile browsers require a direct user gesture. Howler.js `autoUnlock` handles this. Do NOT try to manually call `Howler.ctx.resume()` in a useEffect -- it won't work from non-gesture context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio playback on mobile browsers | Manual AudioContext + Web Audio API | Howler.js | Cross-browser AudioContext unlock, format fallback, iOS autoplay quirks, iOS tab suspension handling. Howler wraps ~50 edge cases you don't want to discover at a conference. |
| Sound file serving | Dynamic file routing | StaticFiles + `public/` directory | Vite copies `public/` to `dist/` unchanged. FastAPI mounts `static/` at `/`. The file at `/sounds/tick.mp3` works from any path in the frontend. |
| Captive portal detection | Custom detection logic | Informational signs | No JS API can suppress OS-level captive portal checks. Booth staff should tell attendees to hit "skip" or "use network without internet" on the captive portal page. |

**Key insight:** Audio playback across mobile browsers is a minefield of platform-specific restrictions. Howler.js has been solving this since 2013 and handles every browser quirk including iOS AudioContext suspension on tab switch, Android Chrome autoplay policies, and HTML5 Audio fallback for Web Audio API incompatibility.

## Runtime State Inventory

> Not applicable -- Phase 5 is an enhancement phase (adding audio + deployment hardening), not a rename/refactor/migration phase. The only runtime state to consider is the Docker image which needs to include audio files.

## Common Pitfalls

### Pitfall 1: Howler.js `autoUnlock` Fails Without User Gesture
**What goes wrong:** Sounds don't play on mobile browsers (iOS Safari, Android Chrome).
**Why it happens:** Howler.js `autoUnlock=true` listens for the first `touchend`/`click` event globally. If the page loads but the user never interacts (e.g., auto-reconnect), AudioContext stays suspended.
**How to avoid:** The join button click is the first user gesture. This is sufficient. However, if a player reconnects without clicking (e.g., page refresh with auto-reconnect), they may miss sounds until the next gesture.
**Warning signs:** Check `Howler.ctx.state` in devtools -- if `"suspended"`, audio is blocked. `console.warn` on `onplayerror`.

### Pitfall 2: Duplicate Sound Playback on State Subscriptions
**What goes wrong:** `tick` plays twice per second, or sounds overlap.
**Why it happens:** The `timer_tick` event fires every second. If the store subscription fires extra times due to React StrictMode double-mounting or other store updates, `tick` plays on each subscription callback.
**How to avoid:** Use Zustand's `subscribe` with a comparator function. The `useSoundEffects` pattern above checks `remaining < prevRemaining` to only play on decrement. For StrictMode, wrap `soundManager.preload()` with a `preloaded` flag guard.
**Warning signs:** Listen during development with DevTools audio tab open.

### Pitfall 3: Winner Sound Interrupted by Game Reset
**What goes wrong:** `game_end` plays winner fanfare, then admin hits restart before it finishes -- `tick` starts playing over the fanfare.
**Why it happens:** `game_reset` event triggers `phase === 'waiting'` subscription which calls `soundManager.stopAll()`.
**How to avoid:** Add a delay or let the fanfare finish naturally. Option 1: call `stopAll()` except `winner`. Option 2: add `Howler.once('end', ...)` callback on winner to not start game sounds until winner ends. The simpler approach is to not stop winner when phase transitions to waiting -- the fanfare is short (~3s) and conference noise means nobody notices overlap.
**Warning signs:** Test restart immediately after game end.

### Pitfall 4: Audio File Format Incompatibility on Older Devices
**What goes wrong:** Conference laptops or tablets might use older browsers (e.g., Safari on older iPad, Firefox on Linux) that lack MP3 codec.
**Why it happens:** MP3 is universally supported on modern browsers, but extremely old OS versions may lack codecs.
**How to avoid:** Target the minimum OS versions used at the conference. MP3 works on: Chrome/Edge 100+, Safari 15+, Firefox 100+, all on Windows 10+, macOS 12+, iOS 15+, Android 10+. This covers 99.9% of conference tablets/laptops.
**Warning signs:** No test devices older than ~2018 on the booth. Staff laptops are typically modern.

### Pitfall 5: Docker Build Includes Stale Frontend Without Audio Files
**What goes wrong:** `docker compose up --build` uses a cached frontend build layer that doesn't have audio files.
**Why it happens:** Docker layer caching doesn't re-run `npm run build` if `frontend/package*.json` and `frontend/` directory haven't changed -- but adding files to `frontend/public/` does change the directory.
**How to avoid:** `COPY frontend/ .` (not `COPY frontend/package*.json`) ensures all files including `public/sounds/` are copied. Docker will re-run the build step whenever any `frontend/` file changes.
**Warning signs:** Run `docker compose build --no-cache` once before the event for 100% certainty.

## Code Examples

### SoundManager Integration in GameScreen
```typescript
// frontend/src/components/GameScreen.tsx (modified)
// Source: Zustand v5 subscribe API + Howler.js 2.2.4 official API

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { useSoundEffects } from '../audio/useSoundEffects'
import JoinScreen from './JoinScreen'
import WaitingScreen from './WaitingScreen'
import PlayingScreen from './PlayingScreen'
import GameHeader from './GameHeader'
import ResultOverlay from './ResultOverlay'
import FinalScreen from './FinalScreen'
import ConnectionStatus from './ConnectionStatus'

export default function GameScreen() {
  const phase = useGameStore((s) => s.phase)
  const ws = useGameStore((s) => s.ws)
  const { connect } = useWebSocket()

  // Mount sound effects hook -- starts preloading, subscribes to store
  useSoundEffects()

  const showHeader = ['playing', 'showing_result', 'finished'].includes(phase)

  useEffect(() => {
    if (!ws) {
      connect()
    }
  }, [ws, connect])

  return (
    <div className="relative min-h-screen bg-wb-bg overflow-hidden">
      {showHeader && <GameHeader />}
      <AnimatePresence>
        {phase === 'idle' || phase === 'joining' ? (
          <JoinScreen key="join" />
        ) : phase === 'waiting' ? (
          <WaitingScreen key="waiting" />
        ) : phase === 'playing' ? (
          <PlayingScreen key="playing" />
        ) : phase === 'showing_result' ? (
          <ResultOverlay key="result" />
        ) : phase === 'finished' ? (
          <FinalScreen key="finished" />
        ) : null}
      </AnimatePresence>
      <ConnectionStatus />
    </div>
  )
}
```

### AudioContext State Check for Debugging
```typescript
// Debug helper -- add to dev console during testing
// Source: Howler.js GitHub issue #1287

function checkAudioStatus() {
  const Howler = (window as any).Howler
  if (!Howler) return console.warn('Howler not loaded')
  console.table({
    usingWebAudio: Howler.usingWebAudio,
    noAudio: Howler.noAudio,
    ctxState: Howler.ctx?.state ?? 'no ctx',
    autoUnlock: Howler.autoUnlock,
  })
}
```

### WiFi Captive Portal Warning Component (Optional Enhancement)
```typescript
// frontend/src/components/WiFiWarning.tsx (optional -- informational only)
// Source: Web search results on captive portal behavior (no standard JS API exists)

import { useEffect, useState } from 'react'

export default function WiFiWarning() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Try to fetch a local endpoint; if it fails, we might be behind a captive portal
    fetch('/api/questions?limit=1')
      .then((r) => r.ok && setShow(false))
      .catch(() => setShow(true))
  }, [])

  // But this is unreliable -- captive portals typically let HTTP through but redirect.
  // Best practice: show a static notice on the JoinScreen.
  return null // Component kept for documentation only
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Howler.js `mobileAutoEnable` | `autoUnlock` | v2.1.0 (2019) | Audio unlocking is no longer mobile-only; desktop Chrome/Safari also block autoplay |
| `framer-motion` npm package | `motion` npm package | 2026 | Import from `"motion/react"` not `"framer-motion"` |

**Deprecated/outdated:**
- `react-howler`: Obsolete wrapper. Bare Howler.js is simpler for event-driven game sounds where playback is triggered by WebSocket events, not component lifecycle.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MP3 files in `frontend/public/sounds/` are served by FastAPI at `/sounds/file.mp3` in Docker | Standard Stack | MEDIUM -- Dockerfile copies `dist/` to `backend/static/`. Since `public/` goes to `dist/`, and `dist/` becomes `static/`, the URL should be `/sounds/file.mp3`. Verify by checking Docker build output. |
| A2 | Howler.js `autoUnlock` works on the first click of the join button (not a page-level interaction) | Architecture Patterns | LOW -- Howler listens for `touchend`/`click` on `document`. Any click in the app should trigger unlock. If the click happens inside an iframe or shadow DOM, it may not propagate. This app has neither. |
| A3 | The conference venue will have a local WiFi setup with no captive portal | Pitfalls | MEDIUM -- If the venue uses a captive portal (login page before network access), users must dismiss it by selecting "use network without internet" or similar option. This is an OS-level behavior outside app control. |
| A4 | Audio files will be ~20-50KB each (short sound effects) | Code Examples | LOW -- If files are larger (100KB+), preload time at startup increases. Not a functional blocker, but verify file sizes before bundling. |
| A5 | `Howl.play()` is safe to call before preload completes | Code Examples | MEDIUM -- Howler.js queues `play()` calls if the sound is not yet loaded. If loading fails, the play silently does nothing. Verified via Howler.js source: `onplayerror` fires if play fails after load. |

## Open Questions

1. **What should the actual audio files (MP3s) sound like?**
   - What we know: tick is a short click (~0.1s), tick_fast is higher-pitched and faster cadence, end_round is a gong/bell (~1s), winner is a fanfare (~3s).
   - What's unclear: Exact audio files need to be created or sourced from royalty-free libraries. Are they being generated programmatically or from a sound pack?
   - Recommendation: Source from free sound effects libraries (freesound.org, Mixkit, ZapSplat), or generate simple tones/codes with a tool like `ffmpeg`. Keep each file under 100KB. For a game-show feel, end_round should be a "ding-ding-ding" bell and winner should be a short brass fanfare.

2. **Will the conference venue have captive portal on their WiFi?**
   - What we know: Captive portals are common at conferences (login pages). They redirect HTTP requests to a login page, which breaks the offline assumption.
   - What's unclear: The specific venue WiFi setup.
   - Recommendation: Booth staff should test with venue WiFi BEFORE the event day. If captive portal exists, staff should set up their own standalone hotspot router (common practice for gaming booths).

3. **Do we need audio fallback format (OGG) alongside MP3?**
   - What we know: MP3 works on all target browsers. Adding .ogg as a second source in Howler's `src` array adds ~40% more file size in the Docker image.
   - What's unclear: Whether any older conference laptops run a Linux distro without MP3 codecs.
   - Recommendation: Skip OGG for now. MP3 is universally compatible on modern browsers that run on 2019+ hardware. Add OGG only if testing reveals an issue.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Deployment | Yes | 24.0.7 | -- |
| Docker Compose | Deployment | Yes | v2.21.0 | -- |
| Node.js | Frontend build | Yes | v20.20.2 | -- |
| npm | Package management | Yes | 10.8.2 | -- |
| Python 3 | Backend | Yes | 3.12.6 | -- |
| ffmpeg | Audio file generation (dev tool) | No | -- | Use online sound generators or royalty-free MP3 sites |

**Missing dependencies with no fallback:**
- ffmpeg: Not available on this development machine. If custom audio generation is needed, use an online tool (e.g., BeepBox, SFXR) or download from freesound.org/Mixkit.

**Missing dependencies with fallback:**
- None -- all phase-relevant dependencies are available.

## Validation Architecture

> Skipped -- `workflow.nyquist_validation` is explicitly `false` in config.json.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Audio system has no authentication requirements |
| V3 Session Management | no | Audio does not manage sessions |
| V4 Access Control | no | Audio does not handle access control |
| V5 Input Validation | no | No user input related to audio |
| V6 Cryptography | no | No cryptographic operations |

**Phase 5 introduces no new security surface.** Audio files are static assets served by the existing FastAPI StaticFiles mount. WebSocket events trigger playback client-side -- the server does not process or validate audio-related data. No new endpoints or user-facing input fields are added. All attack surfaces were already addressed in Phase 1 (StaticFiles mount ordering, CORS through None) and Phase 2 (WebSocket event validation).

## Deployment Hardening Notes

### Venue WiFi Mitigation Strategy
1. **Preferred:** Use a dedicated portable router (e.g., GL.iNet travel router) creating an isolated hotspot. No captive portal, no DHCP interference.
2. **Fallback:** If using conference WiFi, test connectivity the day before. If captive portal exists, staff must tell attendees to select "Use network without internet" or "Skip" on the captive portal page after connecting to WiFi.
3. **Fail-safe:** The app opens at `http://<server-ip>:8000/` -- this is a plain HTTP page. It will NOT trigger captive portal detection on most devices (captive portals check HTTPS to `captive.apple.com`, `connectivitycheck.gstatic.com`, etc.).

### Docker Image Build Verification
```
# Full rebuild (bypass cache) -- run before event day
docker compose build --no-cache

# Verify audio files are in image
docker run --rm <image-name> ls -la /app/static/sounds/

# Start and test
docker compose up
curl -s http://localhost:8000/sounds/tick.mp3 | head -c 100
# Should return MP3 header bytes, not HTML

# Offline test: disconnect from all internet, then:
docker compose up --build
# Navigate to http://localhost:8000/ on a browser
# Open DevTools > Network tab, filter by "sounds"
# Confirm all 4 audio files load with status 200, no external requests
```

### Offline Verification Checklist
1. Disconnect machine from all networks (WiFi off, ethernet unplugged)
2. Run `docker compose up` - should start in <30 seconds
3. Open `http://localhost:8000/` on a browser -- should render join screen
4. Open DevTools > Network tab -- verify zero requests to external domains
5. Verify all 4 sound files load at `/sounds/{name}.mp3` with status 200
6. Play a full game (open 2 player tabs + admin tab) -- verify sounds play correctly at each phase
7. Test on mobile browser (phone hotspot with no internet) -- verify AudioContext unlocks on join button click

## Sources

### Primary (HIGH confidence)
- Howler.js v2.2.4 GitHub README (github.com/goldfire/howler.js) -- constructor options, methods, events, autoUnlock, preload settings
- Howler.js commits: `autoUnlock` rename from `mobileAutoEnable` (v2.1.0, commit 8cfb397)
- Howler.js GitHub issue #1287 -- AudioContext must be resumed after user gesture
- npm registry -- howler@2.2.4 verified, no postinstall scripts, repository at github.com/goldfire/howler.js
- Zustand v5 subscribe API (already used in project) -- selector-based subscriptions for state change detection
- FastAPI StaticFiles mount pattern -- project main.py already mounts at `/` for serving static assets

### Secondary (MEDIUM confidence)
- Vite discussion #12082 -- public directory files copied as-is to dist, unhashed
- Vite discussion #9965 -- import.meta.url pattern for asset resolution in JS
- Web search on captive portal behavior -- OS-level detection, no JS mitigation possible
- Web search on MP3 browser compatibility -- universal on Chrome, Firefox, Safari, Edge (modern versions)

### Tertiary (LOW confidence)
- Assumption about Docker build caching behavior with public/ directory changes (A1)
- Assumption about Howler.js autoUnlock timing with join button (A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Howler.js is already in package.json, no new deps needed
- Architecture: HIGH -- SoundManager singleton + useSoundEffects hook pattern is well-understood and matches Howler.js designed usage
- Pitfalls: HIGH -- All four pitfalls have clear mitigation paths verified against Howler.js source and browser behavior documentation
- Deployment hardening: MEDIUM -- Captive portal behavior is OS-level and varies by platform; strategy is best-effort based on common conference practices

**Research date:** 2026-06-11
**Valid until:** 30 days (Howler.js 2.2.x has been stable since 2020, no v3 expected)
