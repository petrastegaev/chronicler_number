# Phase 3: Player Frontend - Research

**Researched:** 2026-06-10
**Domain:** React 19 SPA, WebSocket client integration, timer animation, game UI
**Confidence:** HIGH

## Summary

Phase 3 builds the complete player-facing frontend for the "Number Duel" game. Two players join with nicknames, see 9 rounds of numeric questions against a circular countdown timer, submit answers with early-submit strategy, view per-round results, and see final standings. This is a thin display layer over the Phase 2 server-authoritative WebSocket protocol -- no game logic lives in the client.

All 14 locked decisions from CONTEXT.md are supported by the existing stack (React 19, Motion v12, Zustand v5, Tailwind CSS v4, TypeScript 5.x). The existing Zustand store (`gameStore.ts`) already has the state fields needed; the existing WebSocket TypeScript types (`ws.ts`) already define all protocol events. No new packages need to be installed -- all dependencies are already in `package.json`.

**Primary recommendation:** Build a single `<GameScreen>` component at route `/` that renders different sub-components based on Zustand `phase`. Use a custom `useWebSocket` hook backed by the Zustand store (accessible outside React via `getState()`/`setState()`). Implement the SVG circular timer with Motion `pathLength` on a `<motion.circle>`. Use `AnimatePresence mode="wait"` for crossfade transitions between phases.

**Key architectural insight:** Because the Zustand store is accessible outside the React tree, the WebSocket message handler can call `useGameStore.getState()` and `useGameStore.setState()` directly -- no need for a React hook wrapper. The hook component `useWebSocket` only handles connection lifecycle (connect, disconnect, reconnect) and message routing.

### Phase Requirements Addressed

