# Отчёт тестирования — Дуэль чисел

**Дата:** 2026-06-21  
**Версия:** post-ec5691b  
**Метод:** Рой агентов — 4 параллельных/последовательных тестировщика  
**Окружение:** Docker Compose, `localhost:8081`, 109 вопросов в БД

---

## 0. Итог одной строкой

Игровой цикл (9 раундов, подсчёт очков, сохранение в БД) работает корректно. **Функция переподключения (reconnect) полностью сломана** из-за удаления токена при разрыве WebSocket. Ещё два критичных дефекта: heartbeat-таймаут в 30с выбрасывает администратора с панели, и два шрифта не загружаются.

---

## 1. Сводная таблица

| Сценарий | Результат |
|----------|-----------|
| A. Полная игра — 9 раундов | ✅ PASS |
| B. Restart администратором | ✅ PASS |
| C. Reconnect игрока во время раунда | ❌ FAIL |
| D. Отключение администратора останавливает игру | ✅ PASS |
| E. Быстрая игра (все раунды, оба отвечают одинаково) | ✅ PASS |
| REST API — CRUD вопросов | ✅ PASS (1 баг) |
| REST API — CSV импорт | ✅ PASS |
| REST API — Auth | ✅ PASS |
| REST API — Stats | ✅ PASS |
| REST API — Leaderboard | ✅ PASS (неверный URL в спеке) |
| WS — Валидация никнейма (пустой, длинный, пробелы) | ✅ PASS |
| WS — Неверный admin_key | ✅ PASS |
| WS — Третий игрок | ✅ PASS |
| WS — Дублирующий админ | ✅ PASS |
| WS — Невалидный токен (свежее соединение) | ✅ PASS |
| Admin UI — Логин | ✅ PASS |
| Admin UI — Вкладки (Игра, Вопросы, Рекорды) | ✅ PASS |
| Admin UI — Добавить вопрос | ✅ PASS |
| Admin UI — CSV импорт через браузер | ✅ PASS |
| Admin UI — Таблица рекордов | ✅ PASS |
| Статические файлы (SPA fallback, /api 404) | ✅ PASS |
| Звуковые файлы (все 4) | ✅ PASS |
| Сохранение в SQLite | ✅ PASS (6 игр в БД) |
| Пагинация REST API | ⚠️ BUG (параметр `skip`, не `offset`) |

---

## 2. Критические баги (P0/P1)

### BUG-RECONN — Reconnect полностью не работает

**Серьёзность:** 🔴 P0 — функция заявлена, не работает

**Проявление:** Игрок обновляет страницу во время раунда → получает `{"event":"error","data":{"message":"Недействительный токен сессии"}}` вместо `joined` + `state_snapshot`.

**Корневая причина:**  
В обработчике `WebSocketDisconnect` (`backend/main.py:366-369`) вызывается `remove_token(token)`:
```python
except WebSocketDisconnect:
    token = getattr(websocket, '_reconnect_token', None)
    if token:
        remove_token(token)   # ← токен удаляется в момент разрыва
```
Когда клиент пытается переподключиться с этим токеном, `restore_from_token()` возвращает `None`, и сервер отправляет ошибку.

**Исправление:**  
Убрать вызов `remove_token(token)` из обработчика `WebSocketDisconnect`. Токены должны жить до TTL (1 час) или до явного сброса игры (`reset_game()`). Удалять токен только при `game_reset` или истечении TTL.

```python
# backend/main.py — убрать эти строки из WebSocketDisconnect:
# token = getattr(websocket, '_reconnect_token', None)
# if token:
#     remove_token(token)
```

---

### BUG-ADMIN-HEARTBEAT — Heartbeat 30s выбрасывает администратора

**Серьёзность:** 🔴 P0 — панель невозможно использовать дольше 30 секунд без активности

**Проявление (Playwright logs):**
```
[WS Admin] Heartbeat timeout — no message in 30s, reconnecting...
[WS Admin] Server error: Недействительный токен сессии
→ Перенаправление на страницу логина
```

**Корневая причина:** Та же, что в BUG-RECONN — heartbeat вызывает переподключение, которое закрывает старый WS, удаляет токен, и новое соединение не может восстановить сессию.

**Воздействие:** На конференции администратор подключается, настраивает, ждёт игроков (легко 1-2 минуты) → его выкидывает на логин → паника, прерывание процесса. **Критично для booth-сценария.**

**Исправление:** Исправление BUG-RECONN автоматически исправит этот баг. Дополнительно — увеличить heartbeat до 60-120s или отправлять пустой ping с сервера каждые 25s.

---

### BUG-FONT — Два шрифта не загружаются

**Серьёзность:** 🟠 P1 — визуальная деградация, SPA использует fallback шрифты

**Проявление (console logs):**
```
net::ERR_CONTENT_LENGTH_MISMATCH 200 (OK)
http://localhost:8081/fonts/CoFoSansPixel.otf
http://localhost:8081/fonts/CoFoSansRegular.otf
```

**Корневая причина:** Заголовок `Content-Length` не соответствует реальному размеру файла (несоответствие между размером при сборке Docker-образа и размером при отдаче). Браузер разрывает соединение после получения Content-Length байт.

**Исправление:** Пересобрать образ (`docker compose up --build`) или явно добавить `media_type=None` к StaticFiles mount чтобы не кэшировать Content-Length. Также проверить, что шрифты не повреждены в Docker layer.

---

## 3. Высокие баги (P2)

### BUG-UNKNOWN-ROLE — Соединение с неизвестной ролью зависает навечно

**Серьёзность:** 🟠 P1 — потенциальная утечка соединений

