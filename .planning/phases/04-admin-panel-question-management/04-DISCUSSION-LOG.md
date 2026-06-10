# Phase 4: Admin Panel + Question Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 4-Admin Panel + Question Management
**Areas discussed:** Question management sub-navigation, Admin state management, Question deletion pattern, CSV import backend + frontend split

---

## Question Management Sub-Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-tabs within Вопросы | Horizontal sub-tab bar (Список \| Добавить \| CSV) below the main bottom tabs. Each sub-tab renders its own content area — most familiar for mobile. | ✓ |
| List-first with modals | Вопросы tab defaults to the question list. 'Добавить' and 'Импорт CSV' are full-screen modals or sheets. | |
| Single scrollable page | All 3 sub-modes on one long scrollable page — no navigation needed. | |

**User's choice:** Sub-tabs within Вопросы
**Notes:** Standard mobile pattern — bottom tabs for main sections, sub-tabs for filtering within a section.

### Default Sub-Tab

| Option | Description | Selected |
|--------|-------------|----------|
| Список (list) as default | Always opens the question list. Add and CSV import are secondary actions reached from there. | ✓ |
| Remember last-used | Whichever sub-tab was last used. More convenient for batch imports. | |

**User's choice:** Список as default
**Notes:** List view is the primary interaction mode for the Вопросы tab.

### Count Badge

| Option | Description | Selected |
|--------|-------------|----------|
| Show count badge | Shows the current question pool size — useful for checking 9-question minimum. | ✓ |
| No count | Just the tab label, no count. | |

**User's choice:** Show count badge
**Notes:** Quick at-a-glance check for the minimum 9 questions requirement.

---

## Admin State Management

### Store Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Separate adminStore | New adminStore.ts next to gameStore.ts. Clean separation — no player fields leaked to admin. | ✓ |
| Extend gameStore | Add admin-specific fields to existing gameStore. Simpler but bloats player store. | |

**User's choice:** Separate adminStore
**Notes:** Clean separation preferred. Admin and player are different roles on different devices — they should not share state.

### WebSocket Hook

| Option | Description | Selected |
|--------|-------------|----------|
| Separate useAdminWebSocket | New useAdminWebSocket.ts hook. Admin-specific events and store dispatch. | ✓ |
| Extend useWebSocket | Add admin role handling to the existing hook. More code reuse but dual-store dispatching gets complex. | |

**User's choice:** Separate useAdminWebSocket
**Notes:** Consistency with separate store decision. Keep admin and player concerns separated.

### Data Caching

| Option | Description | Selected |
|--------|-------------|----------|
| Cache in store + explicit refresh | Fetch once, cache, refetch after mutations. Standard SPA pattern. | ✓ |
| Refetch on tab switch | Refetch from API every time. Always fresh, simpler code. | |

**User's choice:** Cache in store + explicit refresh
**Notes:** LAN-local SQLite means fast responses — caching is fine. Explicit refresh ensures consistency after mutations.

---

## Question Deletion Pattern

### Deletion UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline delete button + confirm | Trash icon per row, confirmation dialog before deleting. Reliable, prevents accidents. | ✓ |
| Swipe-to-delete | Swipe left to reveal delete button. Native-feeling mobile gesture. | |
| Both swipe + inline | Swipe as shortcut, inline button as fallback. Most flexible but more code. | |

**User's choice:** Inline delete button + confirmation dialog
**Notes:** Explicit confirmation is important — deleting questions from a shared pool is a consequential action.

### Deletion Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | Brief toast: "Вопрос удалён" — auto-dismisses after ~3 seconds. Row animates out. | ✓ |
| Row animated removal only | Row fades out, no extra notification. | |

**User's choice:** Toast notification
**Notes:** Toast provides clear confirmation of the action result.

---

## CSV Import Backend + Frontend Split

### Validation Location

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend preview + validate 5 rows | Frontend parses CSV locally, validates preview rows before upload. | |
| Backend-only validation | Frontend only parses 5 rows for display preview. All validation on server. Simpler, single source of truth. | ✓ |

**User's choice:** Backend-only validation
**Notes:** Avoids validation logic duplication. Server is the authority on what constitutes a valid question.

### Result Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline result card | Result card replaces preview area — persists until admin navigates away or does another import. | ✓ |
| Modal summary | Modal/alert pops up with summary — admin dismisses it. | |

**User's choice:** Inline result card
**Notes:** Inline display feels more integrated with the import workflow.

### Error Format

| Option | Description | Selected |
|--------|-------------|----------|
| Row number + reason | Structured error objects: `{row: 3, reason: "..."}` | |
| Plain error strings | Error strings: `["Строка 3: Ответ не является целым числом", ...]`. Direct display, no parsing needed. | ✓ |

**User's choice:** Plain error strings
**Notes:** Simpler API response format, directly displayable in the result card.

---

## Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
