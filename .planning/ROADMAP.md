# ROADMAP: Дуэль чисел (Number Duel)

**Milestone:** v1.0 -- Saint Highload 2026 Booth
**Granularity:** Coarse (5 phases)
**Created:** 2026-05-28
**Core Value:** Two conference attendees walk up, enter nicknames, and are playing within seconds -- a smooth, impressive booth experience that draws a crowd with sound effects, timer tension, and instant results.

## Phases

- [x] **Phase 1: Foundation** (completed 2026-05-29) -- Backend infrastructure: FastAPI scaffold, SQLite WAL database, ConnectionManager, question service REST API, Docker Compose setup
- [x] **Phase 2: Core Game Loop** (completed 2026-06-10) -- Server-authoritative game state machine: GameSession, timer, proximity scoring, WebSocket game protocol, role assignment
- [ ] **Phase 3: Player Frontend** -- Complete player experience: JoinScreen, GameScreen, RoundResult overlay, FinalScreen, Zustand stores, WebSocket client
- [ ] **Phase 4: Admin Panel + Question Management** -- Mobile-first admin interface: game control, question CRUD, CSV import, game statistics
- [ ] **Phase 5: Audio + Deployment Polish** -- Sound effects engine, venue hardening, offline deployment verification

## Phase Details

### Phase 1: Foundation
**Goal**: The server boots, serves the React frontend via FastAPI StaticFiles, connects to SQLite with WAL mode, accepts WebSocket connections, and runs in Docker.
**Depends on**: Nothing (first phase)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts the server without errors
  2. Server is accessible at `http://localhost:8000/` and responds to HTTP requests
  3. WebSocket connections are accepted at the `/ws` endpoint
  4. SQLite database initializes with WAL mode (`PRAGMA journal_mode=WAL`) and required schema tables for questions and game statistics
  5. All static assets (React build, fonts, icons) are served locally without external CDN requests
**Plans**: 3 plans in 2 waves

Plans:
- [x] `01-01-PLAN.md` (Wave 1) -- Backend Core: database.py, models.py, schemas.py, requirements.txt, project structure
- [x] `01-02-PLAN.md` (Wave 1) -- Frontend Scaffold + Docker: Vite+React+TS project, Tailwind theme, Inter fonts, Docker multi-stage build
- [x] `01-03-PLAN.md` (Wave 2) -- WebSocket + REST API: ConnectionManager, QuestionService, questions router, main.py with lifespan + StaticFiles mount

### Phase 2: Core Game Loop
**Goal**: The game state machine drives 9 rounds of numeric gameplay with server-authoritative timer, proximity scoring, and WebSocket event broadcasts. Player connections are managed with role assignment and session persistence.
**Depends on**: Phase 1
**Requirements**: JOIN-02, JOIN-05, GAME-02, GAME-04, GAME-05, GAME-07, GAME-08, GAME-09
**Success Criteria** (what must be TRUE):
  1. Server assigns "Игрок 1" and "Игрок 2" roles to the first two WebSocket connections, "admin" to the third
  2. Server broadcasts `timer_tick` events every second during a round with remaining time; answers submitted after timer expiry are rejected server-side
  3. Player answers are NOT broadcast to the opponent mid-round (cheating prevention verified at protocol level)
  4. Server computes round winner by absolute difference to correct answer and broadcasts `round_result` with correct answer, both submitted answers, and winner indicator
  5. After 9 rounds (random questions drawn without replacement from the pool), `game_end` event broadcasts final scores, round win counts, and winner declaration (or "Ничья" for ties)
  6. Game results persist to SQLite at game end, incrementing the game count
  7. Player nickname is preserved on WebSocket reconnect via session cookie
**Plans**: 2 plans in 2 waves

Plans:
- [x] `02-01-PLAN.md` (Wave 1) -- Core Game Engine: GameSession state machine, timer, scoring, persistence; session token store for JOIN-05
- [x] `02-02-PLAN.md` (Wave 2) -- WebSocket Integration + Contracts: main.py event dispatch, GameSession lifecycle; frontend TS types and Zustand store

### Phase 3: Player Frontend
**Goal**: Two players can complete a full game -- join with nicknames, see questions, enter answers against a 10-second timer, view per-round results, and see final results on their respective devices.
**Depends on**: Phase 2
**Requirements**: JOIN-01, JOIN-03, JOIN-04, GAME-01, GAME-03, GAME-06, GAME-10
**Success Criteria** (what must be TRUE):
  1. Player navigates to `/` and sees a nickname input field (max 15 chars) with "Присоединиться" button
  2. After submitting nickname alone, player sees "Ожидание соперника..."; when second player joins, both see "Ожидание запуска администратором"
  3. When admin starts the game, both players simultaneously see "Раунд 1 / 9" with the question text and a 10-second countdown
  4. Player can enter an integer answer (0-1,000,000) via a numeric input field; answer auto-submits when the timer expires
  5. After timer expires, player sees round result overlay: correct answer, own answer, opponent's answer, and winner indicator (blue/red highlight) displayed for 2-3 seconds
  6. After 9 rounds, final screen shows final scores, winner nickname (or "Ничья" for draw), and waits for admin to restart
  7. Player nickname is preserved across WebSocket reconnection via session cookie
