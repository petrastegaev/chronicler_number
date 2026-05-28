# Pitfalls Research

**Domain:** Local multiplayer numeric quiz game for conference booth
**Researched:** 2026-05-28
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: WebSocket Zombie Connections From Disconnect Detection Gap

**What goes wrong:**
The server accumulates dead WebSocket connections. Players who close their browser tab, lose WiFi signal, or walk away remain in the `active_connections` set. The server keeps trying to `send()` timer ticks to dead sockets. Over several hours of booth operation, memory leaks degrade performance or crash the server.

**Why it happens:**
In FastAPI/Starlette, `WebSocketDisconnect` only raises on `websocket.receive()`, not on `websocket.send()` (confirmed by FastAPI maintainer Kludex in GitHub discussion #11008). If the game server runs a send-only loop broadcasting timer ticks without ever calling `receive()`, it will never detect disconnection. The connection stays registered as "active" indefinitely.

Even if `receive()` is called, starting `asyncio.create_task()` for game logic (e.g., timer broadcast) creates a background task that survives the parent coroutine. When the client disconnects, the background task keeps trying to `send()` to a dead socket, raising exceptions silently or leaking memory.

**How to avoid:**
1. Always pair `send()` loops with a concurrent `receive()` or heartbeat mechanism. The simplest approach: separate the endpoint into a reader task and writer task, and cancel the writer when the reader detects disconnect.
2. Always `task.cancel()` background tasks in the `except WebSocketDisconnect` block.
3. Implement a connection manager that removes connections from its tracking dict when `send()` raises an exception (not just on `WebSocketDisconnect`).
4. Add a periodic health check: probe each connection every 30 seconds with a zero-timeout `receive_text()` wrapped in `asyncio.wait_for`.

```python
# Correct pattern: cancel background task on disconnect
try:
    async with asyncio.TaskGroup() as tg:
        reader = tg.create_task(read_messages(websocket))
        writer = tg.create_task(write_timer_ticks(websocket))
except* WebSocketDisconnect:
    pass  # TaskGroup cancels siblings automatically
```

**Warning signs:**
- Number of active connections in admin panel does not drop when a player closes the browser
- Server memory grows over time during booth operation
- `WebSocketDisconnect` exceptions in server logs but connections are not cleaned up
- Server crashes after 2-3 hours of continuous operation

**Phase to address:**
Core Game Loop — WebSocket connection management must handle disconnect correctly from day one. Retrofitting is harder than building it right.

---

### Pitfall 2: SQLite "database is locked" Under Concurrent WebSocket Writes

**What goes wrong:**
During a game, multiple components write to SQLite concurrently: game results at round end, player nicknames, statistics counter. Without proper configuration, one write blocks another and raises `sqlite3.OperationalError: database is locked`. The game freezes mid-round or fails to record the result.

**Why it happens:**
SQLite allows only one writer at a time. In default journal mode (rollback journal), writes also block readers. FastAPI's async WebSocket handlers mean multiple coroutines can attempt writes simultaneously. If any handler calls synchronous `db.commit()`, it also blocks the event loop.

The project currently lists `SQLite over PostgreSQL` as a Pending decision. SQLite is fine for this scale, but only with proper configuration.

**How to avoid:**
1. Enable WAL mode on every connection: `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`
2. Use `aiosqlite` or async SQLAlchemy with `create_async_engine` so `commit()` is awaitable.
3. Set `PRAGMA busy_timeout=5000` to prevent immediate lock failures.
4. Keep transactions short: commit per-message, not per-connection. Never hold a write transaction across WebSocket message boundaries.
5. For the game state that updates every round (9 writes per game), consider keeping the active game in memory and only persisting to SQLite at game end. This eliminates write contention during the 10-second timer.
6. Use a single worker (uvicorn with `--workers 1`) or use SQLite's WAL mode which handles single-writer concurrency adequately. Multiple workers = multiple processes = certain lock collisions.

**Warning signs:**
- `sqlite3.OperationalError: database is locked` in server logs after concurrent game actions
- Admin statistics page fails to load during active games
- Round results disappear after game end (write failed silently)
- Server logs show `database is locked` during CSV import while a game is running

**Phase to address:**
Foundation — configure SQLite connection settings (WAL, timeout, async driver) in the first database setup commit. Also addressed in Core Game Loop when implementing game state persistence.

---

### Pitfall 3: Server Timer Tick Drift vs Client Expectations

**What goes wrong:**
Players perceive the timer as unfair. On one device the timer hits 0 before the other. Answers are marked late for one player but accepted for the other. Players complain the game is rigged.

**Why it happens:**
The GDD specifies server-authoritative timer with `timer_tick` events every second. But WebSocket messages have variable latency -- even on local WiFi, 10-50ms jitter is normal. If Player A's `timer_tick` events arrive 40ms later than Player B's, Player A effectively has 40ms less to answer. Over local WiFi with direct laptop hotspot, this is usually tolerable, but at a conference with interference from dozens of other hotspots, latency variance can spike to 200ms+.

A second cause: if the server broadcasts `timer_tick` sequentially (awaiting each send), the first player gets the tick before the second. The difference accumulates over 9 rounds.

**How to avoid:**
1. Use a single authoritative timer on the server. For the "10 seconds remaining" display, send the *end timestamp* once at round start rather than ticking every second. The client calculates remaining time locally, eliminating per-tick latency.
2. If per-second ticks are preferred (for sound sync), broadcast with `asyncio.gather()` (not sequential sends) to minimize the gap between players.
3. Accept answers based on server-side time, not client time. When a player submits an answer, the server checks "has the round timer expired?" against the server clock. This is the only fair approach.
4. For the "last 3 seconds" fast tick sound, the client can infer this from the locally calculated remaining time rather than waiting for a server event.

**Warning signs:**
- Testers report that one side consistently runs out of time faster
- Admin panel shows different remaining times on the two player screens
- Answers submitted just before the buzzer are rejected for one player but accepted for another
- `timer_tick` events arrive with visible delay on the slower device

**Phase to address:**
Core Game Loop — implement server-authoritative timing from the first timer implementation. Do not add sequential sends.

---

### Pitfall 4: Audio Autoplay Blocked on Mobile Browsers

**What goes wrong:**
At the booth, tablets are used as player devices. Players enter nicknames, the game starts, but no sound plays. No tick, no gong, no victory fanfare. The booth loses its "draws a crowd" audio appeal. Passersby see a silent screen.

**Why it happens:**
All modern mobile browsers (Safari iOS, Chrome Android) block `AudioContext` and `HTMLAudioElement.play()` until a user gesture event. iOS Safari is particularly strict: even after a user tap, `play()` returns a rejected promise. Desktop browsers are more lenient, so the bug goes unnoticed during development.

The GDD specifies using Howler.js with "after first user interaction" audio context activation. This is the right approach, but a common mistake is activating the wrong gesture (e.g., the admin "Start Game" button instead of the player "Join" button), or assuming that one gesture unlocks audio for all future sounds.

**How to avoid:**
1. Use Howler.js or the Web Audio API directly (not bare `<audio>` elements). Howler.js handles mobile autoplay quirks across browsers.
2. Unlock audio in the *player's* first tap — the "Join" button `onClick` handler, not the admin's "Start Game" action.
3. In the unlock handler: create an `AudioContext`, call `resume()`, play a silent buffer, then immediately pause. This permanently enables audio for the session.
4. Test on real iOS Safari and Android Chrome. Desktop Chrome with DevTools' "Autoplay" simulation is not sufficient.
5. Have a visual fallback: if audio is blocked (detectable via `AudioContext.state === 'suspended'`), show a subtle "Tap to enable sound" indicator even during the game.
6. Bundle audio in `public/sounds/` using both `.mp3` and `.ogg` formats for browser compatibility.

**Warning signs:**
- Game sounds work on desktop but are silent on iPad during testing
- `Unhandled Rejection: DOMException: play() can only be initiated by a user gesture` in mobile Safari console
- `AudioContext.state === 'suspended'` on the player device
- Tick sound plays inconsistently -- sometimes works, sometimes not

**Phase to address:**
Audio and Polish — audio implementation must be tested on target devices (tablets), not just the dev laptop. Include audio unlock as a named, tested function before game start.

---

### Pitfall 5: Captive Portal / "No Internet" WiFi Rejection

**What goes wrong:**
Players connect to the booth's local WiFi hotspot. Their phone or tablet shows "Connected, no internet" and either disconnects automatically or shows a persistent warning banner. Players don't know how to proceed. Some Android devices even redirect to a captive portal login page that doesn't exist, or show a "Sign in to network" notification that overrides the browser. Booth staff spend time explaining "just ignore the warning" instead of running games.

**Why it happens:**
Modern mobile OSes (iOS 11+, Android 11+) actively detect whether a WiFi network provides internet access. They send probes to known endpoints (e.g., `connectivitycheck.gstatic.com` for Android, `captive.apple.com` for iOS). If those probes fail, the OS:
- Android 11+: Shows "No internet" and may disconnect WiFi after a timeout, or require tapping "Use this network as is"
- iOS: Shows "No Internet Connection" banner in Safari and may not route traffic correctly
- Both: Periodically re-probe, causing brief connectivity interruptions

The booth's Docker Compose server does not respond to these probes, so the OS correctly identifies "no internet." Users don't know they need to override this.

**How to avoid:**
1. Configure the hotspot's DNS (dnsmasq or equivalent) to resolve known captive portal probe domains to the laptop's local IP and return the expected HTTP 204 response. This tricks the OS into believing the network has internet, and it stays connected without warnings.
2. For Android: serve a `generate_204` endpoint at `/` that returns HTTP 204. For iOS: serve `/hotspot-detect.html` that returns a valid small HTML page.
3. Use a dedicated portable router (e.g., GL-iNet) for the booth hotspot rather than the laptop's built-in hotspot. These routers can be configured with DNS redirection and captive portal bypass.
4. Add clear signage: "Connect to WiFi 'Duelya-chisel', then open browser and go to `game.local`" (or whatever address). Include a QR code.
5. Test with a real Android phone and real iPhone at the venue during setup — not just with a laptop.
6. Host the game on a non-standard port only if you control the router; otherwise use port 80 to avoid issues.

**Warning signs:**
- Android device shows "Sign in to network" notification after connecting to booth WiFi
- iOS shows "No Internet Connection" banner at the top of the game page
- Players' devices randomly disconnect from WiFi during gameplay
- Chrome shows a "No internet" Dinosaur game interstitial when trying to reach the game server
- Works on laptops but fails on phones/tablets

**Phase to address:**
Deployment / Pre-Conference Hardening — this is a network configuration issue, not a code issue. Must be tested at the venue before the conference opens. Cannot be fully reproduced in dev.

---

### Pitfall 6: State Loss From Task Cancellation on WebSocket Disconnect

**What goes wrong:**
A game is in progress. One player's tablet battery dies or the browser crashes. The server's WebSocket handler raises `WebSocketDisconnect` and cleanup code runs. But the cleanup code performs critical writes (save game result to database, update stats) that get cancelled mid-execution because Uvicorn cancels the task immediately after the disconnect is processed. The game result is lost, and stats are corrupted.

**Why it happens:**
When a WebSocket disconnects, Uvicorn cancels the asyncio task running the endpoint. Any `await` points in the cleanup code (e.g., `await db.commit()`, `await websocket.close()`) raise `asyncio.CancelledError`. The `except` or `finally` block starts but never completes its async operations.

This is documented in FastAPI Discussion #11244 and the uvicorn-disconnect-cleanup bug: newer Uvicorn versions may not wait for cleanup coroutines after disconnect. The cleanup code looks correct in a review but silently fails.

**How to avoid:**
1. Wrap critical cleanup DB operations in `asyncio.shield()`:
```python
except WebSocketDisconnect:
    await asyncio.shield(save_game_result_to_db(game_id, result))
```
2. Alternatively, push cleanup writes to a background queue that survives the task:
```python
cleanup_queue.put_nowait({"game_id": game_id, "result": result})
# Worker coroutine processes this outside any WebSocket task
```
3. Keep the database write outside the WebSocket handler entirely: emit a "game end" event to a state machine that persists results, rather than trying to write from the disconnected handler.
4. Use `try/finally` for cleanup that does not involve `await` — synchronous cleanup of in-memory state is safe. Only async DB writes are vulnerable.

**Warning signs:**
- Game results not recorded in database after a player disconnect mid-game
- Statistics count does not increment even though the game completed
- Server logs show `Task was destroyed but it is pending` warnings
- `asyncio.CancelledError` tracebacks in logs without corresponding cleanup success

**Phase to address:**
Core Game Loop — implement the persistence architecture (shield or queue-based) when designing game state save logic. Retrofitting is risky.

---

### Pitfall 7: Input `type="number"` Mobile Keyboard Disaster

**What goes wrong:**
On a tablet, the player taps the answer field. The numeric keyboard appears but with extra keys (decimal point, minus sign -- neither valid for 0..1,000,000 integer input). The keyboard covers half the timer and question text. When the player starts typing, the page scrolls unpredictably. The spinner arrows on the field let them accidentally change the value by scrolling. The autofocus doesn't work on iOS Safari, so they have to tap manually, losing 2-3 seconds.

**Why it happens:**
The GDD specifies "field input answer" with numeric validation. HTML's `type="number"` is not well-suited for game use on mobile: it shows up/down spinner arrows, allows `e`, `.`, `-` characters in some browsers, and on iOS does not reliably bring up the numeric keypad. iOS Safari also ignores the `autofocus` attribute by design (Apple policy -- keyboard must not auto-open).

**How to avoid:**
1. Use `inputMode="numeric"` instead of `type="number"`. This tells mobile browsers to show the numeric keypad without the spinner UI. This is the modern, correct attribute for integer input.
2. Add `pattern="[0-9]*"` for iOS compatibility.
3. Auto-focus the input manually inside the player's first tap handler (not `autofocus` attribute):
```javascript
const inputRef = useRef(null);
const handleStartTap = () => {
    inputRef.current?.focus(); // Works because it's in a user gesture
};
```
4. For iOS Safari specifically: consider `type="tel"` as fallback -- it opens the numeric keypad reliably on iOS.
5. Sanitize input on every keystroke: strip non-digit characters with `value.replace(/\D/g, '')`.
6. Set `-moz-appearance: textfield` to remove spinner arrows in Firefox.
7. Position the input field high enough on the screen that mobile keyboards don't cover the timer or question text. Reserve the bottom third of the screen for keyboard overlap.
8. Add a custom full-screen numeric keypad overlay for tablet players as a defensive measure. This eliminates all mobile keyboard quirks and gives full control over the input experience.

**Warning signs:**
- iOS Safari does not auto-focus the input field on round start
- Up/down arrows appear on the input field on desktop
- Player accidentally changes the value by scrolling on a laptop touchpad
- Decimal point or minus sign entered despite validation
- Keyboard covers the timer on 10-inch tablets
- Testers on iPad report "I lost time because I had to tap the field"

**Phase to address:**
UI/UX phase -- input field implementation. The input component must be tested on all target devices before the game logic is complete.

---

### Pitfall 8: Serial Broadcast Delay Causes Player Disadvantage

**What goes wrong:**
Player 2 consistently receives game state updates later than Player 1. Over 9 rounds, this accumulates into a measurable disadvantage on timer visibility and result display. Player 2 or their friends notice and complain the game is biased.

**Why it happens:**
The server broadcasts messages using a simple `for` loop:
```python
for ws in [player1_ws, player2_ws]:
    await ws.send_json(message)
```
Player 1's send completes before Player 2's send even starts. With each send taking 5-50ms on WiFi, Player 2 sees everything 5-50ms later. Over 9 rounds (timer ticks + round results + game end = ~50+ messages), the accumulated delay reaches 250ms+.

**How to avoid:**
1. Always broadcast with `asyncio.gather()`:
```python
await asyncio.gather(
    *[ws.send_json(msg) for ws in all_connections],
    return_exceptions=True  # one failure shouldn't kill all sends
)
```
2. For the timer specifically, use the "send end timestamp once, client calculates" approach (see Pitfall 3). This eliminates per-tick broadcast delay entirely.
3. Remove dead connections before broadcasting (use `return_exceptions=True` and clean up failed sends).

**Warning signs:**
- One player consistently reports delays
- Network tab shows messages arriving at different times on the two devices
- Sequential `await` pattern used in broadcast code (code review should catch this)

**Phase to address:**
Core Game Loop -- implement `asyncio.gather()` broadcast from the first WebSocket message that targets multiple clients. This should be in the ConnectionManager utility, not an afterthought.

---

### Pitfall 9: Admin Panel Fails to Fit on Phone Screen

**What goes wrong:**
The booth admin tries to launch a game from their phone. Buttons are too small to tap. The "Start Game" button is below the fold and requires scrolling to find. During the game, the admin can't see both player statuses and the current round on one screen. Importing CSV from a phone is impractical. The booth staff abandons the admin panel and starts manually managing the game by shouting.

**Why it happens:**
The admin panel is designed for desktop or tested only on the developer's large phone. The constraints say "admin uses a phone (portrait, 375px+ width)" but the UI accumulates elements: player 1 card, player 2 card, start button, round display, score, question management tabs, CSV import, statistics. Without deliberate space budgeting for mobile, the interface becomes unuseable.

The web_design.md specifies "minimum touch target 44x44pt" and "no horizontal scroll." These requirements are easy to check but easy to violate when adding features.

**How to avoid:**
1. Prioritize the admin panel layout mobile-first, not desktop-first. The admin is always on a phone; players may be on any device.
2. Enforce minimum touch targets (44x44pt CSS pixels) at the CSS level, not just in guidelines.
3. Design the "Game" tab as the single default view: player statuses + start/restart button + live score. Nothing else.
4. Move question management (add, CSV import, list) to secondary screens/tabs. Do not mix game control and question management on the same view.
5. Test on actual 375px-wide phone emulation. The admin will be standing, holding the phone in one hand, tapping with a thumb -- this is different from seated desktop testing.
6. Add pull-to-refresh or auto-refresh for the game status view. The admin should not need to manually refresh to see current scores.
7. Use a bottom tab bar with 3 tabs: "Game", "Questions", "Stats". Max 5 tabs for thumb reach.

**Warning signs:**
- Admin interface has horizontal scroll on 375px viewport
- Touch targets smaller than 44x44px measured in CSS pixels
- Admin needs to scroll to reach "Start Game" button
- CSV import flow requires scrolling through a file preview on a phone screen
- Buttons overlap or text truncates on small viewports

**Phase to address:**
UI/UX phase -- admin panel must be designed and implemented mobile-first. This is not a "we'll fix it later" issue; the admin panel's entire usage context is a phone.

---

### Pitfall 10: Round Restart Race Condition

**What goes wrong:**
The admin taps "Restart" during or immediately after a round. The server resets state but one player's client still has the old WebSocket message in flight. The player sees a brief flash of wrong data (old round superimposed on new game), or the client crashes on inconsistent state. In the worst case, the new game starts with one player still showing the previous game's result screen, and that player misses Round 1 entirely.

**Why it happens:**
WebSocket messages are asynchronous and not transactional. A "restart" command triggers server-side state reset and broadcasts `game_reset` to clients. But messages already in the WebSocket pipeline (e.g., `round_result` from the previous round) arrive at the client after `game_reset`. The client processes them in order and overwrites the clean state with stale data.

**How to avoid:**
1. Use message sequence numbers. Each server message includes a `seq` (monotonically increasing). The client tracks the last processed `seq` and ignores messages older than the current game session.
2. On server restart, increment a `game_session_id`. The client stores this ID and ignores any message that doesn't match the current session ID.
3. Server-side: flush pending messages before sending `game_reset`. Use a simple drain mechanism or a per-connection send queue that can be cleared.
4. Client-side: process state transitions through a state machine. A `game_reset` event transitions to `WAITING_FOR_PLAYERS` state regardless of current state. Incoming messages that don't match the expected state for the current phase are dropped.
5. Add a small delay (200ms) between sending `game_reset` and sending the new game `session_start` to allow clients to process the reset first.
6. Disable the "Restart" button while a game is in progress. Only enable it when the game has fully ended (result screen displayed). This eliminates the mid-round restart scenario.

**Warning signs:**
- After restart, one player's screen shows data from the previous game
- Client console logs show messages being processed in wrong order
- Timer display shows incorrect values after restart
- Player names appear swapped or duplicated after restart
- Admin sees different scores on the two player screens after restart

**Phase to address:**
Core Game Loop -- implement session IDs or sequence numbers in the WebSocket protocol design before the first round runs. Also addressed in UI/UX for the Restart button timing constraints.

---

### Pitfall 11: Hotspot Client Isolation (AP Isolation) Blocks Game Traffic

**What goes wrong:**
Both players connect to the booth's WiFi hotspot. They can both reach the server (it's on the hotspot host). But when the server sends WebSocket messages to Player A and Player B, the messages reach only one player. The game appears broken -- one player sees everything, the other sees nothing. Or both connect but cannot see each other's join status.

