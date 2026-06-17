---
slug: leaderboard
description: Добавить таблицу рекордов (Leaderboard) в админ-панель
created: 2026-06-17
---

# Leaderboard Feature

## Goal
Добавить таблицу рекордов (Leaderboard) — страницу/вкладку в админ-панели, которая показывает топ игроков по количеству побед на основе данных из существующей таблицы `game_sessions`.

## Design Decisions
- **Агрегация по никнейму**: группируем по `winner_nickname`, `player1_nickname`, `player2_nickname` из `game_sessions`. Никнеймы — свободный текст, поэтому один и тот же человек может иметь разные записи. Это приемлемо для конференционного формата.
- **Только админ-панель**: таблица рекордов доступна только администратору (требуется `X-Admin-Key`). Игроки видят свои результаты только в рамках текущей игры.
- **Новая вкладка**: добавляем третью вкладку "Рекорды" в BottomTabBar админ-панели.

## Implementation Plan

### 1. Backend: Schema (schemas.py)
- Add `LeaderboardEntry` Pydantic model: `nickname`, `games_played`, `wins`, `losses`, `win_rate`, `total_score`
- Add `LeaderboardResponse` Pydantic model: `entries: list[LeaderboardEntry]`

### 2. Backend: Stats Router (routers/stats.py)
- Add `GET /api/stats/leaderboard` endpoint
- SQL query: aggregate `game_sessions` by nickname
  - Wins: COUNT where `winner_nickname` = nickname
  - Games played: COUNT where nickname in (player1_nickname, player2_nickname)
  - Losses = games_played - wins
  - Win rate = wins / games_played
  - Total score: SUM of player scores
- Sort by wins DESC, win_rate DESC
- Return top 20 entries

### 3. Frontend: LeaderboardTab component (new file)
- `frontend/src/components/admin/LeaderboardTab.tsx`
- Fetches `GET /api/stats/leaderboard` on mount
- Renders table: rank, nickname, games played, wins, losses, win rate %, total score
- Loading state, empty state, error state
- Styled consistently with admin panel (Tailwind, Motion animations)

### 4. Frontend: BottomTabBar update
- Add third tab "Рекорды" with trophy icon
- Update `activeTab` type to include `'leaderboard'`

### 5. Frontend: AdminPage update
- Handle `'leaderboard'` tab in the AnimatePresence switch
- Import and render `LeaderboardTab`

## Files Changed
| File | Change |
|------|--------|
| `backend/schemas.py` | Add LeaderboardEntry, LeaderboardResponse |
| `backend/routers/stats.py` | Add GET /api/stats/leaderboard |
| `frontend/src/components/admin/LeaderboardTab.tsx` | NEW — leaderboard UI |
| `frontend/src/components/admin/BottomTabBar.tsx` | Add third tab |
| `frontend/src/pages/AdminPage.tsx` | Wire leaderboard tab |
