# Phase 05: Audio + Deployment Polish - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/audio/SoundManager.ts` | service/singleton | event-driven | `backend/connection_manager.py` | role-match |
| `frontend/src/audio/useSoundEffects.ts` | hook | event-driven (store subscription) | `frontend/src/hooks/useWebSocket.ts` | exact |
| `frontend/src/components/GameScreen.tsx` | component (modified) | render | `frontend/src/components/GameScreen.tsx` (itself) | identity |
| `frontend/src/components/JoinScreen.tsx` | component (modified) | request-response (button click) | `frontend/src/components/JoinScreen.tsx` (itself) | identity |
| `frontend/public/sounds/` | static asset dir | file-I/O | `frontend/public/fonts/` | exact |
| `frontend/vite.config.ts` | config | config | `frontend/vite.config.ts` (itself) | identity |
| `frontend/src/index.css` | style (modified, no code changes needed) | config | `frontend/src/index.css` (itself) | identity |
| `Dockerfile` | deployment config (modified) | file-I/O (build step) | `Dockerfile` (itself) | identity |
| `compose.yml` | deployment config | config | `compose.yml` (itself) | identity |
| offline verification checklist | docs | docs | no code analog | n/a |

## Pattern Assignments

### `frontend/src/audio/SoundManager.ts` (singleton service, event-driven)

**Analog:** `backend/connection_manager.py` (singleton, event-driven WebSocket manager)

**Rationale:** Both are singleton classes managing stateful resources (WebSocket connections / Howler.js instances) with imperative `play()` / `broadcast()` methods. No React dependency. Created once at module level, imported by hooks.

**Imports pattern** (backend/connection_manager.py lines 1-4):
```python
import asyncio
from typing import Optional
from fastapi import WebSocket
```

**Analog TypeScript imports** (to follow same structure):
```typescript
// SoundManager.ts analog imports — single external dependency
import { Howl } from 'howler'
```

**Core singleton pattern** (backend/connection_manager.py lines 7-14) -- singleton class with `__init__` initializing state:
```python
class ConnectionManager:
    def __init__(self):
        self.player1: Optional[WebSocket] = None
        self.player2: Optional[WebSocket] = None
        self.admin: Optional[WebSocket] = None
        self.player1_nickname: Optional[str] = None
        self.player2_nickname: Optional[str] = None
```

**Exported singleton instance** (backend/main.py line 22) -- instantiated at module level, not inside a class:
```python
manager = ConnectionManager()
```

**Analog TypeScript singleton export pattern:**
```typescript
export const soundManager = new SoundManager()
```

**Method pattern: broadcast** (connection_manager.py lines 28-30) -- iterates over all resources, sends to each:
```python
async def broadcast(self, message: dict):
    tasks = [ws.send_json(message) for ws in self.all_connections]
    await asyncio.gather(*tasks, return_exceptions=True)
```

**Analog method pattern** -- `play()` iterates Map entries, calls `.play()` on the Howl:
```typescript
play(name: SoundName): void {
    const sound = this.sounds.get(name)
    if (!sound) {
      console.warn(`[Audio] Sound "${name}" not found`)
      return
    }
    sound.play()
}
```

**Error handling pattern** (connection_manager.py lines 32-38) -- try/except with silent pass for individual send failures:
```python
async def send_to_player(self, player_num: int, message: dict):
    ws = self.player1 if player_num == 1 else self.player2
    if ws:
        try:
            await ws.send_json(message)
        except Exception:
            pass
```

**Analog error handling** -- Howler.js `onloaderror` callback for load failures, null check before play:
```typescript
new Howl({
    src: [src],
    preload: true,
    volume: 0.5,
    onloaderror: (_id: number, errCode: number) => {
        console.warn(`[Audio] Failed to load ${name}: code ${errCode}`)
    },
})
```

---

### `frontend/src/audio/useSoundEffects.ts` (hook, event-driven subscription)

**Analog:** `frontend/src/hooks/useWebSocket.ts` (hook, event-driven WebSocket dispatch)

