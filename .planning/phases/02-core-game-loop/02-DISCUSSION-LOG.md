# Phase 2: Core Game Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 2-Core Game Loop
**Areas discussed:** Timer Implementation, Game State Machine Design, WebSocket Event Protocol, Round Flow Timing

---

## Timer Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Server tick broadcast | Server sends timer_tick every 1s with remaining time. Most server-authoritative. | ✓ |
| End-timestamp only | Server sends round_start with end_timestamp once. Client counts down locally. | |
| Hybrid: timestamp + sync ticks | Server sends end_timestamp + periodic sync heartbeats. | |

**User's choice:** Server tick broadcast (Recommended)
**Notes:** Server-authoritative approach aligns with Phase 1 architecture. ~10 messages per round is acceptable traffic for local WiFi.

### Sub-decision: Fast tick handling

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side audio switch | Server continues 1/s ticks; client switches to tick_fast sound when remaining <= 3. | ✓ |
| Server-driven fast ticks | Server increases tick rate to ~333ms for last 3 seconds. | |
| Hybrid: urgency event | Server sends timer_urgent event at 3s remaining. | |

**User's choice:** Client-side audio switch (Recommended)
**Notes:** Simpler server logic. The audio change is a client-side presentation concern.

### Sub-decision: Answer submission

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-capture on expiry | Whatever is in the input field at timer expiry is captured. No submit required. | ✓ |
| Explicit submit required | Player must press submit before timer ends. | |
| Both: submit button + auto-capture | Can submit early or auto-capture at expiry. | |

**User's choice:** Auto-capture on expiry (Recommended)
**Notes:** Reduces player error from forgetting to submit. Answer is always captured.

### Sub-decision: Early answer handling

| Option | Description | Selected |
|--------|-------------|----------|
| Full 10s always | Timer continues for both players even if both answered. | ✓ |
| End round when both answer | If both submit early, round ends immediately. | |

**User's choice:** Full 10s always (Recommended)
**Notes:** Consistent pacing. Prevents players from inferring opponent's submission timing.

### Sub-decision: Server timer mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| asyncio.sleep(1) loop | Simple loop, negligible drift for 10s round. | ✓ |
| Monotonic clock calculation | Compute remaining = 10 - elapsed using time.monotonic(). | |

**User's choice:** asyncio.sleep(1) loop (Recommended)
**Notes:** Simplicity wins. Drift of 1-5ms/tick is invisible for this use case.

### Sub-decision: Mid-round disconnect

| Option | Description | Selected |
|--------|-------------|----------|
| Continue round on disconnect | Round proceeds. Reconnecting player gets state snapshot. | ✓ |
| Pause timer on disconnect | Timer pauses until both players are back. | |

**User's choice:** Continue round on disconnect (Recommended)
**Notes:** Prevents griefing. Disconnecting player can still rejoin and see results.

---

## Game State Machine Design

| Option | Description | Selected |
|--------|-------------|----------|
| Class-based GameSession | GameSession class with async run() via asyncio.create_task(). | ✓ |
| Inline in WebSocket handler | Game logic stays in /ws endpoint handler. | |
| Separate GameEngine service | Decoupled service with orchestrator. | |

**User's choice:** Class-based GameSession (Recommended)
**Notes:** Clean separation, testable, natural fit for asyncio.

### Sub-decision: State machine structure

| Option | Description | Selected |
|--------|-------------|----------|
| Linear state machine | Simple waiting → ready → in_progress → finished flow. | |
| Linear with round sub-states | presenting_question → accepting_answers → showing_result per round. | ✓ |

**User's choice:** Linear with round sub-states (Recommended)
**Notes:** More granular states give better control over what events are accepted at each phase.

### Sub-decision: Concurrent sessions

| Option | Description | Selected |
|--------|-------------|----------|
| Singleton GameSession | One game at a time. Global reference. | ✓ |
| Multiple sessions | Allow concurrent GameSession instances. | |

**User's choice:** Singleton GameSession (Recommended)
**Notes:** Conference booth has 2 screens — only one game can run at a time anyway. Simpler.

### Sub-decision: Admin restart behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Restart returns to lobby | Session destroyed. Both players return to waiting_for_players. | ✓ |
| Restart reuses connections | Same players, immediately ready. | |
| Two restart modes | Both "Новая игра" and "Реванш" buttons. | |

**User's choice:** Restart returns to lobby (Recommended)
**Notes:** Clean reset. In practice, players stay connected via WebSocket so the transition is instant.

---

## WebSocket Event Protocol

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit round_started event | Server sends round_started before ticks. Contains question and round number. | ✓ |
| Implicit: first tick = start | No separate event. First timer_tick starts the round. | |

**User's choice:** Explicit round_started event (Recommended)
**Notes:** Clear signal for client to transition UI to game state and display the question.

### Sub-decision: Answer submission protocol

| Option | Description | Selected |
|--------|-------------|----------|
| Single answer, first wins | First submit_answer locks in the answer. Subsequent ignored. | ✓ |
| Last answer wins | Player can change answer; last before expiry is used. | |

**User's choice:** Single answer, first wins (Recommended)
**Notes:** Prevents mid-round answer changes based on timer tension or accidental re-submissions.

### Sub-decision: round_result payload

| Option | Description | Selected |
|--------|-------------|----------|
| Same payload to both | Both players get identical round_result with both answers. | ✓ |
| Personalized per player | Each player gets "ваш ответ" vs "ответ соперника" labeling. | |

**User's choice:** Same payload to both (Recommended)
**Notes:** Simpler server, client-side logic handles highlighting own vs opponent's answer.

### Sub-decision: Admin start_game event

| Option | Description | Selected |
|--------|-------------|----------|
| Single start_game event | Admin sends {"event": "start_game"}. Server broadcasts game_started. | ✓ |
| start_game with metadata | Includes round count, player nicknames etc. upfront. | |

**User's choice:** Single start_game event (Recommended)
**Notes:** Minimal payload. Metadata belongs in the game_started broadcast response.

---

## Round Flow Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 3-second pause | Server sleeps 3s after round_result, then next round_started. | ✓ |
| Timestamp-driven | Server sends show_until_ms; clients display until then. | |
| Admin-controlled advance | Admin triggers each round advance. | |

**User's choice:** Fixed 3-second pause (Recommended)
**Notes:** Consistent, predictable pacing. Admin doesn't need to micromanage rounds.

### Sub-decision: game_end format

| Option | Description | Selected |
|--------|-------------|----------|
| Single game_end with full results | Final scores, winner, round-by-round summary in one event. | ✓ |
| Separate final_scores + game_end | Two events: scores first, then winner announcement. | |

**User's choice:** Single game_end with full results (Recommended)
**Notes:** One comprehensive event. Client can animate the reveal progressively from the same payload.

### Sub-decision: Round 9 to game_end timing

| Option | Description | Selected |
|--------|-------------|----------|
| Same 3s delay as rounds | Consistent rhythm with other round transitions. | ✓ |
| Longer dramatic pause | 5-6 seconds for dramatic tension. | |

**User's choice:** Same 3s delay as rounds (Recommended)
**Notes:** Consistent pacing. The game_end content itself provides the dramatic effect.

### Sub-decision: Admin event feed

| Option | Description | Selected |
|--------|-------------|----------|
| Same events + scores | Admin gets all ticks and results, plus score_update after each round. | ✓ |
| Results only, no ticks | Admin only gets round_result and game_end. | |

**User's choice:** Same events + scores (Recommended)
**Notes:** Admin panel shows live countdown and scores. Phase 4 (Admin Panel) needs these events for its UI.

---

## Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