**Why it happens:**
Many WiFi hotspots (especially those created by laptops or travel routers) enable "AP Isolation" or "Client Isolation" by default. This prevents WiFi clients from communicating with each other. In a star topology where the server is on the same machine as the hotspot, the server can send to both clients, but the hotspot may not route packets correctly between the virtual network interfaces. Some implementations block non-ARP traffic between wireless clients entirely.

Additionally, Docker's default bridge network can interact badly with hotspot routing. Docker containers are on a separate subnet (172.17.0.0/16), and the hotspot's DHCP may not route to that subnet correctly.

**How to avoid:**
1. Configure the hotspot to disable client isolation. On Linux with hostapd, ensure `ap_isolate=0` (or omit it, as 0 is default). On macOS, the built-in sharing hotspot does not isolate clients. On Windows, check "Allow other network users to connect."
2. If using a dedicated portable router, disable "AP Isolation" / "Client Isolation" in its settings.
3. Make the server container use `--network host` mode to avoid Docker NAT issues. The server binds directly to the host's network interfaces.
4. Alternatively, publish the server port to the host (`-p 8000:8000`) and ensure clients connect to the host machine's IP on the hotspot subnet, not to a Docker bridge IP.
5. Test with two real mobile devices simultaneously at the venue. A single device test will not reveal client isolation.
6. Verify: Player A can reach Player B via the server. Admin can see both. If the server sees both WebSocket connections but one player never receives messages, AP isolation is likely the cause.