**Проявление:**
```python
ws.send({"event": "join", "data": {"role": "unknown_role"}})
# → нет ответа, соединение не закрывается
```
Ожидаемо: `{"event":"error"}` + закрытие соединения.

**Расположение:** `backend/main.py`, блок обработки join-события — нет ветки `else` для неизвестной роли.

**Риск:** Fuzzer или баг на клиенте могут накопить мёртвые соединения, занимающие память сервера.

---

### BUG-PLAYER-JOINED-FIELD — Неверное поле в событии `player_joined`

**Серьёзность:** 🟡 P2 — несоответствие контракта API и тест-плана

**Проявление:**
```
Ожидалось:  {"event":"player_joined","data":{"player_number":2}}
Получено:   {"event":"player_joined","data":{"player2_nickname":"ТестP2"}}
```
Тест-план JOIN-002 и WS-протокол (Приложение B) описывают `player_number`, а сервер шлёт `player2_nickname`. Если фронтенд ожидает `player_number` для определения слота — логика подключения сломана.

---

### BUG-NICKNAME-NULL — При дисконнекте игрока очищается никнейм

**Серьёзность:** 🟡 P2 — гонка при сохранении

**Проявление:** При разрыве WebSocket игрока (`WebSocketDisconnect`):
```python
manager.player1 = None
manager.player1_nickname = None   # ← очищается немедленно
```
`_persist_game` использует `self.manager.player1_nickname` — если дисконнект произошёл параллельно с `_finish_game`, в БД могут быть сохранены пустые никнеймы.

---

## 4. Средние баги (P3)

### BUG-PAGINATION — Параметр пагинации `skip`, а не `offset`

**Проявление:** `GET /api/questions/?limit=5&offset=5` → возвращает ту же первую страницу. Параметр называется `skip` в коде (`backend/routers/questions.py`). Стандартное REST-именование `offset` молча игнорируется.

**Исправление:** Переименовать параметр: `skip: int = 0` → `offset: int = 0`, или добавить алиас.

---

### BUG-WHITESPACE-TEXT — Вопрос с текстом из пробелов принимается

**Проявление:** `POST /api/questions/ {"text": "   ", "answer": 5}` → 201 Created. Такой вопрос попадёт в игру с пустым визуальным текстом.

**Исправление:** Добавить `.strip()` перед проверкой `min_length`.

---

### BUG-FAVICON — `/favicon.ico` возвращает SPA HTML

**Проявление:** `GET /favicon.ico` → 200, `text/html`, 434 байта (index.html). Браузер не может отобразить иконку вкладки.

**Исправление:** Добавить `favicon.ico` в `frontend/public/` и убедиться, что статика монтируется до SPA-fallback.

---

## 5. Спецификация vs реальность

| Элемент | Описание в спеке | Реальность |
|---------|-----------------|------------|
| Leaderboard URL | `/api/leaderboard/` | `/api/stats/leaderboard` |
| CSV response field | `imported` | `added` |
| `player_joined` payload | `player_number` | `player2_nickname` |
| Pagination param | `offset` | `skip` |
| Token TTL behaviour | Реконнект работает | Токен удаляется при disconnect |

---

## 6. Что работает хорошо

- **Полный 9-раундовый цикл** — все события доходят, таймер 11 тиков (10→0), пауза 3s между раундами
- **Алгоритм подсчёта очков** — proximity scoring корректен (включая ничью, timeout=null=Infinity)
- **game_end payload** — содержит никнеймы, счёт, winner, массив 9 раундов
- **Сохранение в SQLite** — 6 игр, 54 раунда, stats.game_count корректен
- **Admin restart** — все 3 клиента получают `game_cancelled` + `game_reset`
- **Admin disconnect** — игроки получают `game_cancelled`, игра отменяется
- **Защита от двойного старта** (`game_lock`)
- **Защита от двойного ответа** (`p1_answer is None`)
- **Валидация WS**: пустой/длинный никнейм, неверный ключ, 3-й игрок, дублирующий админ — все корректно отклоняются
- **CRUD вопросов** — add/list/delete работают
- **CSV импорт** — partial import с детальными ошибками по строкам
- **Admin UI** — логин, вкладки, форма добавления, CSV preview, leaderboard empty state
- **SPA routing** — `/`, `/admin`, `/nonexistent` → index.html; `/api/*` → 404
- **Звуковые файлы** — все 4 присутствуют (tick: 4431b, tick_fast: 3804b, end_round: 37659b, winner: 78410b)

---

## 7. Приоритеты исправлений

| # | Баг | Срочность | Строки |
|---|-----|----------|--------|
| 1 | **BUG-RECONN**: `remove_token()` при disconnect | До выставки | `backend/main.py:366-369` |
| 2 | **BUG-ADMIN-HEARTBEAT**: следствие BUG-RECONN | До выставки | фронтенд WS клиент + п.1 |
| 3 | **BUG-FONT**: шрифты ERR_CONTENT_LENGTH_MISMATCH | До выставки | пересборка образа |
| 4 | **BUG-UNKNOWN-ROLE**: нет ветки else для неизвестной роли | До выставки | `backend/main.py`, join-handler |
| 5 | **BUG-PLAYER-JOINED-FIELD**: поле `player2_nickname` вместо `player_number` | Высокий | `backend/connection_manager.py` |
| 6 | **BUG-PAGINATION**: `skip` vs `offset` | Средний | `backend/routers/questions.py` |
| 7 | **BUG-WHITESPACE-TEXT**: пробельный текст | Низкий | `backend/routers/questions.py` |
| 8 | **BUG-FAVICON** | Низкий | `frontend/public/favicon.ico` |
| 9 | **BUG-NICKNAME-NULL**: гонка при persist | Низкий | `backend/main.py:370-375` |
