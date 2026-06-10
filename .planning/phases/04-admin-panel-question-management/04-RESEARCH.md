# Phase 4: Admin Panel + Question Management - Research

**Researched:** 2026-06-10
**Domain:** Admin mobile UI, WebSocket game control, REST CRUD for questions, CSV import with preview
**Confidence:** HIGH

## Summary

The admin panel is a mobile-first React SPA (375px+ portrait) at `/admin` with two bottom tabs: "Игра" (game control via WebSocket) and "Вопросы" (question management via REST). All backend infrastructure already exists — the WebSocket endpoint dispatches `start_game` and `restart` events, `ConnectionManager` tracks player presence, and the Questions REST API has GET/POST/DELETE. Phase 4 adds a CSV upload endpoint (`POST /api/questions/upload-csv`), a stats endpoint (`GET /api/stats`), and replaces the `<AdminPage>` placeholder with the full admin UI.

**Primary recommendation:** Build the admin as two independent subsystems in one page — a `useAdminWebSocket` hook (separate from `useWebSocket`) for real-time game control using Zustand's `adminStore`, and direct `fetch()` calls to the REST API for question management. No new npm packages are needed — `python-multipart` (for CSV upload) is already in requirements.txt. The existing `react-router` v7 route at `/admin` is ready to render the full panel.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Game lifecycle control (start, restart) | API / Backend | Browser / Client | Admin sends WebSocket commands; server authoritatively runs the game. Client is just a control terminal. |
| Player presence display (online/offline, ready) | API / Backend | Browser / Client | `ConnectionManager` tracks WebSocket connections. AdminStore derives status from join/disconnect events streamed via WebSocket. |
| Live score + round display | Browser / Client | API / Backend | Server broadcasts `round_started`, `score_update`, `timer_tick` to admin. Client renders them. |
| Question CRUD (list, add, delete) | API / Backend | Browser / Client | REST API at `/api/questions` handles all CRUD. Clients are thin fetch/displays. |
| CSV upload with preview | Browser / Client | API / Backend | Client reads file locally for preview (first 5 rows via FileReader). Server validates and imports all rows via `POST /api/questions/upload-csv`. |
| CSV validation + error reporting | API / Backend | — | Per D-09: backend-only validation. Frontend displays server-returned errors as-is. |
| Statistics (game count) | API / Backend | Browser / Client | REST endpoint `GET /api/stats` reads `Stat.game_count` from SQLite. |

## Standard Stack

No new packages needed. All dependencies are already in requirements.txt and package.json.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.136.x | HTTP + WebSocket server | Already in project. Phase 4 adds one REST endpoint. |
| uvicorn | 0.48.x | ASGI server | Already in project. No changes needed. |
| React | 19.x | Admin panel UI | Already in project. Phase 4 replaces AdminPage placeholder. |
| react-router | 7.x | Routing | Already in project. Route at `/admin` is ready. |
| zustand | 5.x | Admin state management | Already in project. Phase 4 creates `adminStore.ts`. |
| motion | 12.x | Animations | Already in project. Used for tab transitions, toast, row removal. |
| Tailwind CSS | 4.3.x | Styling | Already in project. All theme tokens are defined in index.css. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-multipart | 0.0.x | CSV file upload in FastAPI | Required by FastAPI `UploadFile`. Already in requirements.txt. |
| csv (stdlib) | — | CSV parsing | Python stdlib. Parse uploaded CSV rows, validate answer is integer. |

### Alternatives Considered
No alternatives considered — all decision items in CONTEXT.md call for using the existing stack.

**Installation:**
None required. All dependencies are already installed and locked.

## Package Legitimacy Audit