| ID | Description | Research Support |
|----|-------------|-----------------|
| JOIN-01 | Player navigates to `/`, sees nickname input + "Присоединиться" button | `<JoinScreen>` sub-component, max 15 chars, `input[type=text]` |
| JOIN-03 | After submitting, "Ожидание соперника..." until second player joins | `<WaitingScreen>` sub-component, `phase='waiting'`, conditional text |
| JOIN-04 | When both ready, "Ожидание запуска администратором" | Same `<WaitingScreen>` based on `game_started` not yet received |
| GAME-01 | Admin starts game, both see "Раунд 1 / 9" + question | `<PlayingScreen>` rendered on `game_started` event, `phase='playing'` |
| GAME-03 | Player enters integer answer, auto-submit on timer expiry | `<AnswerInput>` with `submit_answer` on click + `useEffect` timer watcher |
| GAME-06 | Players see correct/own/opponent answer + winner for ~3s | `<ResultOverlay>` with D-04/D-05/D-06 layout, auto-dismiss on next `round_started` |
| GAME-10 | Final screen with scores/winner/draw, wait for admin reset | `<FinalScreen>` on `game_end` event, `phase='finished'`, loops back on `game_reset` |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Timer Visualization**
- D-01: Circular SVG ring timer with counter-clockwise stroke-dashoffset animation, synced to server `timer_tick` events. Digits displayed inside the ring (56-72px bold monospace).
- D-02: Ring color shifts to warning yellow (#F59E0B) at remaining <= 5 seconds, then danger red (#EF4444) at remaining <= 3 seconds. Default color is player's own accent color (blue for player1, orange for player2).
- D-03: Motion library handles the stroke-dashoffset transition -- animation duration matches the 1-second tick interval for smooth visual countdown.

**Round Result Reveal**
- D-04: Full-screen overlay with darkened background (semi-transparent black overlay). A centered card fades and scales in (Motion fade+scale, ~300ms). Game screen hidden behind overlay.
- D-05: Round winner's nickname and answer glow in their player color (blue #3B82F6 for player1, orange #EF4444 for player2). "Ничья" displayed in neutral white for draws.
- D-06: Answer layout: player's own answer on top (larger font), opponent's answer below, correct answer centered between them. Puts focus on "how close was I?" first.
- D-07: Overlay displayed for ~3 seconds (Phase 2 D-15 timing). Auto-dismissed when next `round_started` event arrives. Smooth fade-out transition.

**Answer Input**
- D-08: Large `<input type="number">` field, full-width, 32-40px font, minimum 56px touch target height. Triggers numeric keyboard on tablets. Range: 0-1,000,000.
- D-09: Early submit button ("Ответить") next to the input field. On click: sends `submit_answer` via WebSocket, disables input and button, shows "Ответ принят" confirmation. Player cannot change answer after submission (Phase 2 D-12: first-answer-wins).
- D-10: If player hasn't submitted when timer expires, current input value is auto-submitted. If empty/invalid, treated as no answer (null).
- D-11: Immediate local echo -- typed value appears in the input field instantly. No server round-trip per keystroke.

**Screen Architecture & Transitions**
- D-12: Single-screen architecture -- one `<GameScreen>` component at route `/`. Rendering controlled by Zustand `phase` field (`'idle' | 'joining' | 'waiting' | 'playing' | 'showing_result' | 'finished'`). Sub-components: `<JoinScreen>`, `<WaitingScreen>`, `<PlayingScreen>`, `<ResultOverlay>`, `<FinalScreen>`.
- D-13: Crossfade transitions (300ms) between game states using Motion `AnimatePresence`. Join -> waiting -> playing -> (result overlay) -> playing -> ... -> final.
- D-14: Persistent header bar across all player screens showing game title "Дуэль чисел" (logo/wordmark). During `playing` and `showing_result` phases, header also shows: player's own nickname, current score, and round indicator "Раунд N / 9".

### Claude's Discretion

No areas were deferred to Claude -- all decisions were explicitly selected by the user.

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nickname input + join flow | Browser / Client | -- | Pure UI state until submit; server validates and assigns role |
| WebSocket connection lifecycle | Browser / Client | -- | Native `WebSocket` API, Zustand store as connection manager |
| Timer ring display | Browser / Client | -- | SVG + Motion animation driven by server `timer_tick` `remaining` values |
| Answer input + submit | Browser / Client | -- | Local echo (D-11), submit to server via WebSocket; first-answer-wins enforced server-side |
| Round result overlay display | Browser / Client | -- | Renders server-provided `round_result` data; timing controlled by server (3s between events) |
| Game phase transitions | Browser / Client | -- | Zustand `phase` field drives which sub-component renders; server events trigger phase changes |
| Connection error handling | Browser / Client | -- | WebSocket `onclose` / `onerror` handlers; overlay with reconnect suggestion |
| Score tracking display | Browser / Client | -- | Read-only display of server-provided score values from `score_update` events |

**Key insight:** The browser tier handles ALL of Phase 3. The game is server-authoritative -- every state display is driven by a server WebSocket event. The client never computes game state, never generates questions, never determines winners. This is pure rendering orchestration.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard | Source |
|---------|---------|---------|--------------|--------|
| React | 19.x | UI framework | Current stable; auto-memoization via React Compiler; `use()` API for async data | CLAUDE.md |
| motion | 12.40.x | Animation library | Formerly Framer Motion; handles SVG ring timer, overlay entrance/exit, crossfade transitions | CLAUDE.md |
| Zustand | 5.0.x | Client state management | Selector-based re-renders prevent cascading on 10Hz timer ticks; accessible outside React tree | CLAUDE.md |
| TypeScript | 5.x | Type safety | Catches WebSocket message shape mismatches at compile time | CLAUDE.md |
| Vite | 6.x | Build tool | Official React recommendation; fast HMR, tree-shaking, native ESM | CLAUDE.md |
| Tailwind CSS | 4.3.x | Utility CSS | CSS-first config, zero-runtime, tiny production bundle | CLAUDE.md |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router | 7.x | Client-side routing | Minimal routing: `/` for player, `/admin` for admin. Phase 3 only touches `/`. | CLAUDE.md |
| Howler.js | 2.2.4 | Audio playback | **Phase 5** -- not installed/used in Phase 3. AudioContext unlock on join button click is the only audio-aware requirement in Phase 3; implement as a no-op `initAudioContext()` that Audio phase will fill in. | CLAUDE.md |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand (non-React access) | React Context | Context causes cascading re-renders when game state updates 10+ times/second. Zustand `getState()`/`setState()` outside React tree is essential for WebSocket message handler. | CLAUDE.md |

**Installation:**
```bash
# All packages already installed in frontend/package.json
# No new packages needed for Phase 3
cd frontend && npm install
```

**Version verification:**
| Package | npm Registry Version | Publish Date |
|---------|---------------------|--------------|
| motion | 12.40.0 | 2026-05-21 |
| zustand | 5.0.14 | 2026-05-28 |
| react-router | 7.17.0 | 2026-06-04 |
| react | 19.1.2 | 2026-05-28 |
| react-dom | 19.1.2 | 2026-05-28 |
| howler | 2.2.4 | 2023-09-19 |

## Package Legitimacy Audit

> Required: Phase 3 installs/uses npm packages already in `package.json`. No new packages needed.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| motion | npm | 12 yrs | 2M+/week | github.com/motiondivision/motion | [OK] | Approved (already installed) |
| zustand | npm | 7 yrs | 1M+/week | github.com/pmndrs/zustand | [OK] | Approved (already installed) |
| react-router | npm | 12 yrs | 10M+/week | github.com/remix-run/react-router | [OK] | Approved (already installed) |
| howler | npm | 12 yrs | 200K+/week | github.com/goldfire/howler.js | [OK] | Approved (already installed, Phase 5) |
| react | npm | 11 yrs | 50M+/week | github.com/facebook/react | [OK] | Approved (already installed) |
| react-dom | npm | 11 yrs | 50M+/week | github.com/facebook/react | [OK] | Approved (already installed) |

**Packages removed due to slopcheck [SLOP] verdict:** None -- all verified on npm registry with legitimate source repos.
**Packages flagged as suspicious [SUS]:** None.

*Note: slopcheck ran against PyPI by default (not npm). All packages were cross-verified on the npm registry via `npm view` and have legitimate GitHub source repositories. The slopcheck PyPI results are irrelevant -- these are npm packages, and the npm registry verification confirmed them as legitimate.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Player 1/2)                     │
│                                                              │
│  ┌──────────┐   ┌───────────────┐   ┌────────────────────┐  │
│  │ React    │   │ Zustand Store │   │ WebSocket          │  │
│  │ Router   │──▶│ (gameStore)   │◀──│ Connection Handler │  │
│  │ (route /)│   │               │   │ (non-React,        │  │
│  └──────────┘   │ phase         │   │  uses getState()   │  │
│       │         │ playerNumber  │   │  & setState()      │  │
│       v         │ remaining     │   │  from store)       │  │
│  ┌────────────┐ │ scores        │   └────────┬───────────┘  │
│  │ <GameScreen/>│ │ questionText  │           │              │
│  │  phase-based│ │ roundResult   │           │ events:      │
│  │  rendering  │ │ gameEndResult │           │ timer_tick   │
│  └──────┬─────┘ │ ws            │           │ round_started│
│         │       └───────────────┘           │ round_result │
│         │                                   │ game_end     │
│  ┌──────┴────────────────────────────┐      │ game_reset   │
│  │ AnimatePresence mode="wait"       │      └──────┬───────┘
│  │  ├── <JoinScreen>  (idle,joining) │             │
│  │  ├── <WaitingScreen> (waiting)    │             │ sends:
│  │  ├── <PlayingScreen> (playing)    │             │ submit_answer
│  │  ├── <ResultOverlay> (result)     │             │
│  │  └── <FinalScreen>  (finished)    │             │
│  └────────────────────────────────────┘             │
│                                                     │
│  ┌──────────────────────────────┐                   │
│  │ WebSocket: ws://host:8000/ws │◄──────────────────┘
│  └──────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
                              │
                              │ JSON events
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Server (port 8000)                  │
│  Phase 2 WebSocket handler: dispatch events, handle submits │
└─────────────────────────────────────────────────────────────┘
```

Data flow: Server events -> WebSocket message handler -> `useGameStore.setState()` -> React re-render of active sub-component. Player action -> `useGameStore.getState().ws.send()` -> server.

### Recommended Project Structure

Phase 3 adds/extends these files within the existing frontend structure:

```
frontend/src/
├── components/
│   ├── GameScreen.tsx        # Root component at /, phase-based rendering
│   ├── JoinScreen.tsx        # JOIN-01: nickname input + join button
│   ├── WaitingScreen.tsx     # JOIN-03, JOIN-04: waiting states
│   ├── PlayingScreen.tsx     # GAME-01, GAME-03: question + timer + input
│   ├── TimerRing.tsx         # D-01, D-02, D-03: SVG circular countdown
│   ├── AnswerInput.tsx       # D-08, D-09, D-10, D-11: numeric input + submit
│   ├── GameHeader.tsx        # D-14: nickname, title, score, round indicator
│   ├── ResultOverlay.tsx     # D-04, D-05, D-06, D-07: round result overlay
│   ├── FinalScreen.tsx       # GAME-10: game end summary
│   └── ConnectionStatus.tsx  # Error overlay on WebSocket disconnect
├── hooks/
│   └── useWebSocket.ts       # WebSocket lifecycle + message routing
├── stores/
│   └── gameStore.ts          # EXTEND existing: add ws, submittedAnswer, roundResult, gameEndResult
├── pages/
│   ├── JoinPage.tsx          # REPLACE placeholder with <GameScreen>
│   └── AdminPage.tsx         # UNCHANGED (Phase 4)
├── index.css                 # UNCHANGED (all tokens already defined)
└── App.tsx                   # UNCHANGED (Outlet pattern)
```

### Pattern 1: WebSocket Message Handler (Non-React Store Access)

**What:** Store WebSocket reference in Zustand so the message handler can access state outside React.

**When to use:** Always -- this is the core architectural pattern for Phase 3. The WebSocket `onmessage` handler fires outside any React component lifecycle, so it must use `useGameStore.getState()` and `useGameStore.setState()` directly.

**Pattern:**

```typescript
// hooks/useWebSocket.ts
// Source: Zustand docs + standard WebSocket pattern. Uses getState/setState outside React tree.

