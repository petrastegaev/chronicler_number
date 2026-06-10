# Phase 3: Player Frontend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 3-Player Frontend
**Areas discussed:** Timer visual style, Round result reveal, Answer input design, Screen architecture & transitions

---

## Timer visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Large digits only | Monospace digits (72-96px) with color change at ≤3s. Fastest to build. | |
| Circular SVG ring | SVG ring with stroke-dashoffset animation synced to server ticks. Matches web_design.md §4.5. Most dramatic. | ✓ |

Ring fill direction:
| Option | Description | Selected |
|--------|-------------|----------|
| Counter-clockwise | Standard countdown feel (like a clock winding down) | ✓ |
| Clockwise | More intuitive progress bar feel | |

Digits display:
| Option | Description | Selected |
|--------|-------------|----------|
| Digits inside ring | 56-72px bold monospace digits centered in ring | ✓ |
| Ring only, no digits | Ring is sole indicator, more minimal | |

Color shift timing:
| Option | Description | Selected |
|--------|-------------|----------|
| Shift at ≤5s and ≤3s | Yellow (#F59E0B) at ≤5s, then red (#EF4444) at ≤3s | ✓ |
| Single shift at ≤3s | Normal to red only, simpler | |

**User's choice:** Circular SVG ring, counter-clockwise, digits inside, two-stage color shift.
**Notes:** Matches web_design.md §4.5 vision despite ENH-02 deferring circular timer to v2. User prioritized booth visual impact over implementation simplicity.

---

## Round result reveal

| Option | Description | Selected |
|--------|-------------|----------|
| Full overlay | Darkened background, centered card fades+scales in. Most dramatic. | ✓ |
| Slide-up panel | Panel rises from bottom, game still visible behind | |
| Inline content swap | Question area replaced by result, fastest | |

Winner callout:
| Option | Description | Selected |
|--------|-------------|----------|
| Glow + color | Winner glows in their player color (blue/orange). "Ничья" in white. | ✓ |
| Icon + label | ✓ icon next to winner, "Победа!" label | |

Answer layout:
| Option | Description | Selected |
|--------|-------------|----------|
| Own answer first | Player's answer on top (larger), opponent's below, correct centered | ✓ |
| Correct answer first | Correct answer at top (largest), both players side by side | |

**User's choice:** Full overlay, glow highlighting, own answer first.
**Notes:** Dramatic reveal prioritized for booth crowd appeal. Overlay displayed ~3 seconds per Phase 2 D-15 timing.

---

## Answer input design

| Option | Description | Selected |
|--------|-------------|----------|
| Early submit button | Players can lock in answer early. Button disables input after. | ✓ |
| Auto-submit only on expiry | No button, answer is whatever's in field at timer=0 | |

Input style:
| Option | Description | Selected |
|--------|-------------|----------|
| Large text input | `<input type="number">`, full-width, 32-40px font, 56px+ height | ✓ |
| Custom number pad | Calculator-style button grid, touch-optimized | |

Value display:
| Option | Description | Selected |
|--------|-------------|----------|
| Immediate local echo | Typed value shown instantly. Sent on submit or expiry. | ✓ |
| Send on each keystroke | Every keystroke sent to server | |

**User's choice:** Early submit button, large text input, local echo.
**Notes:** Early submission adds strategic element — submit fast or keep refining. Input triggers numeric keyboard on tablets.

---

## Screen architecture & transitions

| Option | Description | Selected |
|--------|-------------|----------|
| Single screen, phase-driven | One GameScreen, content controlled by Zustand `phase` | ✓ |
| Separate screen per state | JoinScreen, WaitingScreen, GameScreen, FinalScreen as top-level | |

Animation style:
| Option | Description | Selected |
|--------|-------------|----------|
| Crossfade | 300ms fade between states, smooth and professional | ✓ |
| Slide | Content slides in/out, feels like navigation | |
| Scale + fade | Content scales up from 0.95 while fading in | |

Header:
| Option | Description | Selected |
|--------|-------------|----------|
| Persistent header | Game title always visible across all states | ✓ |
| Screen-specific only | Each screen self-contained, no shared chrome | |

**User's choice:** Single screen phase-driven, crossfade transitions, persistent header.
**Notes:** Clean architecture maps directly to Zustand phase field. During gameplay, header also shows nickname, score, and round indicator.

---

## Claude's Discretion

No areas were deferred to Claude — all decisions were explicitly selected by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
