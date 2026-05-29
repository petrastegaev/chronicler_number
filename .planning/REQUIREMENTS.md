# Requirements: Дуэль чисел (Number Duel)

**Defined:** 2026-05-28
**Core Value:** Two conference attendees walk up, enter nicknames, and are playing within seconds — a smooth, impressive booth experience that draws a crowd.

## v1 Requirements

Requirements for the Saint Highload 2026 booth. Each maps to roadmap phases.

### Player Connection & Lobby

- [ ] **JOIN-01**: Player navigates to `/` and sees a nickname input field (max 15 chars) with a "Присоединиться" button
- [ ] **JOIN-02**: Server assigns roles in order of connection — first player gets "Игрок 1", second gets "Игрок 2"
- [ ] **JOIN-03**: After submitting nickname, player sees "Ожидание соперника..." until the second player joins
- [ ] **JOIN-04**: When both players are ready, both screens show "Ожидание запуска администратором"
- [ ] **JOIN-05**: Player nickname is stored in server memory and preserved on WebSocket reconnect via session cookie

### Core Game Loop

- [ ] **GAME-01**: Admin starts the game; both players see "Раунд 1 / 9" and the first question
- [ ] **GAME-02**: Each round has a 10-second server-authoritative countdown timer broadcast via WebSocket `timer_tick` events every second
- [ ] **GAME-03**: Player enters an integer answer (0–1,000,000) in an input field; answer auto-submitted on timer expiry
- [ ] **GAME-04**: Player answers are NOT broadcast to the opponent mid-round (prevents cheating)
- [ ] **GAME-05**: After timer expires, server computes round winner by absolute difference to correct answer and broadcasts `round_result`
- [ ] **GAME-06**: Players see: correct answer, own answer, opponent's answer, and winner indicator (blue/red highlight) for 2–3 seconds
- [ ] **GAME-07**: 9 random questions drawn without replacement from the question pool per game session
- [ ] **GAME-08**: Round winner gets 1 point; ties split 0 points each
- [ ] **GAME-09**: After 9 rounds, `game_end` event sent with final scores and winner announcement (or "Ничья")
- [ ] **GAME-10**: End-of-game screen shows final score, winner nickname (or draw), and waits for admin reset

### Admin Panel — Game Control

- [ ] **ADMIN-01**: Admin connects via WebSocket with role "admin" (no nickname required)
- [ ] **ADMIN-02**: Admin sees both player slots with nicknames, online/offline status indicators, and ready state
- [ ] **ADMIN-03**: "Запустить игру" button is disabled until both players are connected and ready
- [ ] **ADMIN-04**: During game, admin sees: current round number, live score for both players
- [ ] **ADMIN-05**: "Рестарт" button available at any time — destroys current session, returns players to lobby state
- [ ] **ADMIN-06**: Admin panel layout is mobile-first (portrait, 375px+ width) with touch-friendly controls (min 44x44pt tap targets)
- [ ] **ADMIN-07**: Bottom tab navigation with tabs: "Игра" and "Вопросы"

### Question Management

- [ ] **QUEST-01**: Admin can view all questions in a paginated table via the "Вопросы" tab
- [ ] **QUEST-02**: Admin can add a single question via form: text (required), answer (required, integer 0–1,000,000), category (optional)
- [ ] **QUEST-03**: Admin can delete individual questions from the list
- [ ] **QUEST-04**: Admin can import questions from a CSV file (format: `text,answer[,category]`)
- [ ] **QUEST-05**: CSV import shows preview of first 5 rows before confirming the upload
- [ ] **QUEST-06**: CSV import returns count of successfully added questions and list of errors for invalid rows
- [ ] **QUEST-07**: Question pool must have at least 9 questions for a game to start

### Sound Effects

- [ ] **AUDIO-01**: `tick` sound plays on each `timer_tick` event when remaining time > 3 seconds
- [ ] **AUDIO-02**: `tick_fast` sound (higher pitch/faster) plays when remaining time <= 3 seconds
- [ ] **AUDIO-03**: `end_round` sound (gong/bell) plays on `round_result` event
- [ ] **AUDIO-04**: `winner` sound (fanfare) plays on `game_end` event
- [ ] **AUDIO-05**: AudioContext is unlocked on first user interaction (nickname submit button) to comply with mobile browser autoplay policies
- [ ] **AUDIO-06**: All audio files are bundled locally in the Docker image — no external CDN