> All packages used in this phase are already in the project. No new packages are introduced.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| python-multipart | PyPI | Established (years) | github.com/andrew-d/python-multipart | [OK] | Approved (already in requirements.txt) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────┐     WebSocket (/ws)     ┌──────────────────────────────┐
│   Admin Browser       │ ◄──────────────────────► │   FastAPI Backend            │
│   (375px+ portrait)   │                          │                              │
│                       │  ── join {role:"admin"}  │   ConnectionManager          │
│   ┌────────────────┐  │  ◄── joined (token)      │   ├── player1 (WebSocket)    │
│   │  adminStore.ts │  │                          │   ├── player2 (WebSocket)    │
│   │  (Zustand)     │  │  ── start_game           │   └── admin (WebSocket)      │
│   │                │  │  ◄── game_started        │                              │
│   │ playerStatus   │  │  ◄── round_started       │   GameSession (singleton)    │
│   │ scores         │  │  ◄── timer_tick          │   ├── State machine          │
│   │ currentRound   │  │  ◄── score_update        │   ├── Timer (asyncio.sleep)  │
│   │ phase          │  │  ◄── round_result        │   ├── Scoring                │
│   │ questions      │  │  ◄── game_end            │   └── DB persistence         │
│   │ csvResult      │  │  ◄── game_reset          │                              │
│   │ gameCount      │  │  ── restart              │   QuestionService            │
│   └────────────────┘  │                          │   ├── get_all (paginated)    │
│                        │     REST (/api/...)      │   ├── create                 │
│                        │ ──────────────────────► │   ├── delete                 │
│                        │  GET /api/questions      │   ├── random_selection       │
│                        │  POST /api/questions     │   └── csv_import (NEW)       │
│                        │  DELETE /api/questions/  │                              │
│                        │  POST /api/questions/    │   Database                   │
│                        │      upload-csv (NEW)    │   ├── questions              │
│                        │  GET /api/stats (NEW)    │   ├── game_sessions          │
│                        │                          │   ├── rounds                 │
│                        │                          │   └── stats                  │
└───────────────────────┘                          └──────────────────────────────┘
```

**Data flow for game start (primary use case):**
1. Admin connects WebSocket at `/ws`, sends `{event: "join", data: {role: "admin"}}`
2. Server replies `{event: "joined", data: {role: "admin", token: "..."}}`
3. AdminStore initializes with phase: "waiting". ConnectionManager has player1/player2 presence.
4. When both players connected, AdminStore derives `canStart: true` from non-null nicknames in store.
5. Admin taps "Запустить игру" -> sends `{event: "start_game"}` over WebSocket
6. Server validates question pool >= 9, creates GameSession, starts game loop
7. Server broadcasts `game_started` -> AdminStore updates phase to "playing", shows player nicknames
8. Per round: server broadcasts `round_started`, `timer_tick` x11, `round_result`, `score_update` (admin-only)
9. After 9 rounds: server broadcasts `game_end` -> AdminStore updates to "finished"
10. Admin taps "Рестарт" -> sends `{event: "restart"}` -> server broadcasts `game_reset`

**Data flow for CSV import:**
1. Admin selects CSV file via `<input type="file" accept=".csv" />`
2. FileReader.readAsText() -> parse first 5 rows -> display preview table
3. Admin confirms -> fetch POST /api/questions/upload-csv with FormData
4. Server validates all rows (answer is int 0-1M, text non-empty), returns `{added: N, errors: ["error", ...]}`
5. Client replaces preview with result card showing success count and error list
6. AdminStore flushes cached question list (refetch on next tab switch)

### Recommended Project Structure

This phase only adds files, modifies existing files, or replaces the AdminPage placeholder:

```
backend/
├── routers/
│   ├── questions.py      # MODIFIED: add POST /api/questions/upload-csv
│   └── stats.py          # NEW: GET /api/stats
├── services/
│   └── question_service.py  # MODIFIED: add csv_import static method
├── schemas.py            # MODIFIED: add CsvImportResponse, StatsResponse
└── main.py               # MODIFIED: register stats router

frontend/src/
├── pages/
│   └── AdminPage.tsx     # REPLACED: from placeholder to full admin panel
├── stores/
│   └── adminStore.ts     # NEW: Zustand store for admin state (D-04)
├── hooks/
│   └── useAdminWebSocket.ts  # NEW: admin WebSocket hook (D-05)
├── components/
│   ├── admin/
│   │   ├── GameControlTab.tsx    # NEW: "Игра" tab content
│   │   ├── PlayerSlot.tsx        # NEW: player card with status
│   │   ├── QuestionListTab.tsx   # NEW: paginated question table
│   │   ├── QuestionAddTab.tsx    # NEW: single question form
│   │   ├── CsvImportTab.tsx      # NEW: CSV upload with preview
│   │   └── GameStats.tsx         # NEW: statistics display
│   └── ...existing components unchanged
└── types/
    └── ws.ts             # MODIFIED: add admin-specific event types if missing
