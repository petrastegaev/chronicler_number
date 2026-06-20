# Fix Testing Swarm Findings

**Date:** 2026-06-20
**Source:** Manual testing swarm (wf_54a3bd9f-7ce)

## Problems to Fix

### Critical (must fix)
1. **SPA fallback broken** — `/nonexistent-page` returns 404 JSON instead of 200 HTML
   - Fix: `backend/main.py` — replace `BaseHTTPMiddleware` with raw ASGI middleware or catch-all route
2. **Client-side reconnect token not stored** — token from `joined` event ignored
   - Fix: `frontend/src/hooks/useWebSocket.ts` — save token to localStorage, pass in WS URL on reconnect

### Medium (should fix)
3. **Wrong admin password — no UI feedback** — form resets silently
   - Fix: `frontend/src/hooks/useAdminWebSocket.ts` — set error state on `onclose` when phase is `connecting`
4. **Whitespace-only nickname — no feedback**
   - Fix: `frontend/src/components/JoinScreen.tsx` — show inline error when trimmed nickname is empty
5. **401 from stats API on admin page mount**
   - Fix: Already handled by silent catch in GameControlTab.tsx; add X-Admin-Key header to the stats request

### Minor (nice to have)
6. **Docker healthcheck** incompatible with auth-required stats — already commented out in Dockerfile
7. **`--graceful-timeout`** → already fixed to use `--timeout-graceful-shutdown` or removed