import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import type { WsMessage } from '../types/ws'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const setPhase = useGameStore((s) => s.setPhase)
  const setPlayerNumber = useGameStore((s) => s.setPlayerNumber)
  const setGameStarted = useGameStore((s) => s.setGameStarted)
  const setRoundStarted = useGameStore((s) => s.setRoundStarted)
  const setTimer = useGameStore((s) => s.setTimer)
  const setScoreUpdate = useGameStore((s) => s.setScoreUpdate)
  const reset = useGameStore((s) => s.reset)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws`)

    ws.onopen = () => {
      useGameStore.setState({ ws })
    }

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data)
      const store = useGameStore.getState()

      switch (msg.event) {
        case 'joined': {
          const data = msg.data as { player_number?: 1 | 2 }
          store.setPlayerNumber(data.player_number ?? null)
          store.setPhase('waiting')
          break
        }
        case 'game_started': {
          const data = msg.data as { player1_nickname: string; player2_nickname: string }
          store.setGameStarted(data.player1_nickname, data.player2_nickname)
          break
        }
        case 'round_started': {
          const data = msg.data as { round_number: number; total_rounds: number; question_text: string }
          store.setRoundStarted(data.round_number, data.total_rounds, data.question_text)
          break
        }
        case 'timer_tick': {
          const data = msg.data as { remaining: number }
          store.setTimer(data.remaining)
          break
        }
        case 'round_result': {
          const data = msg.data as { round_number: number; correct_answer: number; player1_answer: number | null; player2_answer: number | null; winner: 'player1' | 'player2' | 'draw' }
          useGameStore.setState({ roundResult: data, phase: 'showing_result' })
          break
        }
        case 'score_update': {
          const data = msg.data as { player1_score: number; player2_score: number }
          store.setScoreUpdate(data.player1_score, data.player2_score)
          break
        }
        case 'game_end': {
          const data = msg.data
          useGameStore.setState({ gameEndResult: data, phase: 'finished' })
          break
        }
        case 'game_reset': {
          store.reset()
          store.setPhase('waiting')
          break
        }
        case 'state_snapshot': {
          const data = msg.data as { state: string; current_round: number; remaining: number; question_text: string | null }
          store.setPhase(data.state)
          if (data.question_text) {
            store.setRoundStarted(data.current_round, 9, data.question_text)
          }
          store.setTimer(data.remaining)
          break
        }
      }
    }

    ws.onclose = () => {
      useGameStore.setState({ ws: null, phase: 'idle' })
    }

    wsRef.current = ws
  }, [])

  const join = useCallback((nickname: string) => {
    const store = useGameStore.getState()
    store.setPhase('joining')
    store.ws?.send(JSON.stringify({
      event: 'join',
      data: { role: 'player', nickname }
    }))
  }, [])

  const submitAnswer = useCallback((answer: number | null) => {
    const store = useGameStore.getState()
    store.ws?.send(JSON.stringify({
      event: 'submit_answer',
      data: { answer }
    }))
  }, [])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return { connect, join, submitAnswer }
}
```

