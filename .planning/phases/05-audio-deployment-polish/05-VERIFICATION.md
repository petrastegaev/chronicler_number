---
phase: 05-audio-deployment-polish
verified: 2026-06-11
status: incomplete
overrides_applied: 0
---

# Phase 5: Audio + Deployment Polish — VERIFICATION

**Date:** 2026-06-11
**Environment:** Docker, Docker Compose, offline LAN
**Status:** INCOMPLETE (fill results below)

## Goal

Confirm the complete application (with 4 audio sound effects) deploys correctly via Docker Compose and works fully offline — the critical requirement for the conference booth. Zero external CDN requests, all 4 audio files served locally, all game sounds play correctly.

## Prerequisites

- Docker and Docker Compose installed
- Browser (preferably Chrome with DevTools)
- 3 browser tabs open (2 player + 1 admin)
- Audio output enabled (speakers or headphones)

---

### Test 1: Docker build

**Steps:**
1. Run `docker compose build --no-cache` from the project root
2. Verify exit code 0 (build succeeds)
3. Run `docker run --rm number_game-app ls -la /app/static/sounds/` to verify audio files are in the image

**Expected:**
- Build completes successfully in under 2 minutes
- All 4 audio files listed: `tick.mp3`, `tick_fast.mp3`, `end_round.mp3`, `winner.mp3`
- File sizes match known values (~4KB, ~4KB, ~38KB, ~78KB)
- Files have valid MP3 headers (starts with `ID3` bytes)

**Initial verification result (2026-06-11):**
- `docker compose build --no-cache` exited with code 0
- `ls -la /app/static/sounds/` shows all 4 files
- All files confirmed with valid ID3 headers via `head -c 3`
- Passed verification

**Result:** [PASS]

---

### Test 2: Offline startup

**Steps:**
1. Disconnect machine from all networks (WiFi off, ethernet unplugged)
2. Run `docker compose up`
3. Verify app starts within 30 seconds

**Expected:**
- Server starts without errors (logs show "Uvicorn running on http://0.0.0.0:8000")
- SQLite database initializes correctly in `/app/data/`
- Application is accessible at `http://localhost:8000/`

**Result:** [PASS/FAIL]

---

### Test 3: Static file serving

**Steps:**
1. With `docker compose up` running, verify each audio file URL:
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/sounds/tick.mp3`
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/sounds/tick_fast.mp3`
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/sounds/end_round.mp3`
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/sounds/winner.mp3`
2. Verify MP3 content type by checking that `head -c 3` returns `ID3` bytes (not HTML)

**Expected:**
- All 4 files return HTTP status 200
- All 4 files return valid MP3 data (bytes start with `ID3`)
- File sizes match: tick.mp3 (~4.4 KB), tick_fast.mp3 (~3.8 KB), end_round.mp3 (~37.7 KB), winner.mp3 (~78.4 KB)

**Initial verification result (2026-06-11):**
- All 4 files returned HTTP 200 with correct sizes
- All 4 files have valid ID3 MP3 headers
- Passed verification

**Result:** [PASS]

---

### Test 4: No external CDN requests

**Steps:**
1. Start `docker compose up`
2. Open `http://localhost:8000/` in a browser
3. Open DevTools > Network tab
4. Add filter: domain does not include `localhost`
5. Reload the page and play a full game
6. Check for any requests to external domains (googleapis.com, fonts.gstatic.com, unpkg.com, cdn.*, etc.)

**Expected:**
- Zero requests to external domains
- All assets (JS, CSS, fonts, audio, icons) loaded from `localhost:8000`
- Network tab shows zero blocked requests, zero failed requests
- No DNS resolution attempts to external hosts (check DevTools timing column)

**Result:** [PASS/FAIL]

---

### Test 5: Audio playback during game

**Steps:**
1. Start `docker compose up`
2. Open 3 browser tabs:
   - Tab 1: `http://localhost:8000/` (Player 1)
   - Tab 2: `http://localhost:8000/` (Player 2)
   - Tab 3: `http://localhost:8000/admin` (Admin)
3. Join Player 1 and Player 2 with nicknames
4. Admin starts the game
5. Complete all 9 rounds

**Audio checks during gameplay:**

| Sound | Triggered When | How to Verify |
|-------|---------------|---------------|
| `tick` (short click) | Each second during countdown when remaining > 3 seconds | Audible tick every second for rounds 1-9 |
| `tick_fast` (higher-pitch, faster) | When remaining <= 3 seconds (last 3 seconds of countdown) | Noticeably different pitch and urgency in last 3 seconds |
| `end_round` (bell/gong) | After each round result is shown | Bell sound after each of the 9 rounds |
| `winner` (fanfare) | At game end when final results screen appears | Triumphant fanfare plays once |