**Warning signs:**
- One player connects but never sees "Player 2 joined" in the lobby
- Admin panel shows only 1 of 2 players connected
- Server logs show both WebSocket connections open, but one player reports "no game state received"
- Both devices connect to WiFi but 1 of 2 cannot reach the server IP at all
- Works when tested with a laptop + phone but fails with 2 phones

**Phase to address:**
Deployment / Pre-Conference Hardening -- this must be tested with the actual hotspot hardware and all target device types before the conference. Cannot be reproduced in localhost dev.

---

### Pitfall 12: Audio Desync -- Tick Sound Lags Behind Timer Display

**What goes wrong:**
The timer counts down on screen, but the tick sound plays at the wrong moment. The tick is either noticeably delayed (sound comes after the visual tick) or accelerates at the wrong time (fast tick plays for 4 seconds instead of 3). The booth experience feels unpolished and amateurish.

**Why it happens:**
The GDD specifies client-side audio triggered by WebSocket `timer_tick` events. But WebSocket messages have variable latency, even on local WiFi. If the client plays the tick sound upon receiving the message, and the message arrives 30ms late, the sound is 30ms out of sync with the visual timer.

A subtler issue: `requestAnimationFrame` callbacks for the visual timer run at ~60fps (16ms intervals), but `setTimeout` or `setInterval` for audio scheduling can drift. When both are independently scheduled, they desync.

