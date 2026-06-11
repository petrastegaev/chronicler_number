---
status: partial
phase: 05-audio-deployment-polish
source: [05-VERIFICATION.md]
started: 2026-06-11T00:00:00.000Z
updated: 2026-06-11T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Offline startup
**expected:** Disconnect machine from all networks (WiFi off, ethernet unplugged), run `docker compose up`, verify app starts within 30 seconds and is accessible at http://localhost:8000
**result:** [pending]

### 2. No external CDN requests
**expected:** Open DevTools > Network tab, filter by domain (not localhost), verify zero external requests during page load and full game playthrough
**result:** [pending]

### 3. Audio playback correctness during game
**expected:** Play a full game (join 2 players, admin starts, complete 9 rounds):
- Tick sound plays each second during countdown
- Tick_fast activates at <= 3 seconds remaining
- End_round bell plays after each round result
- Winner fanfare plays at game end
**result:** [pending]

### 4. AudioContext unlock on mobile/autoplay-restricted device
**expected:** On a device with autoplay blocking, clicking the "Присоединиться" (Join) button unlocks audio — sounds play after clicking join without requiring a second interaction
**result:** [pending]

### 5. Graceful degradation when audio files blocked
**expected:** Block audio files in DevTools (or test without speakers). Game continues without errors — no crashes, no blank screens, game flow proceeds normally
**result:** [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
