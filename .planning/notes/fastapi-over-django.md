---
title: "FastAPI over Django — decision reaffirmed"
date: 2026-05-28
context: Explored switching to Django to reduce complexity.
---

## Decision

**Stick with FastAPI.** Django was considered but rejected.

## Reasoning

- Django's real-time support requires Django Channels + Redis channel layer, which adds more infrastructure than FastAPI's native WebSocket support
- Redis is explicitly listed in "What NOT to Use" (CLAUDE.md) — single-server deployment, no shared-state coordination needed
- The ConnectionManager singleton + native async in FastAPI is significantly simpler for the game-loop architecture (per-second timer ticks, role-based broadcasts)
- Django template HTML5 frontend would work, but the React+Vite scaffold is already planned and delivers a better booth experience (timer animations, sound sync)
- Django admin panel was the most appealing piece, but Phase 4 already covers a custom mobile-first admin

## Key insight

Django's "batteries included" advantage disappears when the core feature (real-time WebSocket game loop) requires opting out of the synchronous request/response model. FastAPI's async-first design IS the simpler choice for this specific problem.