**How to avoid:**
1. Drive both the visual timer and audio from the same source of truth: the client-calculated remaining time. At round start, the server sends `{"event": "round_start", "end_timestamp": <server_time + 10s>}`. The client computes `remaining = end_timestamp - Date.now()` in each animation frame and plays tick sounds based on the locally calculated remaining time, not on incoming messages.
2. For the tick sound, schedule it precisely using the Web Audio API's `AudioContext.currentTime`, not `setTimeout`. This gives sub-millisecond accuracy for audio playback timing.
3. Use Howler.js `sprite` feature to define precise audio regions for tick and fast_tick, avoiding repeated HTTP requests.
4. If per-second ticks are desired, trigger them in the `requestAnimationFrame` loop when `remaining` crosses an integer boundary (e.g., when `Math.floor(remaining)` changes).
5. Add a 50ms "grace period" (play the tick sound when remaining crosses the threshold, not at the exact second boundary) to mask any rounding issues.

**Warning signs:**
- Tick sound is audible after the visual number has already changed
- Fast tick (last 3 seconds) starts visibly later than the timer color change
- On some devices, the tick rhythm is irregular or stutters
- The game feels less polished than expected during playtesting

**Phase to address:**
Audio and Polish -- audio-visual sync must be tested on target hardware. The timing architecture (end_timestamp approach vs per-event ticks) should be decided during Core Game Loop phase before audio is implemented.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| In-memory game state without DB persistence | Faster development, no DB schema complexity | Game progress lost on server restart; no recovery if laptop crashes mid-game | Acceptable for MVP. Before conference deployment, add result persistence to statistics. |
| Sequential WebSocket broadcast (`for ws in list: await ws.send()`) | Simple, readable code, no `asyncio.gather` complexity | Player 2 gets 50-500ms accumulated disadvantage per game | Never acceptable -- use `gather` from day one. The fix is a one-liner. |
| Global `ConnectionManager` singleton | Easy access from any handler | Tests become stateful; reconnection logic is harder to reason about | Acceptable for this project's scale (1 server, 3-4 connections). No plan to scale. |
| No session IDs on WebSocket messages | Simpler protocol, less bytes on wire | Restart race condition (Pitfall 10) is harder to fix without them | Acceptable only if restart button is disabled during games. Add session IDs if mid-game restart is needed. |
| Sound effects via `<audio>` elements instead of Web Audio API | Simpler code, no AudioContext management | Mobile autoplay issues, no concurrency for overlapping sounds, no precise scheduling | Never acceptable for a game with multiple sound effects + timer sync. Use Howler.js or Web Audio API. |
| Server sends `timer_tick` every second | Simple implementation, easy to reason about | Variable latency desyncs audio and visual; per-tick overhead | Acceptable for initial build. Switch to end_timestamp approach before Audio and Polish phase. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| React re-render on every WebSocket message | Timer animation stutters, input lag, high CPU on player devices | Use `useRef` for WebSocket message buffer, flush to state via `requestAnimationFrame`; split game state into separate atoms (timer, score, round result) | 3+ concurrent games or 10+ WebSocket messages/second without buffering |
| Sound file size for low-end devices | Click/pop on first playback due to buffering delay on tablet | Preload sounds on first user interaction; use short (0.1-0.3s) audio files; compress to 64kbps for tick sounds | Any tablet or low-end laptop in the booth setup |
| CSS animation on `left`/`top` for timer countdown | Timer animation stutters, especially on integrated GPUs | Use `transform: rotate()` for circular progress bar; use `opacity` for transitions; animate only composite properties | Any device in the booth -- avoid layout-triggering properties entirely |
| Large CSV import locking the database | Admin panel hangs for seconds during CSV import; game stutters if running concurrently | Process CSV rows in small batches (50-100); release DB lock between batches; use single-writer queue | CSV import with 200+ questions during active gameplay |
| No debounce on answer input field | Multiple rapid answer submissions processed incorrectly; server waste processing stale submissions | Disable/debounce the submit button after first press; validate server-side and ignore duplicates | Any scenario where a player double-taps or holds the enter key |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No admin authentication on REST endpoints | Anyone on the local WiFi can add/delete questions, view stats, or interfere with the game | Add a simple shared secret or session cookie for admin endpoints. The risk is low (local WiFi only) but the fix is trivial. |
| No validation of WebSocket message `event` type | Player could send `{"event": "admin_start"}` or `{"event": "force_win"}` | Server must validate every message against allowed player actions. Ignore or reject messages with `event` types that the client role is not permitted to send. |
| No rate limiting on answer submission | Player could script 10,000 rapid answer submissions, flooding the server | Add a simple per-player cooldown (one answer per round, ignore duplicates). Rate-limit WebSocket messages per connection. |
| CSV import file path traversal | Malicious CSV filename could overwrite server files | Use `tempfile` module for uploaded files; never use the original filename for storage; validate file extension. |
| No input sanitization on nicknames | XSS through a malicious nickname (`<script>alert(1)</script>`) displayed on another player's or admin's screen | Sanitize all displayed strings: escape HTML entities in React (do NOT use `dangerouslySetInnerHTML`), enforce max length (15 chars). React's default JSX escaping already prevents XSS in most cases. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No connection status indicator | Players don't know if the game froze or they disconnected. They refresh the page and lose their nickname. | Show a persistent connection indicator: green dot = connected, yellow = reconnecting, red = disconnected with "Reconnecting..." text. |
| Sudden round transition (no countdown between rounds) | Players are caught off guard when a new question appears while they're still looking at the previous result | Add a visible "Next round in 3..." countdown between rounds, synchronized with the audio cue. |
| No visual feedback for answer submission | Player types an answer but doesn't know if it was received. They type again, creating duplicate submissions. | Visually confirm the answer: change input border color, show a checkmark, or display a brief "Answer saved!" indicator. |
| No feedback when admin restarts | Players sitting at their screens see the game vanish and go back to the nickname screen without explanation | Show a brief toast or overlay: "Game ended by host. New game starting..." before returning to the lobby. |
| Field allows non-numeric characters on some keyboards (mobile) | Player enters "1,000" (with comma) or "1.5" and the server rejects it, but the player doesn't know why | Client-side sanitization: strip everything except digits on every keystroke. Show inline validation error if sanitization removes characters. |
| No visible player assignment (who is Player 1 vs Player 2) | Players don't know which colored side they are on. They answer thinking they're blue but the game shows orange for them. | Show the player's assigned color prominently on the game screen. Match colors to seating position if known. |
| Admin panel stats show "0 games played" immediately after first game | The admin doesn't know if the game was recorded. They might restart unnecessarily. | Show a brief success toast: "Game saved! Total: 1" after each game completes. Update stats view automatically. |
| No input method for "I don't know" | Player has to type a random number or leave the field blank. A blank submission feels broken. | Accept empty submission as "no answer." Show a clear "No answer submitted" on the results screen so it feels intentional. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Sound effects**: Works on the dev laptop. Fails on mobile due to autoplay policy. Verify with Howler.js or Web Audio API unlock on the actual tablet model used at the booth. Check that ALL four sounds (tick, fast_tick, round_end, winner) play correctly, not just the first one.
- [ ] **Timer synchronization**: Both player screens show the same countdown at the same time. Verify by recording both screens on video and frame-advancing to compare timer values. If they differ by more than 100ms, fix the sync approach.
- [ ] **Admin panel touch targets**: All buttons appear correctly sized in the browser. Verify on an actual phone (375px viewport) with thumb tapping. A 44x44px button that overlaps another element or is obscured by the browser chrome does not count.
- [ ] **Offline operation**: The app loads and works without internet. Verify by disconnecting the laptop from all networks, enabling the hotspot, and testing from a client. Check that no CDN resources (fonts, icons, libraries) are requested.
- [ ] **Docker Compose single-command startup**: `docker compose up` works on a fresh machine with no pre-installed dependencies. Verify on a clean laptop. Check that SQLite database directory exists and is writable by the container user.
- [ ] **Game restart cycle**: The full flow (join, play 9 rounds, see results, admin restarts, join again) works without any page refresh. Verify 3 consecutive restart cycles. Check that the admin does not need to reload the admin panel.
- [ ] **CSV import with Cyrillic text**: Russian question text in CSV imports correctly. Check encoding: UTF-8 with BOM for Excel compatibility. Verify that `вопрос` displays correctly in the admin panel questions list.
- [ ] **Empty answer submission**: If a player submits nothing (field blank, time expires), the game handles this gracefully. Verify: the player's answer shows as "No answer" (not 0 -- 0 could be a valid answer), scoring treats no-answer correctly (farthest from correct), and the results screen does not crash.
- [ ] **Browser back button**: The player accidentally presses the browser back button. Verify that this does not disconnect from the game or cause a confusing state. Use `history.replaceState` or prevent back navigation during active game.
- [ ] **Multiple simultaneous admin panels**: Two booth staff open the admin panel on their phones. Verify that both see the same data and that starting a game from one panel does not desync the other. Consider disabling game control from the second admin panel (show controls only on the first opener).
- [ ] **Concurrent games on the same server**: While not in the spec, verify what happens if two game sessions are attempted simultaneously (two admins, four players). The app should at minimum not crash, even if it does not support this use case.
- [ ] **Screen sleep / display timeout**: Tablets used by players may have aggressive screen sleep settings. Verify that the game prevents screen sleep during active play (use the Screen Wake Lock API). Test on the actual tablet models.
- [ ] **Responsive layout for rotated tablet**: Player rotates their tablet to portrait. Verify that the game screen still functions, even if suboptimally. The game should not break, lose elements, or become unplayable.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SQLite database locked | LOW | Kill the blocking transaction. On the server, restart the container (`docker compose restart`). Verify WAL mode is enabled to prevent recurrence. |
| WebSocket zombie connections accumulate | LOW | Restart the FastAPI server. Player devices reconnect on the next game. More than a band-aid: fix the disconnect detection in code. |
| Audio not playing on tablet | MEDIUM | Add "Tap to Enable Sound" button that calls `AudioContext.resume()`. If Howler.js is used, call `Howler.ctx.resume()`. |
| Players cannot connect to hotspot (captive portal) | MEDIUM | Have a printed instruction card at the booth: "Connect to WiFi 'Duelya-chisel', tap 'Use this network as is' on Android, then open browser to `game.local:8000`". Deploy a QR code linking to the game URL. |
| Game state corrupted mid-game | HIGH | Admin clicks "Restart" to reset all state. Lost game is not recoverable. Prevention: implement session IDs and message sequence numbers. |
| Docker Compose fails on booth laptop | HIGH | Have a fallback: run the server directly (no Docker) with `uvicorn main:app`. Pre-test this path. Have the commands in a script. Better: test Docker on the booth laptop in advance. |
| Server crashes during active game | HIGH | Games in progress are lost. After restart, players reconnect via admin restart. To minimize: run `--workers 1` for stability, add a health check endpoint, have a supervisor (systemd or Docker restart policy) that auto-recovers. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebSocket zombie connections (1) | Core Game Loop | Unit test: simulate disconnect, verify `active_connections` count decreases. Integration test: close browser tab, verify server detects it within 30 seconds. |
| SQLite locked (2) | Foundation | Verify `PRAGMA journal_mode=WAL` returns `wal` on every connection. Stress test with 3 simultaneous write requests. |
| Timer drift/desync (3) | Core Game Loop | Review: end_timestamp approach vs per-tick approach chosen. Test: two devices side-by-side, timer difference < 50ms at all times. |
| Audio blocked on mobile (4) | Audio and Polish | Verify on target tablet: sound plays after first tap. Verify `AudioContext.state` transitions to `running`. |
| Captive portal rejection (5) | Pre-Conference Hardening | Test with real Android and iPhone at venue. Verify: connect to hotspot, no "Sign in" notification appears, game loads in browser. |
| Task cancellation kills DB writes (6) | Core Game Loop | Code review: `asyncio.shield()` or queue-based persistence used for game result save. Integration test: kill client mid-game, verify result saved. |
| Mobile keyboard disaster (7) | UI/UX | Test on all target devices: iPad, Android tablet, phone. Verify: numeric keypad opens, no spinner arrows, autofocus works after first tap. |
| Serial broadcast delay (8) | Core Game Loop | Code review: `asyncio.gather()` used. Test: timing measurements show <5ms gap between two clients receiving the same message. |
| Admin panel unusable on phone (9) | UI/UX | Test on actual phone: "Start Game" visible without scrolling, all touch targets >= 44x44px, no horizontal scroll. |
| Restart race condition (10) | Core Game Loop | Integration test: restart mid-round, verify both clients show clean state. Verify no stale messages processed after restart. |
| AP isolation blocks traffic (11) | Pre-Conference Hardening | Test with two real mobile devices connected to the actual hotspot. Verify both receive WebSocket messages. |
| Audio desync (12) | Audio and Polish | Verify: audio plays within 16ms of visual timer change on target tablet. Use video recording for verification. |