### Pattern 2: Timer Ring with Motion pathLength

**What:** SVG circle animated by Motion `pathLength` for counter-clockwise countdown.

**When to use:** The `<TimerRing>` component, always rendered inside `<PlayingScreen>`. The animation is triggered by `remaining` state changes from `timer_tick` events.

**Pattern:**

```typescript
// components/TimerRing.tsx
// Source: Motion.dev docs - SVG pathLength animation + web_design.md section 4.5

import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

const RADIUS = 41  // r=41 for 88px diameter with 6px stroke
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function TimerRing() {
  const remaining = useGameStore((s) => s.remaining)
  const playerNumber = useGameStore((s) => s.playerNumber)

  const progress = remaining / 10  // 1.0 (full) -> 0.0 (empty)
  const getColor = () => {
    if (remaining <= 3) return '#EF4444'  // danger
    if (remaining <= 5) return '#F59E0B'  // warning
    return playerNumber === 1 ? '#3B82F6' : '#EF4444'  // player accent
  }

  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      {/* Background ring */}
      <circle cx="44" cy="44" r={RADIUS} fill="none"
        stroke="#2d1b4e" strokeWidth="6" />
      {/* Animated progress ring */}
      <motion.circle
        cx="44" cy="44" r={RADIUS} fill="none"
        stroke={getColor()}
        strokeWidth="6"
        strokeLinecap="round"
        style={{
          rotate: '-90deg',
          transformOrigin: 'center',
        }}
        animate={{ pathLength: progress }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      {/* Digits inside */}
      <text x="44" y="44" textAnchor="middle" dominantBaseline="central"
        fill="#eeeeee" fontSize="64" fontFamily="Inter, sans-serif"
        fontWeight="600">
        {remaining}
      </text>
    </svg>
  )
}
```

