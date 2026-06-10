---
status: complete
phase: 04-admin-panel-question-management
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-06-11T00:14:00+03:00
updated: 2026-06-11T00:22:00+03:00
---

## Current Test

[testing complete]

## Tests

### 1. Admin Panel — Bottom Tab Navigation
expected: Opening `/admin` shows Game tab by default. Bottom bar has two tabs: "Игра" (active, blue) and "Вопросы" (inactive, muted). Tapping switches content area with fade+slide animation. Header shows "Дуэль чисел" + "Панель ведущего".
result: pass

### 2. Admin Panel — Player Slots
expected: Game tab shows two player slot cards side by side: "Игрок 1" (blue dot) + "Нет подключения" and "Игрок 2" (red dot) + "Нет подключения". When a player joins via WebSocket, the slot shows their nickname and green "Готов" status.
result: pass

### 3. Admin Panel — Question Pool Warning
expected: When questions in database < 9, a warning banner shows: "Недостаточно вопросов в базе (N / 9). Игра не может начаться." with a warning triangle icon. The "Запустить игру" button is disabled. When ≥ 9 questions and both players connected, warning disappears and button enables.
result: pass

### 4. Admin Panel — Game Stats Display
expected: Game tab shows "Сыграно игр: N" at the bottom, fetched from GET /api/stats/. When N=0, shows "Сыграно игр: 0".
result: pass

### 5. Questions Tab — Sub-navigation
expected: Tapping "Вопросы" shows three sub-tabs: "Список (N)" (with question count), "Добавить", "CSV". Active sub-tab has blue bottom border. Switching between sub-tabs uses crossfade animation.
result: pass

### 6. Question List — Paginated Display
expected: "Список" sub-tab shows paginated question list. Each row: ID (#N in mono), question text (truncated), category pill (if set), delete button (trash icon). Bottom shows "Показать ещё" if more pages exist. Total count displayed in sub-tab label.
result: pass

### 7. Question List — Empty State
expected: When no questions exist, shows centered: large question icon, "Нет вопросов" (18px semibold), "Добавьте вопросы через форму «Добавить» или импортируйте через CSV." (14px muted).
result: skipped
reason: Not tested — database has 36 questions. Empty state was verified in code review.

### 8. Question List — Delete with Confirmation
expected: Clicking trash icon on a question row opens ConfirmDialog: "Удалить вопрос?" with question text preview (max 60 chars). "Удалить" (danger red) confirms, "Отмена" cancels. On confirm: question removed, toast "Вопрос удалён" appears for 3 seconds, list refreshes.
result: pass

### 9. Question Add — Single Question Form
expected: "Добавить" sub-tab shows form with: "Текст вопроса" (text, required, max 500), "Ответ" (number, required, 0-1,000,000), "Категория (необязательно)" (text, max 255). "Добавить вопрос" button (blue, full-width) disabled until text+answer filled. On success: toast "Вопрос добавлен", form clears, list refreshes.
result: pass

### 10. CSV Import — Three-Stage Flow
expected: "CSV" sub-tab: (1) Initial — dashed-border dropzone with upload icon and "Выберите CSV-файл" text, hidden file input. (2) Preview — after file selection, shows file name, 5-row preview table with headers, "Показаны первые 5 строк из N", "Отмена" + "Да, импортировать" buttons. (3) Result — "Успешно добавлено: N" with green checkmark, or error list with "Ошибки:" heading. "Добавить ещё" returns to initial.
result: pass

### 11. Admin WebSocket Connection — Full Game Flow
expected: Admin page connects to WebSocket on mount with admin_key authentication. On successful join, phase changes to 'lobby'. Real-time updates: player joins update player slots, game events (start/score/round) update the UI. Admin can start game when both players connected and ≥ 9 questions available.
result: pass

## Summary

total: 11
passed: 10
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]

## Fixes Applied During UAT

### FIX-1: useAdminWebSocket.ts — missing admin_key in join message
- **Severity:** blocker
- **File:** frontend/src/hooks/useAdminWebSocket.ts
- **Change:** Added `admin_key: 'booth-admin-2026'` to the join message data
- **Effect:** Admin WebSocket connection now authenticates successfully instead of getting "Unauthorized admin access"

### FIX-2: main.py — SPA fallback middleware for client-side routing
- **Severity:** blocker
- **File:** backend/main.py
- **Change:** Added SpaFallbackMiddleware that serves index.html for 404s on non-API GET requests
- **Effect:** Direct navigation to `/admin` now loads the SPA instead of returning 404. API routes remain unaffected.

### FIX-3: GameStats.tsx, QuestionListTab.tsx, QuestionAddTab.tsx, CsvImportTab.tsx — missing trailing slashes in API URLs
- **Severity:** major
- **File:** Multiple frontend components
- **Change:** Changed fetch URLs from `/api/stats` → `/api/stats/` and `/api/questions?...` → `/api/questions/?...`
- **Effect:** API calls now work correctly with FastAPI's trailing-slash route convention

### FIX-4: Frontend rebuild required
- **Severity:** blocker
- **File:** backend/static/ (stale build)
- **Change:** Rebuilt frontend with `npm run build` and copied to `backend/static/`
- **Effect:** Admin page now renders Phase 04 components instead of placeholder stub

### FIX-5: main.py — admin player_joined notification
- **Severity:** major
- **File:** backend/main.py
- **Change:** Added `manager.send_to_admin()` call when a player joins, sending player_number, nickname, and current player slot state
- **Effect:** Admin now sees real-time player connection updates in player slots

### FIX-6: useAdminWebSocket.ts — handle updated player_joined format
- **Severity:** major
- **File:** frontend/src/hooks/useAdminWebSocket.ts
- **Change:** Updated player_joined handler to accept player_number, nickname, player1_nickname, player2_nickname fields
- **Effect:** Admin store correctly populates both player slots when players join
