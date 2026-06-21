---
status: complete
completed_at: 2026-06-21
---

# Summary: Fix remaining TEST-REPORT-2026-06-21.md findings

**6 bugs fixed** (7 were already fixed by prior commits bb72b7f, b89fbac, c28db8b, 9679435).

## Fixed

### P0: BUG-STALE-TOKEN-LOOP
Оба WebSocket хука теперь удаляют невалидный токен из sessionStorage при получении ошибки "Недействительный токен сессии", предотвращая бесконечный цикл переподключений.

### P1: BUG-CROSS-TAB-TOKEN
Ключи `ws_reconnect_token_player` и `ws_reconnect_token_admin` перенесены из `localStorage` в `sessionStorage`, что изолирует токены на вкладку браузера.

### P2: BUG-PLAYER-JOINED-FIELD
Событие `player_joined`, отправляемое игроку 1 при подключении игрока 2, теперь включает поле `player_number: 2` (в дополнение к `player2_nickname`).

### P3: BUG-PAGINATION
Параметр `skip` переименован в `offset` в `GET /api/questions/` для соответствия REST-конвенциям.

### P3: API-MISSING-ENDPOINT
Добавлен `GET /api/stats/recent-games?limit=10` с информацией о последних играх.

### P3: API-FILTER-PARAMS
В `GET /api/questions/` добавлены query-параметры `category` и `text` для фильтрации списка вопросов.

## Already fixed (prior commits)
- BUG-RECONN, BUG-ADMIN-HEARTBEAT, BUG-UNKNOWN-ROLE, BUG-NICKNAME-NULL, BUG-WHITESPACE-TEXT, BUG-FAVICON, BUG-FONT
