# Phase 4: Admin Panel + Question Management - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

## Phase Boundary

Admin controls the game lifecycle and manages questions from a phone-optimized mobile interface. This phase delivers the full admin experience — WebSocket-based game control (start, restart, live score tracking), REST-based question CRUD (paginated list, add single, delete, CSV import with preview), and game statistics display.

**Requirements:** ADMIN-01 through ADMIN-07, QUEST-01 through QUEST-07, STAT-01 — 15 total

## Implementation Decisions

### Navigation & Layout
- **D-01:** Sub-tabs (Список | Добавить | CSV) within the Вопросы bottom tab. The bottom tab bar has two main tabs: "Игра" (game control) and "Вопросы" (question management). Вопросы has a horizontal sub-tab bar for its 3 sub-modes.
- **D-02:** Список (list) is the default sub-tab when entering the Вопросы tab. The other sub-tabs (Добавить, CSV) are secondary actions.
- **D-03:** Question count badge shown on the Список sub-tab label (e.g., "Список (42)"). Admin sees at a glance whether enough questions exist for a game (minimum 9).

### Admin State Management
- **D-04:** Separate `adminStore.ts` — does NOT extend `gameStore`. Clean separation: admin never imports player-specific fields like `myAnswer` or `submittedAnswer`. The admin store tracks: player connection status, game phase, scores, current round; question list with pagination cursor; CSV import result; game stats.
- **D-05:** Separate `useAdminWebSocket.ts` hook — does NOT extend `useWebSocket`. Handles admin-specific events (start_game, restart) and dispatches game state updates to adminStore. Listens for all game broadcast events (round_started, score_update, game_end, game_reset) and routes them to adminStore.
- **D-06:** Cache question list in adminStore with explicit refresh after mutations (add, delete, CSV import). No refetch on tab switch — only refetch after add/delete/import operations.

### Question Deletion
- **D-07:** Inline delete button (trash icon) per row with confirmation dialog ("Удалить вопрос?"). Cancel/confirm buttons in the dialog.
- **D-08:** Toast notification "Вопрос удалён" after successful deletion, auto-dismissed after ~3 seconds. Deleted row animates out of the list.

### CSV Import
- **D-09:** Backend-only validation. All rows are validated on the server at `POST /api/questions/upload-csv`. Frontend parses first 5 rows for preview display only — no client-side validation.
- **D-10:** Frontend reads the file, parses 5 rows via `FileReader`, displays them as a preview table. User confirms, then frontend uploads the file as multipart/form-data.
- **D-11:** Inline result card replaces the preview area after server response. Shows: "✅ Успешно добавлено: N" and if errors exist: "❌ Ошибки:" with the list. Card persists until admin navigates away or starts another import.
- **D-12:** Plain error strings in the response `errors` array: `["Строка 3: Ответ не является целым числом", "Строка 7: Пустой текст вопроса"]`. Frontend displays them directly with no structured parsing.

### Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Game Design & Admin Spec
- `gdd.md` §6 — Admin panel full specification: game control, question management, statistics
- `gdd.md` §7.2 — REST API for question management (endpoints, CSV upload contract)
- `gdd.md` §7.4 — Timer synchronization (admin receives timer_tick too)
- `gdd.md` §9.2 — CSV backend support (python-multipart, csv module, validation)
- `web_design.md` §3.3 — Admin panel layouts and screen states
- `web_design.md` §4 — Visual style: color scheme, typography, touch target specs (44x44pt)

### Phase 2 Locked Decisions (prior context)
- `.planning/phases/02-core-game-loop/02-CONTEXT.md` — D-01 through D-17: timer protocol, state machine, event payloads, round flow, answer handling, admin event routing (D-14: start_game; D-17: score_update to admin). ALL DECISIONS ARE LOCKED.

### Phase 3 Frontend Patterns (prior context)
- `.planning/phases/03-player-frontend/03-CONTEXT.md` — D-12: single-screen architecture pattern; D-13: crossfade transitions; Zustand store pattern; useWebSocket hook pattern; Tailwind theme tokens.

### Project-Wide
- `CLAUDE.md` — Stack constraints (React 19, Vite 6, Tailwind CSS v4, Motion v12, Zustand v5, TypeScript 5.x)
- `.planning/ROADMAP.md` — Phase 4 goal, 11 success criteria, dependency on Phase 2 + Phase 3
- `.planning/REQUIREMENTS.md` — ADMIN-01 through ADMIN-07, QUEST-01 through QUEST-07, STAT-01 full text