```

### Pattern 1: Separate Admin Store and WebSocket Hook (D-04, D-05)

**What:** Admin uses its own Zustand store (`adminStore.ts`) and its own WebSocket hook (`useAdminWebSocket.ts`). This is not an extension of `gameStore` — admin never touches player-specific fields like `myAnswer`.

**When to use:** Always. This is a locked decision.

**Example pattern for adminStore:**
```typescript
// Source: CONTEXT.md D-04, D-05 — locked pattern from existing gameStore.ts
interface AdminState {
  phase: 'connecting' | 'waiting' | 'lobby' | 'playing' | 'showing_result' | 'finished'
  player1Nickname: string
  player2Nickname: string
  player1Online: boolean
  player2Online: boolean
  player1Score: number
  player2Score: number
  currentRound: number
  totalRounds: number
  // Question management
  questions: Question[]
  totalQuestions: number
  csvResult: { added: number; errors: string[] } | null
  gameCount: number
  // WebSocket ref
  ws: WebSocket | null
}
```

### Pattern 2: REST API Endpoint for CSV Upload (D-09, D-10, D-11, D-12)

**What:** Single endpoint `POST /api/questions/upload-csv` accepts multipart/form-data, validates all rows server-side, returns structured result. Frontend parses first 5 rows via FileReader for preview only.

**When to use:** For CSV import flow. Backend owns all validation.

**Example backend pattern:**
```python
# Source: FastAPI official docs + GDD §9.2
@router.post("/upload-csv", response_model=CsvImportResponse)
async def upload_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    reader = csv.reader(io.StringIO(content.decode("utf-8")))
    added = 0
    errors = []
    for row_num, row in enumerate(reader, start=1):
        if not row or len(row) < 2:
            errors.append(f"Строка {row_num}: недостаточно полей")
            continue
        text = row[0].strip()
        answer_str = row[1].strip()
        category = row[2].strip() if len(row) > 2 else None
        if not text:
            errors.append(f"Строка {row_num}: Пустой текст вопроса")
            continue
        try:
            answer = int(answer_str)
        except ValueError:
            errors.append(f"Строка {row_num}: Ответ не является целым числом")
            continue
        if not (0 <= answer <= 1_000_000):
            errors.append(f"Строка {row_num}: Ответ вне диапазона (0-1 000 000)")
            continue
        # Category validation (optional, max 255 chars)
        if category and len(category) > 255:
            errors.append(f"Строка {row_num}: Категория слишком длинная")
            continue
        await QuestionService.create(db, text=text, answer=answer, category=category)
        added += 1
    return CsvImportResponse(added=added, errors=errors)