**Plans**: 2 plans in 2 waves

Plans:
- [ ] `03-01-PLAN.md` (Wave 1) -- Core UI: extended Zustand store, WebSocket hook, JoinScreen, WaitingScreen, PlayingScreen, TimerRing, AnswerInput, GameHeader, GameScreen
- [ ] `03-02-PLAN.md` (Wave 2) -- Result display: ResultOverlay, FinalScreen, ConnectionStatus, GameScreen wiring

### Phase 4: Admin Panel + Question Management
**Goal**: Admin controls the game lifecycle and manages questions from a phone-optimized mobile interface. Questions can be added individually or imported via CSV. Game statistics are visible.
**Depends on**: Phase 2, Phase 3
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, QUEST-01, QUEST-02, QUEST-03, QUEST-04, QUEST-05, QUEST-06, QUEST-07, STAT-01
**Success Criteria** (what must be TRUE):
  1. Admin connects via WebSocket with "admin" role and sees player slots with nicknames, online/offline status indicators, and ready state
  2. "Запустить игру" button is disabled until both players are connected and ready; becomes enabled when conditions are met
  3. During game, admin sees current round number and live score for both players
  4. "Рестарт" button (available at any time) destroys the current session and returns all players to lobby state
  5. Admin panel renders correctly at 375px+ portrait width with touch-friendly controls (minimum 44x44pt tap targets)
  6. Bottom tab navigation switches between "Игра" (game control) and "Вопросы" (question management)
  7. Admin can view all questions in a paginated table, add a single question via form (text, integer answer, optional category), and delete individual questions
  8. Admin can import questions from a CSV file (format: `text,answer[,category]`) with a preview of the first 5 rows before confirming upload
  9. CSV import reports count of successfully added questions and a list of errors for invalid rows
  10. Admin is warned if fewer than 9 questions exist in the pool when attempting to start a game
  11. Admin can view total game count (persisted to SQLite from Phase 2)
**Plans**: TBD (3 plans estimated)
**UI hint**: yes

### Phase 5: Audio + Deployment Polish
**Goal**: Sound effects transform the game into a game-show experience. Final deployment is verified on target hardware with fully offline operation.
**Depends on**: Phase 3, Phase 4
**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, AUDIO-05, AUDIO-06
**Success Criteria** (what must be TRUE):
  1. `tick` sound plays on each `timer_tick` event when remaining time is greater than 3 seconds
  2. `tick_fast` sound (higher pitch, faster cadence) plays when remaining time is 3 seconds or less
  3. `end_round` sound (gong/bell) plays when `round_result` event is received
  4. `winner` sound (fanfare) plays when `game_end` event is received
  5. AudioContext is unlocked on the first user interaction (nickname submit button), complying with mobile browser autoplay policies
  6. All four audio files are bundled in the Docker image -- zero external CDN requests verified via browser DevTools network tab
  7. Full `docker compose up` starts the complete application; fully functional offline with no internet connectivity (verified on a disconnected network)
**Plans**: TBD (2 plans estimated)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-05-29 |
| 2. Core Game Loop | 2/2 | Complete    | 2026-06-10 |
| 3. Player Frontend | 0/2 | Not started | - |
| 4. Admin Panel + Question Management | 0/3 | Not started | - |
| 5. Audio + Deployment Polish | 0/2 | Not started | - |

## Dependency Graph

```
Phase 1: Foundation
    |
    v
Phase 2: Core Game Loop
    |
    +----> Phase 3: Player Frontend
    |          |
    |          +----> Phase 4: Admin Panel + Question Management
    |                      |
    +----------------------+----> Phase 5: Audio + Deployment Polish
```

## Coverage Map

| Category | Total | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|----------|-------|---------|---------|---------|---------|---------|
| JOIN     | 5     | -       | 2       | 3       | -       | -       |
| GAME     | 10    | -       | 6       | 4       | -       | -       |
| ADMIN    | 7     | -       | -       | -       | 7       | -       |
| QUEST    | 7     | -       | -       | -       | 7       | -       |
| AUDIO    | 6     | -       | -       | -       | -       | 6       |
| STAT     | 1     | -       | -       | -       | 1       | -       |
| DEPLOY   | 4     | 4       | -       | -       | -       | -       |
| **Total**| **40**| **4**   | **8**   | **7**   | **15**  | **6**   |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Backend before frontend | Game loop must work at WebSocket level before UI is built; building player UI first would require mocking the server, risking protocol mismatches |
| Player frontend before admin | The player experience is the product. Admin panel is a control surface. Player screens need more UX iteration (timer readability, answer input, result clarity) |
| Audio deferred to last phase | Sound effects enhance a working game. The game must be fully playable and tested in silence before adding audio to avoid confounding variables during debugging |
| Questions in admin phase not foundation | Question CRUD requires admin UI to be usable. Backend API is built in Phase 1 but the full feature (UI + CSV import) ships in Phase 4 |
| DEPLOY mapped to Phase 1 | Docker infrastructure, offline static serving, and local WiFi access are established as the project foundation. Full feature verification happens across later phases |