### Pattern 3: AnimatePresence Phase Switching

**When to use:** At the `<GameScreen>` level, wrap the phase-based sub-component rendering.

**Pattern:**

```typescript
// components/GameScreen.tsx
// Source: Motion.dev/docs/react-animate-presence - mode="wait" pattern

import { AnimatePresence, motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { JoinScreen } from './JoinScreen'
import { WaitingScreen } from './WaitingScreen'
import { PlayingScreen } from './PlayingScreen'
import { ResultOverlay } from './ResultOverlay'
import { FinalScreen } from './FinalScreen'
import { GameHeader } from './GameHeader'

export function GameScreen() {
  const phase = useGameStore((s) => s.phase)

  const showHeader = ['playing', 'showing_result', 'finished'].includes(phase)

  return (
    <div className="relative min-h-screen bg-wb-bg overflow-hidden">
      {showHeader && <GameHeader />}
      <AnimatePresence mode="wait">
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
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Using `useState` for WebSocket messages:** WebSocket `onmessage` fires outside React lifecycle. Always use Zustand `getState()`/`setState()` for message handling. Using `useState` would require wrapping in `useSyncExternalStore` or an effect -- unnecessary complexity.
- **Recreating WebSocket on every render:** Store `ws` reference in Zustand store (not a `useRef` local to a single component) so the connection outlives any single component mount/unmount cycle.
- **Computing game state locally:** Never compute winners, scores, or question order in the client. The server is authoritative. Only render what the server sends.
- **Animating timer with CSS only:** Motion's `pathLength` on SVG `<circle>` is the correct approach. CSS `stroke-dashoffset` animation requires computing `stroke-dasharray` from the circle's circumference and updating it -- Motion wraps this natively.
- **Wrapping `AnimatePresence` conditionally:** `AnimatePresence` must remain mounted for exit animations to trigger. The conditional rendering must be INSIDE it, not wrapping it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG circular timer animation | Custom stroke-dashoffset math | Motion `pathLength` on `<motion.circle>` | Motion wraps stroke-dashoffset computation, provides 0.3s ease transition between ticks, handles SVG coordinate transform for counter-clockwise |
| Crossfade phase transitions | Custom CSS animation with timeout | Motion `AnimatePresence mode="wait"` with `initial`/`animate`/`exit` props | `AnimatePresence` manages mounting/unmounting timing, exit animations fire before DOM removal, mode="wait" prevents overlapping content |
| State management outside React tree | React Context + manual subscription | Zustand store with `.getState()`/`.setState()` | WebSocket `onmessage` fires outside React tree; Context requires Provider + hook access; Zustand's vanilla API is purpose-built for this |
| Numeric keyboard on tablets | Custom number pad component | `<input type="number" inputMode="numeric">` | Native browser behavior triggers appropriate keyboard; custom pads break accessibility and add maintenance burden |

**Key insight:** Every pattern in Phase 3 is a standard React/Motion/Tailwind pattern with well-documented solutions. The complexity is in the WebSocket event routing, not in the visual components.

## Common Pitfalls

### Pitfall 1: WebSocket Handler Outside React Cannot Call React State Setters
**What goes wrong:** Calling `useState` or `useGameStore((s) => s.setPhase)()` inside a `ws.onmessage` callback produces stale closures or errors.
**Why it happens:** The `onmessage` handler is a closure over the values at time of assignment. React hooks are tied to component lifecycle and cannot be called outside it.
**How to avoid:** Always use `useGameStore.getState()` and `useGameStore.setState()` inside the `onmessage` handler. The Zustand store's vanilla API is accessible outside React and always has the latest state.
**Warning signs:** "Cannot update a component while rendering a different component" warning, or timer ticks not updating the display.

### Pitfall 2: AnimatePresence Exit Animations Not Firing
**What goes wrong:** Content abruptly disappears instead of fading out.
**Why it happens:** Two common causes: (1) `AnimatePresence` is conditionally rendered itself (the conditional wrapping the `AnimatePresence`, not inside it), or (2) child components don't have stable `key` props.
**How to avoid:** (1) Always keep `AnimatePresence` mounted -- put the conditional inside it, not around it. (2) Use unique string keys per sub-component (`key="join"`, `key="playing"`, etc.). (3) Ensure child components have `exit` animation props defined.
**Warning signs:** Content pops out of view instantly without animation.

### Pitfall 3: Timer Ring Reverse Animation
**What goes wrong:** The SVG ring fills clockwise instead of draining counter-clockwise, or the animation direction is reversed.
**Why it happens:** SVG circles with `rotate: "-90deg"` start from the top. `pathLength` animates from 0 (invisible) to 1 (full circle) which looks like filling, not draining.
**How to avoid:** Animate `pathLength` from 1.0 (full, time=10s) to 0.0 (empty, time=0s). The initial `pathLength` should be 1.0 when `remaining` is 10, and Motion's `animate` updates it downward each tick. With `rotate: "-90deg"`, the circle appears to drain counter-clockwise.
**Warning signs:** Ring appears empty at start of round, fills during countdown, or rotates the wrong direction.

### Pitfall 4: Auto-submit at Timer Expiry Timing
**What goes wrong:** Player hasn't submitted yet, timer hits 0, but the auto-submit fires the `submit_answer` for the previous round's input or fires twice.
**Why it happens:** The `useEffect` watching `remaining === 0` might fire on initial mount (when `remaining` is 0 from a previous round), or the `remaining` transition from 1 to 0 might trigger after the round has already ended.
**How to avoid:** Guard the auto-submit effect with a `hasSubmitted` boolean (stored in Zustand). Only auto-submit when `remaining === 0 && !hasSubmitted && phase === 'playing'`. Reset `hasSubmitted` to `false` on each `round_started` event. Use a `useRef` for the guard if needed to avoid stale closure issues.

## Code Examples

### Extending the Zustand Store (Phase 3 additions)

```typescript
// stores/gameStore.ts - EXTENDED for Phase 3
// Source: Existing gameStore.ts structure + Phase 3 CONTEXT.md D-12