```

**Example frontend preview pattern:**
```typescript
// Source: D-10 — client reads 5 rows for preview, server validates
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => {
    const text = event.target?.result as string
    const lines = text.split('\n').filter(Boolean).slice(0, 5)
    const parsed = lines.map(line => {
      const parts = line.split(',')
      return { text: parts[0], answer: parts[1], category: parts[2] || '' }
    })
    setPreviewRows(parsed)
    setSelectedFile(file)
  }
  reader.readAsText(file)
}
```

### Anti-Patterns to Avoid

- **Sharing gameStore for admin state:** Admin must never touch `myAnswer` or `submittedAnswer` fields. A separate `adminStore` avoids confusion and prevents state pollution. This is locked by D-04.
- **Reusing useWebSocket hook for admin:** The admin hook sends different events (start_game, restart vs submit_answer) and handles different server events. Separate hook per D-05.
- **Browser-side CSV validation that rejects something server would accept:** Per D-09, all validation is server-side. Frontend preview is display-only. Never reject a file client-side.
- **Refetching question list on every tab switch:** Per D-06, only refetch after mutations (add, delete, CSV import). Tab switches use cached data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV file upload handling | Manual multipart parsing | FastAPI `UploadFile` + `python-multipart` | FastAPI handles streaming, spooling, validation. Already in dependencies. |
| CSV row parsing | Custom CSV parser | Python `csv` module (stdlib) | Handles quoting, escaped commas, newlines in fields. Already available. |
| Bottom tab navigation | Custom swipe/tap manager | React state + Tailwind flex layout | Two tabs with simple state toggle. No library needed. 33 lines of code. |
| Toast notifications | Custom toast system | Zustand store + motion `AnimatePresence` | Toast is a single UI pattern confirmed in decision context. Use project's existing motion dependency. |
| Confirmation dialog | `window.confirm()` | Inline modal component in React | Per web_design.md: no system dialogs. Use a small modal with AnimatePresence. |

**Key insight:** This phase is about wiring existing infrastructure together and adding one new REST endpoint. The complexity is in the frontend component tree (nested tabs, sub-tabs, preview, result cards), not in new service logic.

## Runtime State Inventory

> Phase 4 does NOT involve renames, refactors, or migrations. Code/config-only additions.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no data rename. CSV import creates new records in `questions` table. | None |
| Live service config | None — no external services. | None |
| OS-registered state | None — no OS registrations. | None |
| Secrets/env vars | None — no env vars touched. | None |
| Build artifacts | None — no rename. | None |

**Nothing found in category:** All categories verified. This is a greenfield addition phase.

## Common Pitfalls

### Pitfall 1: Admin sees stale player status after restart
**What goes wrong:** After admin clicks "Рестарт", the server broadcasts `game_reset` and kicks players back to lobby. But `ConnectionManager` still holds player WebSocket references — players are not disconnected. The admin UI might clear player slots or show them as offline.
**Why it happens:** The reset_game() function sets `active_session = None` and cancels the task, but does NOT clear player nicknames or WebSocket slots. Players remain connected; they just need to wait for admin to start again.
**How to avoid:** In the adminStore, on receiving `game_reset`, set `phase: 'lobby'` but keep `player1Nickname`, `player2Nickname`, `player1Online`, `player2Online` intact. Only clear scores and currentRound. The players are still connected; only the game session was destroyed.
**Warning signs:** Admin sees empty player slots or "offline" status after restarting a game that had both players connected.

### Pitfall 2: SCSS/module import pattern not matching project convention
**What goes wrong:** Importing a `.module.css` or `styled-components` breaks the project's Tailwind-only convention.
**Why it happens:** The admin panel is a new, large component tree. A developer accustomed to CSS modules might reach for them instead of Tailwind utilities.
**How to avoid:** Use only Tailwind utility classes. All theme tokens are in index.css (`--color-wb-bg`, `--color-player1`, etc.). Reference existing components like `JoinScreen.tsx` and `GameScreen.tsx` for styling patterns.
**Warning signs:** A file ending in `.module.css` or `styled.` appears in the PR.

### Pitfall 3: WebSocket message parsing race between adminStore and gameStore
**What goes wrong:** Both `adminStore` and `gameStore` are Zustand stores. If the admin page somehow also instantiates `useWebSocket`, both hooks would process messages from the same WebSocket, leading to duplicate state updates.
**Why it happens:** The admin should only connect via `useAdminWebSocket`. If the admin panel renders a child component that calls `useWebSocket()`, two hooks will parse the same `onmessage` stream.
**How to avoid:** `useAdminWebSocket` owns the WebSocket reference in `adminStore`. No child component in the admin panel should call `useWebSocket()`. The AdminPage creates the WebSocket once; all child components read from `adminStore`.
**Warning signs:** Console warning about double event handling or conflicting state updates.

### Pitfall 4: CSV file re-read after user confirmation loses the content
**What goes wrong:** The frontend reads the CSV via FileReader for preview, then on confirm tries to read the file again for upload — but the file input's value is cleared or the File object is consumed.
**Why it happens:** `FileReader.readAsText()` does not consume the file — the `File` object can be read multiple times. But if the input element is reset or the file reference is lost, re-reading fails.
**How to avoid:** Store the `File` object in component state (or useRef) when the user selects a file. Pass it to the upload function directly. Do not rely on reading from the DOM input element on confirm.
**Warning signs:** Upload succeeds but sends an empty file, or the preview works but confirm upload sends 0 bytes.

## Code Examples

Verified patterns from official sources and existing codebase:

### Admin WebSocket Connection (useAdminWebSocket pattern)
```typescript
// Source: CONTEXT.md D-05, based on existing useWebSocket.ts established pattern
import { useCallback, useEffect, useRef } from 'react'
import { useAdminStore } from '../stores/adminStore'
import type { WsMessage } from '../types/ws'

