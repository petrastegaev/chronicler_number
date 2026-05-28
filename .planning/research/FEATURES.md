# Feature Research

**Domain:** Local multiplayer numeric-quiz game for conference booth
**Researched:** 2026-05-28
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Nickname entry with uniqueness check | Players want identity, even temporary. No login = nicknames are the only handle. | LOW | Max 15 chars, server validates uniqueness, reject duplicates or auto-suffix. |
| Real-time round gameplay (question + answer) | Core loop. Both players see the same question, enter a number, see timer. | MEDIUM | WebSocket-driven. Server pushes question+state, clients render and submit. No "submit" button needed -- auto-capture on entry or on timeout. |
| Per-round result screen | Players need to know who won the round, what the correct answer was, and the gap. | LOW | 2-3 second overlay after each round. Show: correct answer, both answers, winner highlight, delta. |
| Final results / winner announcement | Closure. Players expect a screen declaring the winner (or tie) with final score. | LOW | Large typography, winner highlight, score summary for both. |
| Admin game lifecycle control (start, observe, reset) | Booth staff need to manage the queue. Players cannot self-start. | MEDIUM | Admin sees both players connected + ready, then can launch. During game: round counter, live scores. After: reset button to clear state. |
| Countdown timer per round (10 seconds) | Creates tension. Without a hard deadline, rounds drag and booth throughput suffers. | MEDIUM | Server-authoritative timer. Server broadcasts `timer_tick` events every second. Client renders progress bar + digits. <3s visual/audio urgency. |
| Both-player readiness gate | Game cannot start until both players have confirmed nicknames and are connected. | LOW | Server tracks ready state. Admin sees status indicators for each player slot. Start button disabled until both ready. |
| Admin sees player connection status | Admin needs to know if a player dropped and whether to wait or reset. | LOW | Green/red indicator per player slot in admin panel. |
| Questions loaded from a pool (no repeats within a game) | Players expect variety across rounds and games. | LOW | Server draws N=9 random questions from pool without replacement per game session. |
| Admin question management (add single, list, delete) | Conference staff need to load questions specific to their domain. | MEDIUM | REST endpoints: POST, GET, DELETE. Admin UI: table list with pagination, add form, delete button per row. |
| Full offline operation | Conference WiFi is unreliable. Game must work on local LAN with zero internet dependencies. | MEDIUM | All assets (fonts, sounds, icons) bundled in Docker image. No CDN, no external API calls, no analytics beacons. Static files served by FastAPI. |
| Admin controls from mobile phone | Booth staff stand and walk around. They need a phone-optimized admin UI, not a laptop. | MEDIUM | Responsive React layout for mobile portrait (375px+). Touch-friendly controls (44x44pt minimum tap targets). Bottom tab navigation. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Numeric "closest wins" mechanic** | Core differentiator vs every Kahoot-style multiple choice quiz at other booths. Players guess a number, not pick A/B/C/D. Scoring by proximity creates dramatic near-misses and upsets that draw a crowd. | MEDIUM | Absolute difference scoring. Exact answer = bonus spectacle. Patent US7654533 covers this mechanic -- but purely as a game method patent that does not apply to our non-commercial/non-licensed use case (legal check advised). |
| **Sound effects (tick, fast tick, gong, fanfare)** | Transforms a silent web form into a game-show experience. Audio draws crowd attention from across the expo hall. | MEDIUM | Four sound files, bundled locally. Howler.js or Web Audio API for reliable playback. AudioContext must be unlocked on first user interaction (nickname button). Fast tick at <=3s creates urgency. |
| **Admin-driven quick reset for fast player turnover** | Booth staff control the queue pace. One tap clears scores, returns to lobby, and new players can join immediately. Critical for throughput during rush hours. | LOW | Reset destroys current GameSession. Players' nickname inputs remain, but they must click "ready" again. Admin sees the lobby state immediately after reset. |
| **CSV question import** | Lets conference staff bulk-load questions without SQL knowledge or manual entry of 60+ rows. | MEDIUM | Backend parses CSV (text,answer,category). Preview first 5 rows before confirming. Returns added count and error list. Requires python-multipart + csv module. |
| **Visual circular countdown timer** | More dramatic than a numeric readout. The shrinking ring creates a visceral sense of urgency, especially when it changes color at <3s. | MEDIUM | SVG circle with stroke-dashoffset animation synced to server timer events. Color transition from blue -> yellow -> red. Coordinates with audio ticks. |
| **Player color identity (blue vs red)** | Two players sitting opposite each other with distinct visual identities improves the "duel" feel. Color coding on round results makes winner obvious at a glance. | LOW | Player 1 = blue (#3B82F6), Player 2 = red/orange (#EF4444). Applied to borders, score badges, row highlights on result screen. |
| **Server-authoritative timer (no cheating)** | Prevents network latency advantage or clock manipulation. One player with a fast connection doesn't get more time. | MEDIUM | Server broadcasts remaining seconds. Clients render, never calculate. Answers after timer expiry are discarded server-side. |
| **Nickname re-association on WebSocket reconnect** | Conference WiFi is unreliable. If a player's browser tab drops and reconnects, their nickname and slot should restore automatically. | MEDIUM | Session cookie set on first HTTP request, sent on WS upgrade. Server maps session ID to role+name. On disconnect, preserves slot for ~30s grace period. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Persistent user accounts / OAuth login | "Capture leads with email and company name." | Conference booth is about throughput. Every extra field before play loses attendees. The booth staff should collect leads verbally or via badge scan while players wait. | Nickname-only entry. Booth staff uses a separate lead capture process (badge scanner, paper). |
| Tournament bracket mode | "Multiple pairs compete, brackets fill up." | Booth has two screens and one laptop. Tournament requires tracking multiple concurrent games, scheduling, and an elimination tree. Overkill for a booth game where the queue is self-managing. | Single-game mode. Players play one match, winner gets a prize, next pair steps up. Simpler, faster, no scheduling overhead. |
| Player-driven "Play Again" button | "Let winners challenge again." | Winners would monopolize the booth. The admin needs to cycle through the queue, not let the same pair replay. | Admin-controlled reset. Players do not get a self-service replay option. Booth staff decides who plays next. |
| Online / remote play (multi-location) | "Let remote attendees play." | Game is designed for local LAN. Adding internet connectivity introduces latency, auth, security, and deployment complexity. Dilutes the booth experience. | Keep offline-only. Remote attendees can watch booth livestream. The game is a physical booth attraction. |
| Live leaderboard across all games | "See who has the highest score today." | Creates pressure for new players seeing unbeatable scores. Adds state management for all-time stats across server restarts. Privacy: players may not want their nickname displayed. | Keep stats minimal (game count only). Consider an optional "hall of fame" sticky note board at the booth as a physical alternative. |
| Multiple-choice questions as alternative | "Staff might want to use standard quiz formats." | Dilutes the numeric-answer differentiator. Changes scoring logic, UI, and backend. Adds complexity for zero competitive advantage. | Stick strictly to numeric answers. The "closest wins" mechanic is the hook. |
| Custom background music | "Let staff upload their own music." | Music file licensing, file size, playback complexity. Background music complicates the tick/fast-tick audio cues. | Use only the four defined sound effects. A quiet background lets the sounds pop. If music is needed, play it from a separate speaker, not through the game. |
| Prize integration (auto-select winner from DB) | "Automatically award prizes to high scorers." | Adds authentication, prize selection UI, legal/compliance complexity (GDPR, sweepstakes laws). Booth staff will handle prizes manually anyway. | Give a small prize to every winner immediately at the booth. No digital prize management needed. |
| Player chat / emoji reactions | "Let players taunt each other." | Opens moderation issues, UI clutter, and misuse potential. The game lasts 90 seconds -- there's no time for chat. | Let the round results speak for themselves. The booth atmosphere handles the social dimension. |
| WebRTC video of opponent | "Show opponent's reaction." | Adds camera permissions, bandwidth, UI complexity, privacy concerns. Two players are sitting opposite each other -- they can see each other directly. | Physical proximity is the feature, not a limitation. The booth layout already has players facing each other. |

## Feature Dependencies

```
[Nickname Entry]
    └──requires──> [WebSocket Connection]
                       └──requires──> [Server Running]

[Admin Game Start]
    └──requires──> [Both Players Ready]
                       └──requires──> [Nickname Entry]

[Round Gameplay]
    └──requires──> [Admin Game Start]
    └──requires──> [Timer Engine (Server)]
    └──requires──> [Question Pool with >= 9 questions]
                       └──requires──> [Question Management (add)]

[Round Result]
    └──requires──> [Round Gameplay]
                       └──requires──> [Both Players Submitted OR Timer Expired]

[Sound Effects]
    └──enhances──> [Round Gameplay]
    └──enhances──> [Round Result]
    └──enhances──> [Game End]
    └──requires──> [User Interaction (AudioContext unlock)]

[CSV Import]
    └──enhances──> [Question Management (bulk add)]

[Admin Quick Reset]
    └──requires──> [Game End OR Admin-initiated mid-game abort]
    └──requires──> [GameSession teardown]

[Reconnection]
    └──requires──> [Session Cookie on First HTTP Request]
    └──requires──> [Server-side Session Store (in-memory)]
    └──conflicts──> [Admin Quick Reset] (reset destroys session mappings)

[Visual Circular Timer]
    └──enhances──> [Round Gameplay]
    └──requires──> [Server `timer_tick` events]
```

### Dependency Notes

- **Round Gameplay requires Question Pool with >= 9 questions:** The game cannot start if fewer than 9 unique questions exist. The admin must add questions before launch. Consider enforcing this check on game start and showing an error in admin panel.
- **Sound Effects requires User Interaction:** Browsers block autoplay audio. The AudioContext must be created/resumed inside a click/tap handler (the "Join" button). This is a one-time unlock per session.
- **Reconnection conflicts with Admin Quick Reset:** If the admin resets the game while a player is disconnected, the session mapping is destroyed. On reconnect, the player becomes a new guest. This is acceptable -- the reset means a new game anyway.
- **Admin Quick Reset requires GameSession teardown:** The reset action must cleanly destroy the current WebSocket room, clear player assignments, and return both clients to the lobby state. Partial cleanup causes ghost state.
- **CSV Import enhances Question Management:** The single-question-add must work first (as the foundation). CSV import is a convenience layer on top.
- **Visual Circular Timer requires server `timer_tick` events:** The animation is driven by server-pushed time updates, not a client clock. This ensures all devices show the same remaining time regardless of latency.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept at the conference booth.

- [x] **Nickname entry** -- Players identify themselves. Both must be ready before game starts.
- [x] **9-round numeric question gameplay** -- Server-authoritative rounds, 10-second timer, numeric input.
- [x] **Server-authoritative timer** -- Timer ticks broadcast via WebSocket. Answers after expiry discarded.
- [x] **Proximity scoring** -- Closest answer wins each round. Most round wins takes the game. Correct absolute diff displayed.
- [x] **Per-round result display** -- Correct answer, both players' answers, winner highlight, 2-3s display.
- [x] **Final results screen** -- Winner announcement, final score, player nicknames.
- [x] **Admin game control (desktop-accessible)** -- See player status, start game, view live round/scores, reset. Mobile-optimized is a v1.x goal, but must be accessible on a phone viewport.
- [x] **Single question add via admin** -- Form to add question text + numeric answer + optional category.
- [x] **Question pool of at least 9 seeded questions** -- Pre-seeded with enough questions to validate the loop.
- [x] **Docker Compose one-command deploy** -- Booth staff runs `docker compose up` and everything works.
- [x] **Fully offline** -- All assets local. No external requests.

### Add After Validation (v1.x)

Features to add once core is working and booth testing reveals needs.

- [ ] **Sound effects** -- Tick, fast tick (<=3s), round-end gong, victory fanfare. Validate the game is fun without sound first, then add audio as the polish layer.
- [ ] **Mobile-optimized admin panel** -- Responsive layout, bottom tabs, touch-friendly controls. Essential for booth staff who stand and walk.
- [ ] **CSV question import** -- Bulk question loading for conference staff. Lets them customize questions for their domain without manual entry of 60+ rows.
- [ ] **Visual circular timer** -- Animated SVG countdown with color transitions. Adds drama but is visual polish on top of working timer logic.
- [ ] **Nickname reconnection** -- Session-based recovery for dropped WebSocket connections. Conference WiFi is unreliable. Observe if disconnections are a real problem before spending effort here.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Admin statistics (game count only as designed)** -- Simple counter of completed games. Low complexity but adds DB query. Only needed if booth staff ask for it.
- [ ] **Hall of fame / top scores storage** -- Persistent score tracking across games. Introduces privacy consideration (nicknames visible). Only if the conference explicitly wants this for lead generation.
- [ ] **Configurable round count** -- Let admin choose 5, 7, or 9 rounds. Adds settings UI and state complexity. The 9-round default is well-tested.
- [ ] **Question categories / difficulty levels** -- Tag questions and ensure balanced distribution per game. Adds DB schema and selection logic. Only if question pool grows beyond 100+.
- [ ] **Dark mode toggle** -- The design spec specifies a dark theme as default. A toggle adds CSS variable overhead with no real value for a booth game.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Nickname entry | HIGH | LOW | P1 |
| Round gameplay (question + answer + timer) | HIGH | MEDIUM | P1 |
| Server-authoritative timer | HIGH | MEDIUM | P1 |
| Proximity scoring | HIGH | MEDIUM | P1 |
| Per-round result display | HIGH | LOW | P1 |
| Final results screen | HIGH | LOW | P1 |
| Admin game start/observe/reset | HIGH | MEDIUM | P1 |
| Question pool seeding (>=9 questions) | HIGH | LOW | P1 |
| Single question add (admin form) | MEDIUM | LOW | P1 |
| Question list/delete (admin) | MEDIUM | LOW | P1 |
| Docker Compose deploy | HIGH | MEDIUM | P1 |
| Full offline operation | HIGH | MEDIUM | P1 |
| Sound effects | MEDIUM | MEDIUM | P2 |
| Mobile-optimized admin panel | HIGH | MEDIUM | P2 |
| CSV question import | MEDIUM | MEDIUM | P2 |
| Visual circular timer | LOW | MEDIUM | P2 |
| Nickname reconnection | MEDIUM | MEDIUM | P2 |
| Admin game count stats | LOW | LOW | P3 |
| Hall of fame | LOW | MEDIUM | P3 |
| Configurable round count | LOW | LOW | P3 |
| Question categories | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (without this, the game does not work or players cannot play)
- P2: Should have, add after core validation (polish and convenience)
- P3: Nice to have, future consideration (nice, but not the reason people come to the booth)

## Competitor Feature Analysis

| Feature | Kahoot! (Classroom) | Quizizz (Classroom) | Our Approach |
|---------|---------------------|---------------------|--------------|
| Question type | Multiple choice, true/false, puzzle | Multiple choice, fill-in, open-ended, match | **Numeric answer only** -- proximity-based scoring, not binary right/wrong |
| Player identity | Nickname from shared lobby | Nickname or Google account | **Nickname only** -- no auth, no persistence |
| Scoring | Points per correct answer (speed bonus) | Points per correct answer (speed bonus) | **Proximity scoring** -- closer wins, speed not a factor |
| Round structure | Teacher-paced, variable questions | Self-paced or live, variable | **Fixed 9 rounds**, admin-paced |
| Timer | Per-question countdown (configurable) | Per-question countdown (configurable) | **Fixed 10-second timer** -- all rounds same, designed for booth throughput |
| Sound effects | Music + sound effects (game show) | Memes, GIFs, sound effects | **4 targeted sounds** -- tick, fast tick, gong, fanfare. No background music. |
| Admin control | Shared screen projection, teacher controls | Teacher dashboard via web | **Dedicated admin panel on phone** -- designed for booth staff workflow |
| Audience | 50+ players simultaneously | 50+ players simultaneously | **Exactly 2 players + 1 admin** -- 1v1 duel format |
| Deployment | Cloud SaaS | Cloud SaaS | **Docker Compose, fully offline** -- no internet, no accounts, no external services |
| Player reconnection | Not designed for (mobile browser refresh = lost) | Partial (account-based) | **Session-based reconnection** -- designed for flaky conference WiFi |
| Lead capture | Not relevant (classroom use) | Not relevant (classroom use) | **No digital lead capture** -- booth staff handles this verbally/with badge scanner |
| Prize integration | None | None | **None digital** -- physical prizes at the booth |

## Sources

- **Kahoot! and Quizizz feature comparison** -- multiple sources (Software Advice, TriviaMaker, ClassPlus, Jotform). HIGH confidence.
- **Conference booth game best practices** -- Freeman, Classic Exhibits, Booth Exhibits, Expo Centric, TOTM Exposition. HIGH confidence (industry standard practices).
- **Conference booth game mistakes** -- EventX Games, Whova, Game Developer, SocialPoint, RainFocus. MEDIUM-HIGH confidence (practitioner knowledge, consistent across sources).
- **Numeric "closest wins" mechanic** -- US Patents 20070246888A1 and 7654533B2 (game method patents); Approx app (iOS); "Closest Intuition" quiz app. HIGH confidence (patent documents and live applications).
- **WebSocket reconnection patterns** -- GitHub issues on Colyseus, NestJS/Socket.IO, custom implementations. MEDIUM confidence (patterns are consistent but sourced from issue discussions, not official standards).
- **Postmortem lessons from conference booth games** -- Shehu Dev blog (conference booth endurance game). MEDIUM confidence (single source but detailed lessons learned).
- **Project design documents** -- `gdd.md` and `web_design.md` in project root. HIGH confidence (these are the approved plans).

---
*Feature research for: Number Duel (Duel Chisel) -- local 1v1 numeric quiz for conference booth*
*Researched: 2026-05-28*