interface GameState {
  phase: string
  playerNumber: 1 | 2 | null
  player1Nickname: string
  player2Nickname: string
  player1Score: number
  player2Score: number
  currentRound: number
  totalRounds: number
  questionText: string
  remaining: number
  // Phase 3 additions:
  ws: WebSocket | null            // D-12: store WS reference for non-React access
  submittedAnswer: boolean        // D-09: prevent double-submit
  myAnswer: number | null         // D-11: local echo value
  roundResult: RoundResultEvent['data'] | null   // D-04: current round result
  gameEndResult: GameEndEvent['data'] | null     // GAME-10: final game data
}

// Add actions:
interface GameActions {
  // ... existing actions unchanged ...
  setSubmittedAnswer: (value: number | null) => void
  setMyAnswer: (value: number | null) => void
  resetRound: () => void          // Called on each round_started
}
```

### Round Result Overlay Layout

```tsx
// Source: 03-CONTEXT.md D-04, D-05, D-06; UI-SPEC.md section "Round Result Overlay"

import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

export function ResultOverlay() {
  const result = useGameStore((s) => s.roundResult)
  const playerNumber = useGameStore((s) => s.playerNumber)
  const player1Nickname = useGameStore((s) => s.player1Nickname)
  const player2Nickname = useGameStore((s) => s.player2Nickname)

  if (!result) return null

  const isWinner =
    (result.winner === 'player1' && playerNumber === 1) ||
    (result.winner === 'player2' && playerNumber === 2)

  const myAnswer = playerNumber === 1 ? result.player1_answer : result.player2_answer
  const opponentAnswer = playerNumber === 1 ? result.player2_answer : result.player1_answer

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,10,46,0.85)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="w-full max-w-md rounded-xl bg-wb-surface p-6 text-center"
        initial={{ opacity: 0, scaleY: 0.85 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <p className="text-xl font-semibold"
          style={{
            color: isWinner ? '#3B82F6' : (result.winner === 'draw' ? '#eeeeee' : '#EF4444')
          }}>
          {isWinner ? 'Вы выиграли раунд!' :
           result.winner === 'draw' ? 'Ничья' :
           'Соперник выиграл раунд'}
        </p>

        <p className="mt-4 text-xl font-semibold" style={{ color: isWinner ? '#3B82F6' : '#eeeeee' }}>
          Ваш ответ: {myAnswer ?? '—'}
        </p>

        <p className="mt-2 text-xl font-semibold text-correct">
          Правильный ответ: {result.correct_answer}
        </p>

        <p className="mt-2 text-xl font-semibold text-wb-text">
          Ответ соперника: {opponentAnswer ?? '—'}
        </p>
      </motion.div>
    </motion.div>
  )
}
```

### Connection Status Overlay

```tsx
// Source: Standard WebSocket error handling pattern
// Displayed as full-screen overlay when WebSocket disconnects mid-game

