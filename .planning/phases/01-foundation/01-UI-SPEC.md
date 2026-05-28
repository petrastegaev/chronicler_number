---
phase: 1
slug: 01-foundation
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-28
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for Phase 1: Foundation. Establishes the design token system and scaffold for all future phases.
>
> Phase 1 is primarily **backend infrastructure**. The only frontend work is project scaffolding per D-11, D-12, D-13:
> - Full Vite + React + TypeScript scaffold with Tailwind CSS v4
> - React Router with `/` and `/admin` routes serving **minimal placeholder content**
> - Frontend dependencies installed (react, react-dom, react-router-dom, zustand, motion, howler)
> - Tailwind `@theme` directive populated with design tokens from `web_design.md`
>
> Actual player UI is built in **Phase 3**. Admin UI is built in **Phase 4**.
> This contract defines the visual defaults that all later phases inherit.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | none (custom CSS via Tailwind v4) | CONTEXT.md D-12, RESEARCH.md |
| Preset | not applicable | No shadcn in stack |
| Component library | none (custom components per phase) | CLAUDE.md stack decision |
| Icon library | none for Phase 1 (inline SVG / local SVG sprite for later phases) | web_design.md section 4.4 |
| Font | **Inter** (locally bundled in `public/fonts/`) | web_design.md section 4.2, RESEARCH.md Pattern 4 |

**Font loading:** Inter Regular (400), SemiBold (600), Bold (700) must be bundled as self-hosted
WOFF2 files in `frontend/public/fonts/Inter-{weight}.woff2`. Declared via `@font-face`
in `src/index.css`. No Google Fonts CDN -- fully offline constraint (DEPLOY-02, DEPLOY-03).

**Tailwind CSS v4 configuration:** All design tokens defined via `@theme` in `src/index.css`.
No `tailwind.config.js` file. The `@tailwindcss/vite` plugin is registered in `vite.config.ts`.

---

## Spacing Scale