export function useAdminWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const intentionalCloseRef = useRef(false)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws
    const store = useAdminStore.getState()

    ws.onopen = () => {
      useAdminStore.setState({ ws })
      ws.send(JSON.stringify({
        event: 'join',
        data: { role: 'admin' }
      }))
    }

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data)
      const s = useAdminStore.getState()

      switch (msg.event) {
        case 'joined': {
          useAdminStore.setState({
            phase: 'lobby',
            ws,
          })
          // Notify parent components via token
          const data = msg.data as { token?: string }
          useAdminStore.setState({ token: data.token ?? null })
          break
        }
        case 'game_started': {
          const data = msg.data as { player1_nickname: string; player2_nickname: string }
          useAdminStore.setState({
            phase: 'playing',
            player1Nickname: data.player1_nickname,
            player2Nickname: data.player2_nickname,
          })
          break
        }
        case 'round_started': {
          const data = msg.data as { round_number: number; total_rounds: number }
          useAdminStore.setState({
            phase: 'playing',
            currentRound: data.round_number,
            totalRounds: data.total_rounds,
          })
          break
        }
        case 'score_update': {
          const data = msg.data as { player1_score: number; player2_score: number; round_number: number }
          useAdminStore.setState({
            player1Score: data.player1_score,
            player2Score: data.player2_score,
          })
          break
        }
        case 'game_end': {
          useAdminStore.setState({ phase: 'finished' })
          break
        }
        case 'game_reset': {
          useAdminStore.setState({
            phase: 'lobby',
            player1Score: 0,
            player2Score: 0,
            currentRound: 0,
          })
          break
        }
        default: break
      }
    }

    ws.onclose = () => {
      if (!intentionalCloseRef.current) {
        useAdminStore.setState({ ws: null, phase: 'connecting' })
      }
    }
  }, [])

  const startGame = useCallback(() => {
    useAdminStore.getState().ws?.send(JSON.stringify({
      event: 'start_game',
      data: {}
    }))
  }, [])

  const restart = useCallback(() => {
    useAdminStore.getState().ws?.send(JSON.stringify({
      event: 'restart',
      data: {}
    }))
  }, [])

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true
      wsRef.current?.close()
    }
  }, [])

  return { connect, startGame, restart }
}
```

### CSV Import Response Schema (backend)
```python
# Source: FastAPI official docs + GDD §7.2 — new schema for CSV upload response
class CsvImportResponse(BaseModel):
    added: int
    errors: list[str]

class StatsResponse(BaseModel):
    game_count: int
```

### CSV Import Backend Service Method
```python
# Source: D-09 (backend-only validation) + python csv module docs
@staticmethod
async def csv_import(db: AsyncSession, file_content: bytes) -> dict:
    import csv, io
    reader = csv.reader(io.StringIO(file_content.decode("utf-8")))
    added = 0
    errors = []
    for row_num, row in enumerate(reader, start=1):
        if not row or len(row) < 2:
            errors.append(f"Строка {row_num}: недостаточно полей")
            continue
        text = row[0].strip()
        if not text:
            errors.append(f"Строка {row_num}: Пустой текст вопроса")
            continue
        try:
            answer = int(row[1].strip())
        except ValueError:
            errors.append(f"Строка {row_num}: Ответ не является целым числом")
            continue
        if not (0 <= answer <= 1_000_000):
            errors.append(f"Строка {row_num}: Ответ вне диапазона (0-1 000 000)")
            continue
        category = row[2].strip() if len(row) > 2 and row[2].strip() else None
        await QuestionService.create(db, text=text, answer=answer, category=category)
        added += 1
    return {"added": added, "errors": errors}
```

### Admin WebSocket disconnect handling
```python
# Source: backend/main.py:226-231 — existing pattern, unchanged by Phase 4
# Admin disconnect cancels game_task to prevent orphan game loops
except WebSocketDisconnect:
    # ...
    elif manager.admin == websocket:
        manager.admin = None
        if game_task is not None and not game_task.done():
            game_task.cancel()
            game_task = None
            active_session = None