---

## Sources

- FastAPI issue #3008 -- WebSocket disconnect detection gap (websocket.client_state always returns CONNECTED) (GitHub)
- FastAPI discussion #11008 -- WebSocketDisconnect only raises on receive(), not send() (GitHub)
- FastAPI discussion #11244 -- WebSocket cleanup task cancellation after disconnect (GitHub)
- dev.to "I Built an Offline Kahoot Clone" -- KahootP2P lessons on offline quiz game architecture (dev.to/midopooler)
- dev.to "FastAPI WebSockets: Async Connections, Scaling, The Multi-Worker Nightmare (2026)" -- Multi-worker state isolation (dev.to/kaushikcoderpy)
- MDN "Audio for Web Games" -- Mobile autoplay policy, Web Audio API vs HTMLAudioElement (developer.mozilla.org)
- GitHub issue #209 -- sqlite blocking calls in FastAPI background tasks (GitHub)
- pytroubles.com "Fix FastAPI + SQLite 'database is locked'" -- WAL mode + async SQLAlchemy (pytroubles.com)
- Stack Overflow "How to make concurrent writes in SQLite with FastAPI + SQLAlchemy" (stackoverflow.com)
- raw.githubusercontent.com/thebeebs/Content -- "Reasons your demos will fail at a conference" (conference demo pitfalls)
- dev.to "60 FPS with 600 Snakes" -- React WebSocket re-render performance (dev.to/linmingren)
- dev.to "Streaming Backends & React: Controlling Re-render Chaos" -- WebSocket + React performance (sitepoint.com)
- WebKit bug #307115 -- autofocus not working on iOS Safari (webkit.org)
- CreateJS SoundJS Documentation -- Mobile-safe audio patterns (createjs.com)
- Android captive portal detection behavior changes in Android 11+ (stackoverflow.com)
- SQLite WAL mode documentation (sqlite.org/wal.html)
- FastAPI WebSocket guide (websocket.org)

---
*Pitfalls research for: Number Duel (Duel of Numbers) conference booth quiz game*
*Researched: 2026-05-28*
