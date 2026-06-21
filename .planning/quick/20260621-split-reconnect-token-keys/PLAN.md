---
task: split-ws-reconnect-token-localstorage-key
status: planned
created: 2026-06-21
---

## Problem

`ws_reconnect_token` — один ключ localStorage для admin и player. Когда admin-токен остаётся
после сессии админа, player page (`/`) пытается переподключиться с ним → сервер возвращает
«Недействительный токен» → фронтенд редиректит на `/admin`.

## Fix

Разделить ключи: `ws_reconnect_token_player` для игрока, `ws_reconnect_token_admin` для админа.

### Changes (2 files, 4 lines)

1. `frontend/src/hooks/useWebSocket.ts` — player hook
   - Строка 58: `'ws_reconnect_token'` → `'ws_reconnect_token_player'` (сохранение)
   - Строка 202: `'ws_reconnect_token'` → `'ws_reconnect_token_player'` (восстановление)

2. `frontend/src/hooks/useAdminWebSocket.ts` — admin hook
   - Строка 59: `'ws_reconnect_token'` → `'ws_reconnect_token_admin'` (сохранение)
   - Строка 189: `'ws_reconnect_token'` → `'ws_reconnect_token_admin'` (восстановление)

### Verification

- Открыть `/admin`, войти → admin token сохраняется в `ws_reconnect_token_admin`
- Открыть `/`, присоединиться как игрок → player token сохраняется в `ws_reconnect_token_player`
- После перезагрузки страницы `/` player не пытается использовать admin-токен
