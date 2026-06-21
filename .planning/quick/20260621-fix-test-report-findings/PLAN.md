---
description: "Fix remaining bugs from TEST-REPORT-2026-06-21.md (6 of 13 already fixed by prior commits)"
created: 2026-06-21
status: complete
---

# Plan: Fix remaining test report findings

## Context

TEST-REPORT-2026-06-21.md found 13 bugs. 7 were already fixed by prior commits:
- ✅ BUG-RECONN (bb72b7f: removed `remove_token()` from disconnect)
- ✅ BUG-ADMIN-HEARTBEAT (consequence of BUG-RECONN fix)
- ✅ BUG-UNKNOWN-ROLE (bb72b7f: else branches for unknown role)
- ✅ BUG-NICKNAME-NULL (bb72b7f: snapshot nicknames at `run()` start)
- ✅ BUG-WHITESPACE-TEXT (b89fbac: validator strips + checks in schemas.py)
- ✅ BUG-FAVICON (c28db8b: favicon.svg added to public/)
- ✅ BUG-FONT (c28db8b: font permissions fixed in Dockerfile)

6 bugs remain:

## Remaining bugs

| # | Bug | Severity | Location | Root cause |
|---|-----|----------|----------|------------|
| 1 | BUG-STALE-TOKEN-LOOP | P0 | `frontend/src/hooks/useWebSocket.ts:155-158`, `useAdminWebSocket.ts:122-128` | No localStorage clearing on "Недействительный токен" error |
| 2 | BUG-CROSS-TAB-TOKEN | P1 | `frontend/src/hooks/useWebSocket.ts:58,202`, `useAdminWebSocket.ts:59,189` | localStorage shared across browser tabs |
| 3 | BUG-PLAYER-JOINED-FIELD | P2 | `backend/main.py:312-314` | Sends only `player2_nickname` to player 1, missing `player_number` |
| 4 | BUG-PAGINATION | P3 | `backend/routers/questions.py:17` | Parameter named `skip` not `offset` |
| 5 | API-MISSING-ENDPOINT | P3 | `backend/routers/stats.py` | No `/api/stats/recent-games` endpoint |
| 6 | API-FILTER-PARAMS | P3 | `backend/routers/questions.py:15-24` | No `category`/`text` query filters on list endpoint |

## Fix plan

### Fix 1: BUG-STALE-TOKEN-LOOP — Очищать невалидный токен
**Files:** `frontend/src/hooks/useWebSocket.ts`, `frontend/src/hooks/useAdminWebSocket.ts`

В обоих хуках в обработчике ошибки `"Недействительный токен"` удалять токен из localStorage:
```typescript
if (errorData.message?.includes('Недействительный токен')) {
    try { localStorage.removeItem('ws_reconnect_token_player') } catch {}
}
```

### Fix 2: BUG-CROSS-TAB-TOKEN — sessionStorage вместо localStorage
**Files:** `frontend/src/hooks/useWebSocket.ts`, `frontend/src/hooks/useAdminWebSocket.ts`

Заменить `localStorage` на `sessionStorage` для ключей `ws_reconnect_token_player` и `ws_reconnect_token_admin` (sessionStorage изолирован на вкладку).

### Fix 3: BUG-PLAYER-JOINED-FIELD — Добавить `player_number` в событие
**File:** `backend/main.py:312-314`

Добавить поле `player_number: 2` в `player_joined` событие, отправляемое игроку 1 при подключении игрока 2. Фронтенд-код продолжит работать (он использует `player2_nickname`).

### Fix 4: BUG-PAGINATION — Переименовать `skip` → `offset`
**File:** `backend/routers/questions.py:17`

Переименовать параметр `skip: int = 0` → `offset: int = 0`. Проверить, что QuestionService.get_all тоже использует/принимает offset.

### Fix 5: API-MISSING-ENDPOINT — Добавить `/api/stats/recent-games`
**File:** `backend/routers/stats.py`

Добавить эндпоинт `GET /api/stats/recent-games`, возвращающий последние N игр с базовой информацией (никнеймы, счёт, победитель, дата).

### Fix 6: API-FILTER-PARAMS — Добавить фильтры в list questions
**File:** `backend/routers/questions.py`

Добавить опциональные query-параметры `category: str | None` и `text: str | None` для фильтрации списка вопросов.

## Execution order

1. Fix 1 (STALE-TOKEN-LOOP) — critical, 2 files
2. Fix 2 (CROSS-TAB-TOKEN) — same files as fix 1, do together
3. Fix 3 (PLAYER-JOINED-FIELD) — 1-line backend fix
4. Fix 4 (PAGINATION) — rename parameter
5. Fix 5 (recent-games endpoint) — new endpoint
6. Fix 6 (filter params) — extend existing endpoint

Commits: Fixes 1-2 together (both frontend localStorage changes), then 3-4 together (backend small fixes), then 5-6 together (new API features).