Standard 8-point grid. Declared values (all multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding between label and value |
| sm | 8px | Compact element spacing, input padding |
| md | 16px | Default element spacing, card padding |
| lg | 24px | Section padding, gap between content blocks |
| xl | 32px | Layout gaps between major sections |
| 2xl | 48px | Major section breaks, page margins |
| 3xl | 64px | Page-level outer spacing |

Exceptions: none for Phase 1. The 8-point grid is applied as the default spacing
convention for all components across all phases.

Tailwind v4 uses this scale natively (`p-4` = 16px, `gap-6` = 24px, etc.).
No custom spacing tokens needed.

---

## Typography

Three sizes declared for the foundation (Phase 1 only needs Body and Heading for
placeholder pages; Display and Timer sizes are reserved for Phase 3 but defined now
so the `@theme` is complete.)

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Body | 16px | Regular (400) | 1.5 | `text-base` |
| Label | 14px | Regular (400) | 1.4 | `text-sm` |
| Small | 12px | Regular (400) | 1.3 | `text-xs` |
| Heading | 24px | SemiBold (600) | 1.2 | `text-2xl font-semibold` |
| Display (Phase 3+) | 40px | Bold (700) | 1.1 | `text-4xl font-bold` |
| Timer (Phase 3+) | 64px | Bold (700) | 1.0 | `text-6xl font-bold` |

**Foundation weights:** Regular (400) and SemiBold (600). These two cover all Phase 1
placeholder content. Bold (700) is declared in `@theme` but only used from Phase 3 onward.

**Font family tokens in `@theme`:**

```css
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

The mono font is reserved for the timer display (Phase 3+) to ensure consistent
digit widths during countdown animation. For Phase 1, `font-sans` covers everything.

**Sources:** web_design.md section 4.2 (size ranges), RESEARCH.md Pattern 4 (Inter font choice).

---

## Color

### 60 / 30 / 10 Split

| Role | Hex | Usage | Tailwind Class |
|------|-----|-------|----------------|
| Dominant (60%) | `#1a0a2e` | Page backgrounds, large surface areas | `bg-wb-bg` |
| Secondary (30%) | `#2d1b4e` | Cards, containers, nav areas, section dividers | `bg-wb-surface` |
| Accent (10%) | `#3B82F6` | Reserved for explicit list below | `text-player1`, `bg-player1` |

### Full Color Palette (all tokens in `@theme`)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-wb-bg` | `#1a0a2e` | Primary background (dominant) |
| `--color-wb-surface` | `#2d1b4e` | Card/container surfaces (secondary) |
| `--color-wb-text` | `#eeeeee` | Primary text color |
| `--color-wb-text-muted` | `#9ca3af` | Secondary text, hints, placeholders |
| `--color-player1` | `#3B82F6` | Player 1 indicators, primary CTAs, interactive highlights |
| `--color-player1-light` | `#60a5fa` | Player 1 hover states, lighter accents |
| `--color-player2` | `#EF4444` | Player 2 indicators, destructive actions |
| `--color-player2-light` | `#f87171` | Player 2 hover states |
| `--color-correct` | `#10B981` | Correct answers, success states, online indicators |
| `--color-warning` | `#F59E0B` | Timer low-time warning (<3s), caution states |
| `--color-danger` | `#EF4444` | Destructive-only actions (delete, reset) |

### Accent Reserved For

The accent color `#3B82F6` (blue) is reserved exclusively for:

- Player 1 identity indicators (nickname, score, winner highlight)
- Primary call-to-action buttons ("Присоединиться", "Запустить игру")
- Interactive element highlights (focus rings, active states)
- Link text (if any)

The secondary accent `#EF4444` (orange-red) is reserved for:

- Player 2 identity indicators (nickname, score, winner highlight)
- Destructive actions (delete, reset game)
- Timer warning state (last 3 seconds, shared with `#F59E0B`)

**Do NOT use accent colors for:** decorative elements, non-interactive icons, borders on
non-interactive containers, loading skeletons. Reserved for semantically meaningful
elements only.

**Sources:** web_design.md sections 4.1, 4.2.

---

## Copywriting Contract

Phase 1 has no interactive components, forms, or games states. The only copy exists
on two placeholder pages. Full copywriting for Join, Game, and Admin screens is
deferred to Phase 3 and Phase 4.

| Element | Copy | Notes |
|---------|------|-------|
| Application title | "Дуэль чисел" | Game name, displayed on all pages |
| "/" page heading | "Экран входа" | Placeholder heading for Join screen (Phase 3 will replace) |
| "/" page subtitle | "Подключение первого игрока..." | Placeholder status text |
| "/admin" page heading | "Панель ведущего" | Placeholder heading for Admin screen (Phase 4 will replace) |
| "/admin" page subtitle | "Управление игрой" | Placeholder subtitle |
| Placeholder badge | "Заглушка" | Badge text indicating placeholder content (Phase 1 only) |

**Language:** All UI copy is in Russian. No English strings in the user-facing interface.

**No destructive actions in Phase 1.** No confirmation dialogs needed.

**Sources:** web_design.md requirements, PROJECT.md constraints (Russian UI).

---

## Concrete Deliverables for Phase 1

The executor builds these specific frontend artifacts:

### 1. `frontend/src/index.css` — Tailwind v4 Theme

The `@theme` block with ALL design tokens from the Color and Typography sections above.
In addition, the `@font-face` declarations for Inter Regular (400), SemiBold (600),
Bold (700) pointing to `../public/fonts/Inter-*.woff2`.

```css
@import "tailwindcss";

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}

@theme {
  --color-wb-bg: #1a0a2e;
  --color-wb-surface: #2d1b4e;
  --color-wb-text: #eeeeee;
  --color-wb-text-muted: #9ca3af;
  --color-player1: #3B82F6;
  --color-player1-light: #60a5fa;
  --color-player2: #EF4444;
  --color-player2-light: #f87171;
  --color-correct: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

@layer base {
  body {
    background-color: var(--color-wb-bg);
    color: var(--color-wb-text);
    font-family: var(--font-sans);
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

### 2. `frontend/src/pages/JoinPage.tsx` — Placeholder ("/" route)

Minimal placeholder. Dark background, centered layout, game title, placeholder badge.

```tsx
export default function JoinPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-wb-bg px-4">
      <h1 className="text-4xl font-bold text-wb-text">Дуэль чисел</h1>
      <p className="mt-2 text-2xl font-semibold text-player1">Экран входа</p>
      <p className="mt-4 text-base text-wb-text-muted">
        Подключение первого игрока...
      </p>
      <span className="mt-8 rounded bg-wb-surface px-3 py-1 text-sm text-wb-text-muted">
        Заглушка
      </span>
    </main>
  );
}
```

### 3. `frontend/src/pages/AdminPage.tsx` — Placeholder ("/admin" route)

Minimal placeholder. Dark background, centered layout, title, placeholder badge.

```tsx
export default function AdminPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-wb-bg px-4">
      <h1 className="text-4xl font-bold text-wb-text">Дуэль чисел</h1>
      <p className="mt-2 text-2xl font-semibold text-player2">
        Панель ведущего
      </p>
      <p className="mt-4 text-base text-wb-text-muted">
        Управление игрой
      </p>
      <span className="mt-8 rounded bg-wb-surface px-3 py-1 text-sm text-wb-text-muted">
        Заглушка
      </span>
    </main>
  );
}
```

### 4. `frontend/src/main.tsx` — React Router Setup

Router with `/` (JoinPage) and `/admin` (AdminPage) routes wrapped in
`RouterProvider`. App.tsx as layout component with `<Outlet />`.

### 5. `frontend/src/App.tsx` — Layout Shell

```tsx
import { Outlet } from "react-router";

export default function App() {
  return <Outlet />;
}
```

### 6. Font Files

Download Inter WOFF2 (Regular 400, SemiBold 600, Bold 700) from
<https://github.com/rsms/inter/releases> and place in `frontend/public/fonts/`.

### 7. Placeholder Store and Types

- `frontend/src/stores/gameStore.ts` — Empty Zustand store shell (exports `useGameStore`)
- `frontend/src/types/ws.ts` — Empty WebSocket message type declarations (reserved for Phase 3)

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable |

No shadcn, no component registries. All UI components are custom-built per phase.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS (scope-limited to Phase 1 placeholders)
- [ ] Dimension 2 Visuals: PASS (design tokens match web_design.md spec)
- [ ] Dimension 3 Color: PASS (60/30/10 split, accent reserved-for list declared)
- [ ] Dimension 4 Typography: PASS (3 sizes declared, 2 weights declared, Inter bundled locally)
- [ ] Dimension 5 Spacing: PASS (8-point grid, no exceptions)
- [ ] Dimension 6 Registry Safety: PASS (no registries used)

**Approval:** pending