**Expected:**
- All 4 sounds play at correct times
- No sound overlaps or playback errors
- Sounds continue working across all 9 rounds
- No console errors related to audio

**Result:** [PASS/FAIL]

---

### Test 6: AudioContext unlock

**Steps:**
1. Open `http://localhost:8000/` on a mobile device (or desktop with autoplay restrictions)
2. Before clicking any button, check audio state:
   - DevTools console: `Howler.ctx && Howler.ctx.state` — should be `suspended` (if available)
3. Click the "Присоединиться" (Join) button
4. Join a game and start playing

**Expected:**
- AudioContext is suspended before interaction
- After clicking "Присоединиться", AudioContext resumes (state becomes `running`)
- All subsequent sounds play correctly
- If Howler.js autoUnlock is not accessible via global, simply verify sounds play after join click

**Booth-specific note:** On the conference day, player devices will be laptops/tablets. Most modern browsers have autoplay policies. The join button click serves as the user gesture that unlocks audio. If a player refreshes the page mid-game, they need to click the join button again to re-unlock audio.

**Result:** [PASS/FAIL]

---

### Test 7: Graceful degradation

**Steps:**
1. In DevTools > Network tab, block audio files:
   - Method A: Add `sounds/*.mp3` to DevTools request blocking
   - Method B: Test without speakers/headphones (no functional test needed — just ensure no errors)
2. Play a full game
3. Check browser console for errors

**Expected:**
- Game continues without audio without any crashes or errors
- Console may show warnings (`[Audio] Failed to load ...`) but no unhandled errors
- All game mechanics (answers, timer, scoring, round transitions) work exactly as with audio
- No infinite loops, blank screens, or crashes

**Result:** [PASS/FAIL]

---

## Captive Portal Information (Booth Staff Reference)

### What is a Captive Portal?
A captive portal is a login/accept page that appears when connecting to a public WiFi network (common at conferences, hotels, airports). The device automatically opens a browser to show the terms/authentication page.

### How It Affects the Booth
- If the venue WiFi has a captive portal, player/admin devices may show the login page instead of the game screen
- The app runs on plain HTTP (`http://<server-ip>:8000/`), which **typically does not trigger captive portal detection** (captive portals check HTTPS to `captive.apple.com`, `connectivitycheck.gstatic.com`, etc.)
- Some devices may still detect the captive portal via DNS interception and show a notification

### Mitigation Strategy
1. **Preferred (recommended):** Bring a dedicated portable router (e.g., GL.iNet travel router) creating an isolated hotspot. No captive portal, no DHCP conflicts, full control.
2. **Fallback:** If using conference WiFi, test connectivity the day before. If captive portal exists, staff must tell attendees to:
   - Select "Use network without internet" / "Skip" / "Продолжить без интернета" on the captive portal page after connecting to WiFi
   - The app does not need internet — it only needs LAN access to the server
3. **Fail-safe:** The app URL is `http://<server-ip>:8000/`. If a device shows a captive portal page, the user can:
   - Dismiss/close the captive portal tab
   - Manually navigate to `http://<server-ip>:8000/`
   - The app will work without accepting the WiFi terms (LAN access is typically not blocked by captive portals)

### Known Quirks
- macOS/iOS: May show "Sign in to network" notification even if app works — dismiss it
- Windows: May redirect to login page on first HTTP request — browse to `http://server-ip:8000/` directly
- Android: Usually just shows a notification that can be dismissed
- **No app-level mitigation is possible** for OS-level captive portal detection

---

## Summary

| Test | Name | Result |
|------|------|--------|
| 1 | Docker build | [PASS] |
| 2 | Offline startup | [PASS/FAIL] |
| 3 | Static file serving | [PASS] |
| 4 | No external CDN requests | [PASS/FAIL] |
| 5 | Audio playback during game | [PASS/FAIL] |
| 6 | AudioContext unlock | [PASS/FAIL] |
| 7 | Graceful degradation | [PASS/FAIL] |

**Tests with PASS verified:** 1, 3
**Tests requiring human verification:** 2, 4, 5, 6, 7
**Total:** 2/7 pass, 5/7 incomplete
**Overall status:** INCOMPLETE

---

*Document created: 2026-06-11*
*Verifier: Claude (automated) — Tests 1 and 3 verified programmatically*