**Rationale:** Both are React hooks that (1) use `useRef` for tracking mutable state across renders, (2) import and call methods on `useGameStore`, (3) use `useEffect` for setup/teardown lifecycle, and (4) respond to events from external sources (WebSocket messages / store state changes).

**Imports pattern** (useWebSocket.ts lines 1-3):
```typescript
import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import type { WsMessage } from '../types/ws'
```

**Analog useSoundEffects imports** (to follow same structure):
```typescript
import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { soundManager } from './SoundManager'
```

**useRef for tracking prior values** (useWebSocket.ts lines 6-7) -- mutable refs that don't cause re-renders:
```typescript
const wsRef = useRef<WebSocket | null>(null)
const intentionalCloseRef = useRef(false)
```

**Analog useRef pattern** -- track previous phase/remaining to detect transitions:
```typescript
const prevPhaseRef = useRef(useGameStore.getState().phase)
const prevRemainingRef = useRef(useGameStore.getState().remaining)
const initializedRef = useRef(false)
```

**useEffect with cleanup** (useWebSocket.ts lines 167-172) -- return cleanup function from useEffect:
```typescript
useEffect(() => {
    return () => {
      intentionalCloseRef.current = true
      wsRef.current?.close()
    }
}, [])
```

**Analog useEffect with cleanup** -- preload on mount, no cleanup needed for sound (Sounds persist):
```typescript
useEffect(() => {
    soundManager.preload()
    initializedRef.current = true
}, [])
```

**Zustand subscribe pattern** (no analog in useWebSocket.ts -- that hook uses `useGameStore.setState()` and `useGameStore.getState()` directly) -- key pattern from RESEARCH.md:
```typescript
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
```

**Why use `subscribe` over `useGameStore((s) => s.remaining)`:** The `subscribe` API fires synchronously on every state change and receives previous value for comparison. The hook selector (`useGameStore((s) => s.remaining)`) only triggers re-renders. Since audio playback doesn't need re-renders, `subscribe` is correct. This is documented in Zustand v5 docs.

**Key pattern for tournament notification: `subscribe` with selector + comparator:**

```typescript
// Subscribe to round_result event for end_round sound (RESEARCH.md Pattern 2)
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

// Subscribe to game_end event for winner sound
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

// Stop all sounds on game reset (phase transitions to idle/waiting)
useEffect(() => {
    const unsub = useGameStore.subscribe(
      (state) => state.phase,
      (phase, prevPhase) => {
        if (phase === 'idle' || phase === 'waiting') {
          soundManager.stopAll()
        }
      }
    )
    return unsub
}, [])
```

---

### `frontend/src/components/GameScreen.tsx` (component, render -- MODIFIED)

**Analog:** `frontend/src/components/GameScreen.tsx` (existing self)

**Modification:** Add `useSoundEffects()` hook call at top of component body.

**Current import block** (lines 1-11):
```typescript
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { useWebSocket } from '../hooks/useWebSocket'
import JoinScreen from './JoinScreen'
import WaitingScreen from './WaitingScreen'
import PlayingScreen from './PlayingScreen'
import GameHeader from './GameHeader'
import ResultOverlay from './ResultOverlay'
import FinalScreen from './FinalScreen'
import ConnectionStatus from './ConnectionStatus'
```

**New import to add** (after `useWebSocket` import):
```typescript
import { useSoundEffects } from '../audio/useSoundEffects'
```

**Current hook usage pattern** (lines 14-16) -- hooks called at top of component, before any conditional returns:
```typescript
export default function GameScreen() {
  const phase = useGameStore((s) => s.phase)
  const ws = useGameStore((s) => s.ws)
  const { connect } = useWebSocket()
```

**New hook call to add** (after `connect` line):
```typescript
  // Mount sound effects hook -- starts preloading, subscribes to store
  useSoundEffects()
```

---

### `frontend/src/components/JoinScreen.tsx` (component, request-response -- MODIFIED)

**Analog:** `frontend/src/components/JoinScreen.tsx` (existing self)

**Modification:** No code changes needed. The join button (`handleJoin` callback) is the first user gesture, which triggers Howler.js `autoUnlock`. This is an **implicit** pattern -- the code already works because Howler.js listens for `touchend`/`click` on `document`.