```

## State of the Art

No significant changes in the stack since Phase 1 research. All libraries are current within their active support windows.

**Deprecated/outdated:**
- Nothing relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ConnectionManager` does not track `player1_ready` / `player2_ready` flags — readiness is determined by `player1_nickname` and `player2_nickname` being non-None | Context Insights | ADMIN-02 requires "ready state" display. If Phase 3 added a separate ready confirmation (not just nickname entry), admin needs to know about it. Verified: Phase 3/2 code and CONTEXT.md show no ready flag. JOYN-04 says "both players ready" is when both have submitted nicknames. `player_count == 2` is readiness. |
| A2 | Admin does not need a session token for REST API calls | Architecture | If the admin REST endpoints (question CRUD) were behind authentication, admin would need a token header. Currently there is no auth on REST endpoints. If added later, the CSV upload endpoint would break. |
| A3 | The `game_reset` event broadcast from server destroys the session but keeps player WebSocket connections alive | Pitfalls | Verified: `reset_game()` sets `active_session = None` and cancels `game_task`, but does NOT clear `player1`/`player2` WebSocket slots. Players remain connected. |

**If this table is empty:** One assumption listed above that should be validated during planning.

## Open Questions

1. **Question: Does the backend need a dedicated `GET /api/stats` endpoint, or can the admin query this alongside question list?**
   - What we know: `Stat` model has `game_count` column. Existing code reads it in `_persist_game()`. No read endpoint exists.
   - What's unclear: The CONTEXT.md says admin needs "total game count" but doesn't specify the endpoint. The GDD says "кнопка Статистика" showing game count.
   - Recommendation: Create a simple `GET /api/stats` endpoint that reads the first `Stat` row and returns `{game_count: N}`. Register in a new `backend/routers/stats.py` router. Simple enough to be uncontentious.

2. **Question: Should the question list pagination be client-side or server-side?**
   - What we know: `GET /api/questions/` already supports `skip` and `limit` query params. The admin needs a paginated table.
   - What's unclear: How many questions are expected (GDD says pool minimum 60). Server-side pagination is better for performance.
   - Recommendation: Use server-side pagination via the existing `skip`/`limit` params. Admin passes `?skip=0&limit=20` and gets a page. Frontend tracks page cursor in adminStore. Add a `total` count to the response so frontend knows page count.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.13+ | Backend (FastAPI) | Yes | 3.13.13 | — |
| FastAPI | CSV upload endpoint | Yes | 0.136.1 | — |
| python-multipart | File upload parsing | Yes | 0.0.29 | — |
| sqlalchemy + aiosqlite | DB queries | Yes | 2.0.49 / 0.20.0 | — |
| Node.js 20+ | Frontend build | Yes | 20.20.2 | — |
| React + zustand | Admin UI | Yes | via package.json | — |

**Missing dependencies with no fallback:** None — all dependencies are available.

## Validation Architecture

> Skipped as configured: `workflow.nyquist_validation: false` in .planning/config.json.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | FastAPI Pydantic models on all REST endpoints; CSV server-side validation |
| V12 File Uploads | yes | CSV upload via `UploadFile` with server-side content validation |

### Known Threat Patterns for FastAPI + React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSV injection / formula injection | Tampering | Backend does not open CSV in spreadsheet — only parses with csv module. No additional mitigation needed. |
| Large file upload DoS | Denial of Service | FastAPI `UploadFile` uses spooled temp files (disk-based after ~1MB). For a booth app with local WiFi, no explicit file size limit needed, but add a comment noting it. |
| XSS via question text | Spoofing | React renders text content as strings (not dangerouslySetInnerHTML). Pydantic validates max_length=500. Low risk for a local-only app. |

## Sources

### Primary (HIGH confidence)
- [CONTEXT.md] — Phase 4 locked decisions D-01 through D-12
- [Existing codebase] — backend/main.py, connection_manager.py, game/session.py, schemas.py, models.py, frontend types/stores/hooks
- [CLAUDE.md] — Stack constraints, version matrix, WebSocket protocol pattern
- [GDD.md] — Full admin spec section 6, REST API section 7.2, CSV spec section 9.2
- [web_design.md] — Admin panel layout section 3.3, touch target spec 44x44pt

### Secondary (MEDIUM confidence)
- [FastAPI official docs - Request Files] — UploadFile, python-multipart requirement
- [Python csv module docs] — csv.reader pattern, encoding handling

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in use, no new dependencies
- Architecture: HIGH — patterns well-established in existing code (Zustand store, WebSocket hook, REST router, async service)
- Pitfalls: HIGH — all derived from actual codebase patterns and CONTEXT.md decisions

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days — stable stack)
