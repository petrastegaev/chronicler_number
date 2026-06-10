---
phase: 04-admin-panel-question-management
plan: 03
subsystem: admin-panel
tags: [csv-import, game-stats, frontend, backend, file-upload]
requires: [04-02]
provides: [csv-import, game-stats-display]
affects: [question_service, questions_router, csv-import-tab, game-stats, game-control-tab]
tech-stack:
  added: []
  patterns: [FastAPI UploadFile for multipart file upload, csv module for CSV parsing with utf-8-sig BOM handling, Zustand store integration with fetch API]
key-files:
  created:
    - frontend/src/components/admin/CsvImportTab.tsx
    - frontend/src/components/admin/GameStats.tsx
  modified:
    - backend/schemas.py (added CsvImportResponse)
    - backend/services/question_service.py (added csv_import static method)
    - backend/routers/questions.py (added POST /api/questions/upload-csv endpoint)
    - frontend/src/components/admin/QuestionsTab.tsx (replaced CSV placeholder with CsvImportTab)
    - frontend/src/components/admin/GameControlTab.tsx (replaced inline game count with GameStats)
decisions:
  - GameStats component fetches GET /api/stats independently rather than sharing the Zustand store's gameCount, keeping concerns separated
  - CSV upload confirmation button disables during upload (opacity-50) and shows "Загрузка..." text
  - Question list refreshes after successful CSV upload via a separate fetch, keeping store in sync
metrics:
  duration: "~2 minutes"
  completed_date: "2026-06-10"
---

# Phase 4 Plan 3: CSV Import + Game Stats Summary

**One-liner:** Backend CSV import endpoint with row-level validation and response schema, frontend CsvImportTab with three-stage flow (file pick, preview+confirm, result card), and standalone GameStats component with automatic data fetching.

## Objectives Met

1. **CSV Import (backend):** `POST /api/questions/upload-csv` endpoint accepts a CSV file via `UploadFile`, parses it with `csv.reader`, validates each row (field count, non-empty text, integer answer 0-1M, category max 255 chars), and returns `{"added": N, "errors": ["..."]}` with Russian error strings per D-12 format.

2. **CSV Import (frontend):** CsvImportTab has three stages: initial (dashed-border dropzone with file picker), preview (5-row table with column headers + confirm/cancel), and result (success count and/or error list with "Добавить ещё" reset). Crossfade transitions via AnimatePresence mode="wait".

3. **Game Stats:** GameStats component fetches GET /api/stats on mount and displays "Сыграно игр: {N}". Integrated into GameControlTab at the bottom, replacing the inline rendering. Silently stays at 0 on network error.

## Tasks Executed

| Task | Name                                        | Commit | Files                                                                       |
| ---- | ------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| 1    | Backend CSV import (service + endpoint)     | 9ac7dae | schemas.py, question_service.py, questions.py                              |
| 2    | Frontend CsvImportTab + QuestionsTab wiring | 77272e5 | CsvImportTab.tsx, QuestionsTab.tsx                                         |
| 3    | GameStats component + GameControlTab wiring | 9788fae | GameStats.tsx, GameControlTab.tsx                                          |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — all security-relevant surface covered by plan's threat model (CSV content validation done server-side with SQLAlchemy parameterized queries, frontend renders error text as plain text nodes, no new dependencies introduced).

## Self-Check

- [x] `backend/schemas.py` contains `class CsvImportResponse` with `added: int` and `errors: list[str]`
- [x] `backend/services/question_service.py` has `csv_import` static async method with validation pipeline
- [x] `backend/routers/questions.py` has `POST /api/questions/upload-csv` endpoint using UploadFile
- [x] `frontend/src/components/admin/CsvImportTab.tsx` has 3 stages (initial, preview, result)
- [x] `frontend/src/components/admin/QuestionsTab.tsx` renders CsvImportTab on CSV sub-tab
- [x] `frontend/src/components/admin/GameStats.tsx` fetches GET /api/stats on mount
- [x] `frontend/src/components/admin/GameControlTab.tsx` renders GameStats at bottom
- [x] `npx tsc --noEmit` passes (zero errors)
- [x] Python import checks pass
- [x] No untracked files in working tree

## Self-Check: PASSED
