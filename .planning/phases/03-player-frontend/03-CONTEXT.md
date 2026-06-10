# Phase 3: Player Frontend - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

## Phase Boundary

Two players can complete a full game — join with nicknames, see questions, enter answers against a 10-second timer, view per-round results, and see final results on their respective devices. This is the thin display layer over the Phase 2 WebSocket game protocol.

**Requirements:** JOIN-01, JOIN-03, JOIN-04, GAME-01, GAME-03, GAME-06, GAME-10

## Implementation Decisions

### Timer Visualization
- **D-01:** Circular SVG ring timer with counter-clockwise stroke-dashoffset animation, synced to server `timer_tick` events. Digits displayed inside the ring (56-72px bold monospace).
- **D-02:** Ring color shifts to warning yellow (#F59E0B) at remaining ≤ 5 seconds, then danger red (#EF4444) at remaining ≤ 3 seconds. Default color is player's own accent color (blue for player1, orange for player2) or neutral white.
- **D-03:** Motion library handles the stroke-dashoffset transition — animation duration matches the 1-second tick interval for smooth visual countdown.

### Round Result Reveal
- **D-04:** Full-screen overlay with darkened background (semi-transparent black overlay). A centered card fades and scales in (Motion fade+scale, ~300ms). Game screen is hidden behind the overlay.
- **D-05:** Round winner's nickname and answer glow in their player color (blue #3B82F6 for player1, orange #EF4444 for player2). "Ничья" displayed in neutral white for draws.
- **D-06:** Answer layout: player's own answer on top (larger font), opponent's answer below, correct answer centered between them. Puts focus on "how close was I?" first.
- **D-07:** Overlay displayed for ~3 seconds (Phase 2 D-15 timing). Auto-dismissed when next `round_started` event arrives. Smooth fade-out transition.

### Answer Input
- **D-08:** Large `<input type="number">` field, full-width, 32-40px font, minimum 56px touch target height. Triggers numeric keyboard on tablets. Range: 0–1,000,000.
- **D-09:** Early submit button ("Ответить") next to the input field. On click: sends `submit_answer` via WebSocket, disables the input and button, shows "Ответ принят" confirmation. Player cannot change answer after submission (Phase 2 D-12: first-answer-wins).
- **D-10:** If player hasn't submitted when timer expires, current input value is auto-submitted. If input is empty/invalid, treated as no answer (null).
- **D-11:** Immediate local echo — typed value appears in the input field instantly. No server round-trip per keystroke. Server receives answer only on submit button or auto-submit on expiry.

### Screen Architecture & Transitions
- **D-12:** Single-screen architecture — one `<GameScreen>` component at route `/`. Rendering controlled by Zustand `phase` field (`'idle' | 'joining' | 'waiting' | 'playing' | 'showing_result' | 'finished'`). Sub-components: `<JoinScreen>`, `<WaitingScreen>`, `<PlayingScreen>`, `<ResultOverlay>`, `<FinalScreen>`.
- **D-13:** Crossfade transitions (300ms) between game states using Motion `AnimatePresence`. Join → waiting → playing → (result overlay) → playing → ... → final.
- **D-14:** Persistent header bar across all player screens showing game title "Дуэль чисел" (logo/wordmark). During `playing` and `showing_result` phases, header also shows: player's own nickname, current score, and round indicator "Раунд N / 9".

### Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Design & Protocol
- `gdd.md` §5 — Player interface specification, round structure, game flow states
- `gdd.md` §7.1 — WebSocket client roles, join protocol
- `gdd.md` §7.4 — Timer synchronization and client-side display logic
- `web_design.md` §3.1-3.2 — Join screen and game screen layouts, states, and elements
- `web_design.md` §4 — Visual style: color scheme, typography sizes, animation specs
- `web_design.md` §4.5 — Timer display design (circular ring, counter-clockwise fill)

### Phase 2 Locked Decisions (prior context)
- `.planning/phases/02-core-game-loop/02-CONTEXT.md` — D-01 through D-17: timer protocol, state machine phases, event payloads, round flow timing, answer handling. ALL DECISIONS ARE LOCKED and must be respected by Phase 3.

### Project-Wide
- `CLAUDE.md` — Stack constraints (React 19, Vite 6, Tailwind CSS v4, Motion v12, Zustand v5, TypeScript 5.x, Howler.js 2.2.4)
- `.planning/ROADMAP.md` — Phase 3 goal, 7 success criteria, dependency on Phase 2
- `.planning/REQUIREMENTS.md` — JOIN-01, JOIN-03, JOIN-04, GAME-01, GAME-03, GAME-06, GAME-10 full text

## Existing Code Insights

### Reusable Assets
- **`frontend/src/types/ws.ts`** — All WebSocket event TypeScript interfaces already defined: `JoinMessage`, `JoinedEvent`, `GameStartedEvent`, `RoundStartedEvent`, `TimerTickEvent`, `RoundResultEvent`, `ScoreUpdateEvent`, `GameEndEvent`, `GameResetEvent`, `StateSnapshotEvent`, `SubmitAnswer`. Import and use directly — no new types needed for the protocol layer.
- **`frontend/src/stores/gameStore.ts`** — Zustand store with `phase`, `playerNumber`, `player1Nickname`/`player2Nickname`, `player1Score`/`player2Score`, `currentRound`, `totalRounds`, `questionText`, `remaining` fields. Actions: `setPhase`, `setPlayerNumber`, `setGameStarted`, `setRoundStarted`, `setTimer`, `setScoreUpdate`, `reset`. Extend with: WebSocket connection reference, submitted answer, round result data, game end data.
- **`frontend/src/index.css`** — Tailwind CSS v4 theme with all colors defined: `--color-wb-bg` (#1a0a2e), `--color-wb-surface` (#2d1b4e), `--color-wb-text` (#eeeeee), `--color-player1` (#3B82F6), `--color-player2` (#EF4444), `--color-correct` (#10B981), `--color-warning` (#F59E0B), `--color-danger` (#EF4444). Inter fonts loaded as self-hosted WOFF2. Use these theme tokens directly — no new CSS custom properties needed.
- **`frontend/src/App.tsx`** / **`frontend/src/main.tsx`** — React Router with `<Outlet>` pattern at `/` and `/admin`. Phase 3 only touches the `/` route (JoinPage → GameScreen). Admin route stays as placeholder for Phase 4.

### Established Patterns
- **Server-authoritative architecture**: Client is a thin display + input terminal. All game logic runs on the server. Client only renders events received via WebSocket and sends user actions. Never compute game state locally.
- **Zustand for state management**: Selector-based re-renders prevent cascading updates on timer ticks (10/sec). State accessible outside React tree for WebSocket message handler.
- **Russian-language UI**: All user-facing text in Russian per PROJECT.md constraint.
- **Tailwind utility-first**: No CSS modules — all styling via Tailwind classes and theme tokens.
- **Motion for animations**: Import from `"motion/react"`. Declarative animation props on components.

### Integration Points
- **WebSocket connection**: Needs a `useWebSocket` hook or connection manager that lives in the Zustand store (accessible outside React). Connects to `ws://<host>:8000/ws`. Sends `join` event with role `"player"` and nickname on first connect. Listens for all game events and dispatches to store actions.
- **Session token**: Server sets a session cookie on first HTTP request. WebSocket reconnect uses this cookie for identity (Phase 2 JOIN-05). Frontend must include credentials in WebSocket connection.
- **Route at `/`**: Currently renders `<JoinPage>` placeholder. Phase 3 replaces this with the full `<GameScreen>` component that handles all phases.
- **Zustand store extension**: Add fields for `ws` (WebSocket instance), `myAnswer` (number | null), `roundResult` (RoundResultEvent['data'] | null), `gameEndResult` (GameEndEvent['data'] | null). Add actions for WebSocket lifecycle and event handling.

## Specific Ideas

No external references or "make it like X" examples were mentioned. All design direction comes from `web_design.md` and `gdd.md`. Standard React + Motion patterns expected.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 3-Player Frontend*
*Context gathered: 2026-06-10*