**Button click handler** (lines 13-17) -- this is the AudioContext unlock gesture point:
```typescript
const handleJoin = useCallback(() => {
    const trimmed = nickname.trim()
    if (!trimmed || isSubmitting) return
    join(trimmed)
}, [nickname, isSubmitting, join])
```

**Button element** (lines 43-49) -- the click event that triggers Howler autoUnlock:
```tsx
<button
    type="button"
    onClick={handleJoin}
    disabled={isSubmitting}
    className="...bg-player1..."
>
    {isSubmitting ? 'Отправка...' : 'Присоединиться'}
</button>
```

**No changes needed.** AudioContext unlock happens transparently via Howler.js autoUnlock on this click. However, consider adding a `console.log('[Audio] Howler initialized')` after the first click for debugging.

---

### `frontend/public/sounds/` (static asset directory, file-I/O)

**Analog:** `frontend/public/fonts/` (existing static asset directory)

**Rationale:** Both are static asset directories under `frontend/public/`. Vite copies `public/` contents as-is to `dist/` unhashed. Fonts and MP3s follow identical bundling patterns.

**Current font files:**
```
frontend/public/fonts/
  Inter-Bold.woff2
  Inter-Regular.woff2
  Inter-SemiBold.woff2
```

**New directory to create:**
```
frontend/public/sounds/
  tick.mp3
  tick_fast.mp3
  end_round.mp3
  winner.mp3
```

