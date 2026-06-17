---
quick_id: 260617-r8b
slug: figma-cofo-sans-pixel
status: complete
description: "Применить дизайн из Figma (цвета, шрифты CoFo Sans Pixel), переименовать игру на Число летописца"
date: 2026-06-17
---

# Quick Task 260617-r8b: Figma Design + CoFo Fonts + Rename — Summary

## What was done

### Task 1: Шрифты — CoFo Sans ✅
- Скопированы `CoFoSansPixel.otf` и `CoFoSansRegular.otf` в `frontend/public/fonts/`
- Заменены `@font-face` блоки в `index.css`: Inter → CoFo Sans Pixel / CoFo Sans Regular
- Обновлён `--font-sans`: `'CoFo Sans Pixel', 'CoFo Sans Regular', system-ui, sans-serif`
- TimerRing.tsx: `fontFamily` изменён с Inter на CoFo Sans Pixel

### Task 2: Цветовая палитра из Figma ✅
Все токены в `@theme` (index.css) обновлены:
| Токен | Было | Стало |
|-------|------|-------|
| `--color-wb-bg` | `#1a0a2e` | `#161616` |
| `--color-wb-surface` | `#2d1b4e` | `#2a2a2a` |
| `--color-wb-text` | `#eeeeee` | `#d5ccde` |
| `--color-wb-text-muted` | `#9ca3af` | `#8a7a9a` |
| `--color-player1` | `#3B82F6` | `#7f30e3` |
| `--color-player2` | `#EF4444` | `#ff00fe` |
| `--color-correct` | `#10B981` | `#40f99b` |
| `--color-danger` | `#EF4444` | `#ff3333` |

- ResultOverlay.tsx: хардкод-цвет `rgba(26,10,46,0.85)` → `rgba(22,22,22,0.85)`

### Task 3: Переименование ✅
- JoinScreen.tsx: "Дуэль чисел" → "Число летописца"
- WaitingScreen.tsx: "Дуэль чисел" → "Число летописца"
- GameHeader.tsx: "Дуэль чисел" → "Число летописца"
- GameControlTab.tsx: "Дуэль чисел" → "Число летописца"
- index.html: `<title>` → "Число летописца"

## Verification
- [x] `grep -r "Дуэль чисел" frontend/src/` — 0 совпадений
- [x] Все старые hex-цвета заменены
- [x] Inter больше не упоминается в CSS
- [x] `npm run build` — успешно (474 модуля, 1.14s)
- [x] `backend/static/` обновлён копией сборки

## Files changed
- `frontend/index.html` — title
- `frontend/src/index.css` — шрифты + цвета
- `frontend/public/fonts/CoFoSansPixel.otf` — новый
- `frontend/public/fonts/CoFoSansRegular.otf` — новый
- `frontend/src/components/JoinScreen.tsx` — название
- `frontend/src/components/WaitingScreen.tsx` — название
- `frontend/src/components/GameHeader.tsx` — название + шрифт
- `frontend/src/components/admin/GameControlTab.tsx` — название
- `frontend/src/components/TimerRing.tsx` — шрифт
- `frontend/src/components/ResultOverlay.tsx` — цвет оверлея