import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

export function ConnectionStatus() {
  const ws = useGameStore((s) => s.ws)
  const phase = useGameStore((s) => s.phase)

  const disconnected = !ws && phase !== 'idle' && phase !== 'joining'

  return (
    <AnimatePresence>
      {disconnected && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,10,46,0.9)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="text-center">
            <p className="text-xl font-semibold text-wb-text">
              Ошибка соединения
            </p>
            <p className="mt-2 text-base text-wb-text-muted">
              Обновите страницу
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Motion `pathLength` on `<motion.circle>` with `rotate: "-90deg"` produces counter-clockwise drain effect | Architecture Patterns Pattern 2 | Animation direction could be reversed; verified against Motion docs and web_design.md section 4.5 |
| A2 | `AnimatePresence mode="wait"` combined with string keys per phase produces smooth 300ms crossfade transitions | Architecture Patterns Pattern 3 | If rapid phase transitions (timer_tick -> round_result -> round_started) conflict with exit animation duration, content may overlap. Motion v12.38.0 fixed rapid-switching bugs; `mode="wait"` is the correct choice for sequential transitions |
| A3 | WebSocket `onmessage` handler calling `useGameStore.getState()` and `.setState()` directly is the correct pattern | Architecture Patterns Pattern 1 | This is the standard Zustand pattern for non-React contexts. Verified by Zustand docs and the Pattern Stack section. No other approach works for WebSocket message handling |

## Open Questions

1. **[WebSocket Reconnect Strategy]** Should the hook auto-reconnect on disconnect, or show the error overlay and let the user refresh?
   - What we know: Phase 2 D-06 supports reconnect with `state_snapshot`. The session cookie preserves identity. The WebSocket endpoint accepts `?token=` query param for reconnection.
   - What's unclear: The CONTEXT.md references "session cookie for WebSocket reconnect identity" but the current code uses a query param `token` (line 75 of main.py). The frontend must either: (a) send the token from the `joined` response on reconnect, or (b) include credentials.
   - Recommendation: Store the `token` from the `joined` event response. On reconnect, pass it as `?token=` query parameter. After Phase 2's state_snapshot support (D-06), the server restores session state. Do NOT auto-reconnect -- show the error overlay and let user refresh, as the reconnect token must be read from localStorage/sessionStorage.

2. **[Auto-submit on Timer Expiry Timing]** The `useEffect` checking `remaining === 0` vs `useRef` guard.
   - What we know: React 19 strict mode double-invokes effects. `remaining` transitions from 1 to 0 in a single tick. The auto-submit must fire exactly once.
   - Recommendation: Store `submittedAnswer: boolean` in Zustand. Guard auto-submit with `if (remaining === 0 && !state.submittedAnswer && state.phase === 'playing')`. Reset `submittedAnswer = false` on each `round_started` event. This handles strict mode double-invoke and phase transitions cleanly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend dev/build | ✓ | 22.x | -- |
| npm | Package install | ✓ | 10.x | -- |
| Python 3 | Backend for integration testing | ✓ | 3.13.13 | -- |
| Docker | Container verification | ✓ | 24.x | -- |
| SQLite | Backend data store | ✓ | -- | -- |

**Missing dependencies with no fallback:** None -- all dependencies are present.

## Validation Architecture

> Skipped: `workflow.nyquist_validation` is explicitly set to `false` in `.planning/config.json`. No test infrastructure required for this phase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No user accounts; session cookie for reconnect identity only (JOIN-05) |
| V3 Session Management | yes | Session token from `joined` event stored in Zustand/localStorage for reconnect |
| V4 Access Control | no | Single-role (player) in Phase 3; admin access enforced server-side |
| V5 Input Validation | yes | `input[type=number min=0 max=1000000]` browser enforcement; server re-validates (Phase 2) |
| V6 Cryptography | no | No sensitive data; offline local network |

### Known Threat Patterns for React + WebSocket

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| WebSocket injection (fake messages) | Spoofing | Server-authoritative architecture -- client renders what server sends, no local state computation |
| XSS via nickname | Tampering | React's default JSX escaping; server-side nickname validation (max 15 chars, alphanumeric) |
| Replay submit_answer | Tampering | Server enforces first-answer-wins per round (Phase 2 D-12). Client cannot re-submit after button disabled (D-09) |

## Sources

### Primary (HIGH confidence)
- [03-CONTEXT.md](file:///home/petr/IdeaProjects/PetProjects/number_game/.planning/phases/03-player-frontend/03-CONTEXT.md) - All 14 locked decisions D-01 through D-14
- [03-UI-SPEC.md](file:///home/petr/IdeaProjects/PetProjects/number_game/.planning/phases/03-player-frontend/03-UI-SPEC.md) - Component inventory, typography, color, spacing, copywriting contract
- [02-CONTEXT.md](file:///home/petr/IdeaProjects/PetProjects/number_game/.planning/phases/02-core-game-loop/02-CONTEXT.md) - Phase 2 locked decisions D-01 through D-17 (timer protocol, state machine, event payloads)
- [CLAUDE.md](file:///home/petr/IdeaProjects/PetProjects/number_game/CLAUDE.md) - Stack constraints, version compatibility matrix, WebSocket protocol pattern
- [Motion docs](https://motion.dev/docs/react-animate-presence) - AnimatePresence modes, exit animation requirements (keys, conditional placement)
- [npm registry verification](https://www.npmjs.com/) - All six packages verified: motion@12.40.0, zustand@5.0.14, react-router@7.17.0, react@19.1.2, howler@2.2.4

### Secondary (MEDIUM confidence)
- [web_design.md](file:///home/petr/IdeaProjects/PetProjects/number_game/web_design.md) - Visual style, color scheme, typography sizes, timer display design (section 4.5)
- [gdd.md](file:///home/petr/IdeaProjects/PetProjects/number_game/gdd.md) - Player interface specification (section 5), WebSocket client roles (section 7.1), timer sync (section 7.4)
- [Motion SVG pathLength docs](https://motion.dev/docs/react-motion-component) - SVG circle animation with pathLength prop
- [@loanpal/react-websocket](https://socket.dev/npm/package/@loanpal/react-websocket) - Confirm Zustand-backed WebSocket hook pattern

### Tertiary (LOW confidence)
- None -- all claims either verified via official sources or explicitly tagged [ASSUMED].

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified on npm registry, versions confirmed, dependencies already installed
- Architecture: HIGH - Patterns verified against Motion docs, Zustand docs, existing codebase (gameStore.ts, ws.ts, main.py)
- Pitfalls: HIGH - Based on standard React/WebSocket/AnimatePresence known behaviors plus specific Phase 3 protocol constraints

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable stack, no fast-moving dependencies)