**Font loading pattern** (index.css lines 3-22) -- `@font-face` with url path starting with `/`:
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}
```

**Analog audio loading pattern** (SoundManager.ts) -- URL path starting with `/`:
```typescript
const configs: Array<{ name: SoundName; src: string }> = [
    { name: 'tick', src: '/sounds/tick.mp3' },
    { name: 'tick_fast', src: '/sounds/tick_fast.mp3' },
    { name: 'end_round', src: '/sounds/end_round.mp3' },
    { name: 'winner', src: '/sounds/winner.mp3' },
]
```

**Why this works:** `frontend/public/` is Vite's static asset directory. Files placed there are copied verbatim to `dist/`. In Docker, `COPY --from=frontend-build /app/dist ./static` places them at `static/sounds/tick.mp3`. FastAPI's `StaticFiles` mount at `/` serves them at `/sounds/tick.mp3`.

---

### `frontend/vite.config.ts` (config -- NO CHANGES NEEDED)

**Analog:** existing `frontend/vite.config.ts`

**Current content** (lines 1-7):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**No changes needed.** Vite copies `public/` to `dist/` by default. No additional configuration is required for static audio file serving.

---

### `Dockerfile` (deployment config -- MODIFIED)

**Analog:** existing `Dockerfile`

**Rationale:** The current Dockerfile copies `frontend/` into the build stage, runs `npm run build`, and copies `dist/` into the backend stage. Since `public/sounds/` is inside `frontend/`, it is already included. **No changes needed if `public/sounds/` exists at build time.**

**Current multi-stage build** (lines 1-27):
```dockerfile
# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/dist ./static
...
```

**Verification:** Line 6 (`COPY frontend/ ./`) copies the entire `frontend/` directory including `public/sounds/`. Line 17 (`COPY --from=frontend-build /app/dist ./static`) copies Vite output including `dist/sounds/`. No Dockerfile changes needed.

**Important:** If audio files are added AFTER the Docker build cache has been populated, Docker will re-run the frontend build step (because `frontend/` directory changed). This is correct behavior. For event-day certainty, run `docker compose build --no-cache`.

---

### `compose.yml` (deployment config -- NO CHANGES NEEDED)

**Analog:** existing `compose.yml`

**Current content** (lines 1-7):
```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
```

**No changes needed.** Audio files are embedded in the Docker image. The volume mount `./data:/app/data` is for SQLite persistence only.

---

### Offline Verification Checklist (docs -- no code analog)

**No existing test file pattern exists in the project** (no `*.test.*` files found). This is a documentation-only deliverable. The checklist from RESEARCH.md should be included directly in the verification document or plan.

**Offline test procedure to document:**
```
1. Disconnect machine from all networks (WiFi off, ethernet unplugged)
2. Run `docker compose up --build` -- should start in <30 seconds
3. Open http://localhost:8000/ -- should render join screen
4. Open DevTools > Network tab -- verify zero requests to external domains
5. Verify all 4 sound files load at /sounds/{name}.mp3 with status 200
6. Play a full game (2 player tabs + admin tab) -- verify sounds play correctly
7. Test on mobile browser (phone hotspot with no internet) -- verify AudioContext unlocks
```

---

## Shared Patterns

### Zustand Store Subscription Pattern
**Source:** `frontend/src/stores/gameStore.ts` + Zustand v5 subscribe API
**Applies to:** `frontend/src/audio/useSoundEffects.ts`

The store exposes these state fields that `useSoundEffects` subscribes to:

| Field | Type | Sound Triggered | Condition |
|-------|------|----------------|-----------|
| `state.remaining` | number | `tick` or `tick_fast` | Decrement detected: `remaining < prevRemaining`; `remaining > 3` plays `tick`, else `tick_fast` |
| `state.roundResult` | object \| null | `end_round` | `roundResult !== null` (transition from null to object) |
| `state.gameEndResult` | object \| null | `winner` | `gameEndResult !== null` (transition from null to object) |
| `state.phase` | string | `stopAll()` | Phase transitions to `idle` or `waiting` |

**Key insight:** The subscribe callback receives BOTH current and previous values. This enables transition detection without `useRef`. Example:
```typescript
useGameStore.subscribe(
  (state) => state.remaining,
  (remaining, prevRemaining) => {
    if (remaining < prevRemaining) { /* decrement detected */ }
  }
)
```

### Singleton Module Export Pattern
**Source:** `backend/connection_manager.py` line 22 (`manager = ConnectionManager()`) + `backend/main.py`
**Applies to:** `frontend/src/audio/SoundManager.ts`

Singleton is instantiated at module level and exported. No dependency injection or React Context needed. The singleton is imported by the hook file via standard ES module import.

### Static Asset Serving Pattern
**Source:** `frontend/public/fonts/` directory + Dockerfile line 6 (`COPY frontend/ ./`)
**Applies to:** `frontend/public/sounds/`

Pattern for any static asset:
1. Place files in `frontend/public/{type}/` (Vite copies to `dist/{type}/`)
2. Reference via absolute URL from root: `/{type}/{filename.ext}`
3. Docker includes them automatically via `COPY frontend/ ./`

### Audio File Format Compatibility
- MP3 works on all target browsers (Chrome/Edge 100+, Safari 15+, Firefox 100+)
- No OGG fallback needed for modern conference devices (2019+ hardware)
- File size target: 20-50KB per file (short sound effects)
- Source: royalty-free libraries (freesound.org, Mixkit, ZapSplat) or generated via online tools

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| offline verification checklist | docs | docs | No existing test/documentation files in the project. This is a procedural document, not code. |

---

## Metadata

**Analog search scope:**
- `frontend/src/audio/` -- new directory (no existing audio files)
- `frontend/src/hooks/useWebSocket.ts` -- primary hook pattern analog
- `frontend/src/stores/gameStore.ts` -- store subscription API
- `frontend/src/stores/adminStore.ts` -- secondary store pattern (unused but available)
- `frontend/src/hooks/useAdminWebSocket.ts` -- secondary hook pattern
- `backend/connection_manager.py` -- singleton manager analog
- `frontend/src/components/GameScreen.tsx` -- component integration point
- `frontend/src/components/JoinScreen.tsx` -- AudioContext unlock gesture point
- `frontend/src/components/PlayingScreen.tsx` -- timer tick consumer
- `frontend/src/components/FinalScreen.tsx` -- game end display (winner sound trigger)
- `frontend/src/components/ResultOverlay.tsx` -- round result display (end_round sound trigger)
- `frontend/src/components/TimerRing.tsx` -- timer visualization (timer_tick consumer)
- `frontend/public/fonts/` -- static asset analog for sounds/
- `Dockerfile` -- build pattern
- `compose.yml` -- deployment pattern

**Files scanned:** 25 source files + 4 config/deployment files
**Pattern extraction date:** 2026-06-11