### Statistics

- [ ] **STAT-01**: Admin can view total count of games played (persisted to SQLite)

### Deployment

- [x] **DEPLOY-01**: Full application starts with a single `docker compose up` command
- [x] **DEPLOY-02**: Application works fully offline — no internet connectivity required at runtime
- [ ] **DEPLOY-03**: All static assets (React build, sounds, fonts, icons) served by FastAPI via StaticFiles
- [x] **DEPLOY-04**: Players connect via local WiFi at `http://<server-ip>:8000/`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Features

- **ENH-01**: Reconnection grace period — if a player disconnects mid-game, their slot is held for 30 seconds for automatic rejoin
- **ENH-02**: Visual circular countdown timer (SVG ring with stroke-dashoffset animation synced to server ticks)
- **ENH-03**: Configurable game settings (round count, timer duration) via admin panel
- **ENH-04**: Hall of fame — optional display of recent winners at the booth (physical sticky note alternative preferred)
- **ENH-05**: Player win/loss/ties history tracked by nickname in SQLite

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent user accounts / OAuth login | Conference booth throughput priority — every extra field loses attendees |
| Tournament bracket mode | Only 2 screens and 1 laptop — single game, winner gets prize, next pair steps up |
| Player-driven "Play Again" button | Winners would monopolize booth — admin controls queue flow |
| Online / remote play | Designed for local LAN — internet adds latency, auth, and deployment complexity |
| Live cross-game leaderboard | Privacy concerns, state management overhead, creates pressure for new players |
| Multiple-choice question format | Dilutes the numeric-answer differentiator — "closest wins" is the hook |
| Custom background music | Licensing issues, complicates audio cues — use only 4 defined sound effects |
| Prize integration / auto-award | Legal/compliance complexity — booth staff handles prizes manually |
| Player chat / emoji reactions | Game lasts ~90 seconds — no time for chat, moderation overhead |
| WebRTC video of opponent | Players sit opposite each other — they can already see each other |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| JOIN-01 | Phase 3 | Pending |
| JOIN-02 | Phase 2 | Pending |
| JOIN-03 | Phase 3 | Pending |
| JOIN-04 | Phase 3 | Pending |
| JOIN-05 | Phase 2 | Pending |
| GAME-01 | Phase 3 | Pending |
| GAME-02 | Phase 2 | Pending |
| GAME-03 | Phase 3 | Pending |
| GAME-04 | Phase 2 | Pending |
| GAME-05 | Phase 2 | Pending |
| GAME-06 | Phase 3 | Pending |
| GAME-07 | Phase 2 | Pending |
| GAME-08 | Phase 2 | Pending |
| GAME-09 | Phase 2 | Pending |
| GAME-10 | Phase 3 | Pending |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| ADMIN-04 | Phase 4 | Pending |
| ADMIN-05 | Phase 4 | Pending |
| ADMIN-06 | Phase 4 | Pending |
| ADMIN-07 | Phase 4 | Pending |
| QUEST-01 | Phase 4 | Pending |
| QUEST-02 | Phase 4 | Pending |
| QUEST-03 | Phase 4 | Pending |
| QUEST-04 | Phase 4 | Pending |
| QUEST-05 | Phase 4 | Pending |
| QUEST-06 | Phase 4 | Pending |
| QUEST-07 | Phase 4 | Pending |
| AUDIO-01 | Phase 5 | Pending |
| AUDIO-02 | Phase 5 | Pending |
| AUDIO-03 | Phase 5 | Pending |
| AUDIO-04 | Phase 5 | Pending |
| AUDIO-05 | Phase 5 | Pending |
| AUDIO-06 | Phase 5 | Pending |
| STAT-01 | Phase 4 | Pending |
| DEPLOY-01 | Phase 1 | Complete |
| DEPLOY-02 | Phase 1 | Completed (01-01) |
| DEPLOY-03 | Phase 1 | Pending |
| DEPLOY-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40 (roadmap complete)
- Unmapped: 0

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-28 after roadmap creation*
