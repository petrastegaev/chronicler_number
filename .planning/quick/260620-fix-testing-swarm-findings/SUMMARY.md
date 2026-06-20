---
status: complete
quick_task: fix-testing-swarm-findings
date: 2026-06-20
---
# Summary: Fix Testing Swarm Findings

**Status:** Complete
**Commits:** ec5691b, f39b797

## Fixed Issues

### Critical
1. **SPA fallback broken** → Replaced `BaseHTTPMiddleware` with catch-all route `/{full_path:path}`. Unknown URLs now serve `index.html` instead of 404 JSON.
2. **Client reconnect token not stored** → Token now saved to `localStorage` on `joined` event and passed as `?token=` URL param on WebSocket reconnect (both player and admin hooks).

### Medium
3. **Wrong admin password — no UI feedback** → Added `authError` field to adminStore. Server error message displayed in login form when authentication fails.
4. **Whitespace-only nickname — no feedback** → JoinScreen now shows inline error "Введите никнейм" when trimmed nickname is empty.

### Minor
5. **Docker healthcheck incompatible with auth** → Removed from Dockerfile.
6. **`--graceful-timeout` invalid option** → Removed from Dockerfile CMD.