## Existing Code Insights

### Reusable Assets
- **`backend/connection_manager.py`** — `ConnectionManager` singleton with `admin` WebSocket slot, `send_to_admin()`, `player1_nickname`/`player2_nickname` properties. Also tracks player WebSocket presence (online/offline). Admin store can derive player status from `player1 is not None` and `player2 is not None`.
- **`backend/main.py:183-218`** — Existing admin WebSocket event dispatch loop: `start_game` (validates nicknames, checks question pool ≥ 9, creates GameSession, launches asyncio.create_task) and `restart` (calls reset_game). Phase 4 does NOT need to change this dispatch — it works. Admin disconnect cancels game_task (line 227-231).
- **`backend/services/question_service.py`** — `get_all(db, skip, limit)`, `get_by_id(db, id)`, `create(db, text, answer, category)`, `delete(db, id)`, `random_selection(db, count)`. All async, all tested. CSV import will extend this service.
- **`backend/routers/questions.py`** — REST router at `/api/questions` with GET (list, paginated via skip/limit), GET by id, POST (create), DELETE. Phase 4 adds `POST /api/questions/upload-csv`.
- **`backend/schemas.py`** — `QuestionCreate` (text, answer, category?), `QuestionResponse` (id, text, answer, category, created_at). CSV import needs a new schema: `CsvImportResponse`.
- **`backend/models.py`** — `Stat` model with `game_count` column. Need a REST endpoint or service method to read it.
- **`frontend/src/types/ws.ts`** — All game event TypeScript interfaces already defined. Admin-specific events to add to the type union: `StartGame`, `Restart`. Server→admin events already typed: `ScoreUpdateEvent`, `GameStartedEvent`, `RoundStartedEvent`, `RoundResultEvent`, `GameEndEvent`, `GameResetEvent`, `StateSnapshotEvent`.
- **`frontend/src/stores/gameStore.ts`** — Zustand pattern reference (create, selectors, actions). AdminStore follows the same pattern but with admin-specific fields.
- **`frontend/src/hooks/useWebSocket.ts`** — WebSocket connection + event dispatch pattern. Use the same architecture but for admin role: connect → send `{event: "join", data: {role: "admin"}}` → dispatch events to adminStore.
- **`frontend/src/index.css`** — Tailwind CSS v4 theme with all needed tokens: `--color-wb-bg`, `--color-wb-surface`, `--color-wb-text`, `--color-wb-text-muted`, `--color-player1`, `--color-player2`, `--color-correct`, `--color-warning`, `--color-danger`. Inter fonts self-hosted.
- **`frontend/src/App.tsx`** / **`frontend/src/main.tsx`** — React Router with route `/admin` rendering `<AdminPage>`. Phase 4 replaces the AdminPage placeholder with full admin UI.

### Established Patterns
- **Server-authoritative architecture**: Client is a thin display + control terminal. Admin sends commands (start_game, restart) via WebSocket; all game logic runs on server. Never compute game state locally.
- **REST for CRUD, WebSocket for real-time**: Question management uses REST (`/api/questions`); game events use WebSocket. Admin uses BOTH — REST for questions, WebSocket for game control.
- **Zustand for state management**: Selector-based re-renders. State accessible outside React tree for WebSocket message handler. Admin store follows the same pattern.
- **Russian-language UI**: All user-facing text in Russian per PROJECT.md constraint.
- **Tailwind utility-first**: No CSS modules — all styling via Tailwind classes and theme tokens.
- **Motion for animations**: Import from `"motion/react"`. Used for tab transitions, toast appearance, row removal animation.

### Integration Points
- **WebSocket at `/ws`**: Admin connects with `{event: "join", data: {role: "admin"}}`. Server handles start_game and restart. Admin receives all broadcast events.
- **REST at `/api/questions`**: Existing GET (list, paginated), POST (create), DELETE. Phase 4 adds `POST /api/questions/upload-csv` (multipart/form-data) and likely `GET /api/stats`.
- **Route at `/admin`**: Currently renders `<AdminPage>` placeholder. Phase 4 replaces this with the full admin panel: bottom tab bar (Игра | Вопросы), game control content, question management with sub-tabs.
- **session token**: Admin also gets a session token on join (from main.py:145) — supports reconnect.

## Specific Ideas

No external references or "make it like X" examples were mentioned. Standard React + Zustand + Tailwind patterns expected. The GDD and web_design.md are the primary design references.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 4-Admin Panel + Question Management*
*Context gathered: 2026-06-10*
