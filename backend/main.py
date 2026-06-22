import asyncio
import csv
import io
import logging
import os
import pathlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from connection_manager import ConnectionManager
from models import Base, Question
from routers import questions as questions_router
from routers import stats as stats_router
from typing import Optional

from auth import ADMIN_KEY
from game.session import GameSession
from game.tokens import cleanup_expired_tokens, generate_token, restore_from_token
from services.question_service import QuestionService

# Resolve absolute database path relative to this file, and ensure data directory exists
_DB_DIR = pathlib.Path(__file__).resolve().parent / 'data'
_DB_DIR.mkdir(parents=True, exist_ok=True)
_DATABASE_URL = f'sqlite+aiosqlite:///{_DB_DIR / "game.db"}'

manager = ConnectionManager()
active_session: Optional[GameSession] = None
game_task: Optional[asyncio.Task] = None
game_lock = asyncio.Lock()  # Guards against double-start race (SEC-04, BUG-04)

# Path to seed CSV bundled with the backend
_SEED_CSV = pathlib.Path(__file__).resolve().parent / "seed_data" / "chronicler_questions.csv"


async def _seed_questions(session_factory):
    """Import bundled questions from CSV into the database if the table is empty."""
    if not _SEED_CSV.exists():
        return

    async with session_factory() as db:
        count = (await db.execute(select(func.count(Question.id)))).scalar_one()
        if count > 0:
            return  # Already seeded

        content = _SEED_CSV.read_text(encoding="utf-8-sig")
        reader = csv.reader(io.StringIO(content))
        to_add: list[Question] = []
        skipped = 0

        for row in reader:
            if len(row) < 2:
                skipped += 1
                continue
            text = row[0].strip()
            try:
                answer = int(row[1].strip())
            except (ValueError, IndexError):
                skipped += 1
                continue
            if not text or answer < 0 or answer > 1_000_000:
                skipped += 1
                continue
            category = row[2].strip() if len(row) > 2 and row[2].strip() else None
            to_add.append(Question(text=text, answer=answer, category=category))

        if to_add:
            db.add_all(to_add)
            await db.commit()
            logging.getLogger("uvicorn").info(
                f"[seed] Imported {len(to_add)} chronicler questions (skipped {skipped} rows)"
            )
        else:
            logging.getLogger("uvicorn").warning(
                f"[seed] No valid rows found in {_SEED_CSV.name}"
            )


async def reset_game():
    """Destroy active session, cancel game task, broadcast reset, return to lobby."""
    global active_session, game_task
    async with game_lock:
        if active_session is None or active_session.state in ("waiting_for_players",):
            return
        if game_task is not None and not game_task.done():
            # Broadcast cancellation before killing the task
            await manager.broadcast({
                "event": "game_cancelled",
                "data": {"message": "Игра отменена администратором"}
            })
            game_task.cancel()
            try:
                await game_task
            except asyncio.CancelledError:
                pass
            game_task = None
        active_session = None
        await manager.broadcast({
            "event": "game_reset",
            "data": {"message": "Игра сброшена. Можно начинать заново."}
        })


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    engine = create_async_engine(_DATABASE_URL, echo=False)

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    app.state.engine = engine

    # Seed chronicler questions from bundled CSV (idempotent — skips if table non-empty)
    await _seed_questions(app.state.session_factory)

    # Start periodic token cleanup to prevent unbounded memory growth
    token_cleanup_task = asyncio.create_task(cleanup_expired_tokens())

    yield

    # --- SHUTDOWN ---
    token_cleanup_task.cancel()
    try:
        await token_cleanup_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(title="Duel Chisel", lifespan=lifespan)

# 1. API routes FIRST (before StaticFiles mount)
app.include_router(questions_router.router)
app.include_router(stats_router.router)

# 2. WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global active_session, game_task
    await websocket.accept()

    # Reconnect path: check query param token (JOIN-05 / D-06)
    reconnect_token = websocket.query_params.get("token")
    reconnected = False
    if reconnect_token:
        session_data = restore_from_token(reconnect_token)
        if session_data:
            reconnected = True
            nickname = session_data["nickname"]
            role = session_data["role"]
            if role == "admin":
                manager.admin = websocket
                websocket._reconnect_token = reconnect_token
                await websocket.send_json({
                    "event": "joined",
                    "data": {
                        "role": "admin",
                        "nickname": nickname,
                        "token": reconnect_token,
                        "player1_nickname": manager.player1_nickname,
                        "player2_nickname": manager.player2_nickname,
                    }
                })
            elif role == "player":
                # Reconnect to existing slot by nickname
                if manager.player1_nickname == nickname and manager.player1 is not None:
                    old_ws = manager.player1
                    manager.player1 = websocket
                    websocket._reconnect_token = reconnect_token
                    player_num = 1
                    await old_ws.close()
                elif manager.player2_nickname == nickname and manager.player2 is not None:
                    old_ws = manager.player2
                    manager.player2 = websocket
                    websocket._reconnect_token = reconnect_token
                    player_num = 2
                    await old_ws.close()
                elif manager.player1 is None:
                    manager.player1 = websocket
                    manager.player1_nickname = nickname
                    websocket._reconnect_token = reconnect_token
                    player_num = 1
                elif manager.player2 is None:
                    manager.player2 = websocket
                    manager.player2_nickname = nickname
                    websocket._reconnect_token = reconnect_token
                    player_num = 2
                else:
                    await websocket.send_json({
                        "event": "error",
                        "data": {"message": "Оба игрока уже подключены"}
                    })
                    await websocket.close()
                    return
                await websocket.send_json({
                    "event": "joined",
                    "data": {"role": "player", "player_number": player_num, "nickname": nickname, "token": reconnect_token}
                })
            # Send state snapshot if game is in progress (D-06)
            if active_session is not None and active_session.state not in ("waiting_for_players", "ready", "finished"):
                question_text = active_session.questions[active_session.current_round - 1].text if active_session.questions and active_session.current_round > 0 else None
                await websocket.send_json({
                    "event": "state_snapshot",
                    "data": {
                        "state": active_session.state,
                        "current_round": active_session.current_round,
                        "remaining": getattr(active_session, '_remaining', 10),
                        "question_text": question_text,
                    }
                })
            # Skip join handler -- reconnect complete
            # Continue to event dispatch loop (no re-join needed)
        else:
            await websocket.send_json({
                "event": "error",
                "data": {"message": "Недействительный токен сессии"}
            })
            return

    try:
        if not reconnected:
            # First message must be a join event (D-10)
            data = await websocket.receive_json()
            if data.get("event") == "join":
                role = data.get("data", {}).get("role")
                nickname = data.get("data", {}).get("nickname", "")

                if role == "admin":
                    admin_key = data.get("data", {}).get("admin_key", "")
                    if admin_key != ADMIN_KEY:
                        await websocket.send_json({
                            "event": "error",
                            "data": {"message": "Unauthorized admin access"}
                        })
                        await websocket.close()
                        return
                    if manager.admin is not None:
                        await websocket.send_json({
                            "event": "error",
                            "data": {"message": "Admin slot already taken"}
                        })
                        await websocket.close()
                        return
                    manager.admin = websocket
                    token = generate_token(nickname, "admin")
                    websocket._reconnect_token = token
                    await websocket.send_json({
                        "event": "joined",
                        "data": {
                            "role": "admin",
                            "token": token,
                            "player1_nickname": manager.player1_nickname,
                            "player2_nickname": manager.player2_nickname,
                        }
                    })
                elif role == "player":
                    # Validate nickname (BUG-09: enforce 1-15 char limit)
                    if not nickname or len(nickname.strip()) < 1 or len(nickname) > 15:
                        await websocket.send_json({
                            "event": "error",
                            "data": {"message": "Никнейм должен быть от 1 до 15 символов"}
                        })
                        await websocket.close()
                        return
                    if manager.player_count >= 2:
                        await websocket.send_json({
                            "event": "error",
                            "data": {"message": "Game is full"}
                        })
                        await websocket.close()
                        return
                    player_num = 1 if manager.player1 is None else 2
                    if player_num == 1:
                        manager.player1 = websocket
                        manager.player1_nickname = nickname
                    else:
                        manager.player2 = websocket
                        manager.player2_nickname = nickname
                    token = generate_token(nickname, "player")
                    websocket._reconnect_token = token
                    await websocket.send_json({
                        "event": "joined",
                        "data": {
                            "player_number": player_num,
                            "nickname": nickname,
                            "token": token,
                            "player1_nickname": manager.player1_nickname,
                            "player2_nickname": manager.player2_nickname,
                        }
                    })
                    # Notify admin of player join
                    await manager.send_to_admin({
                        "event": "player_joined",
                        "data": {
                            "player_number": player_num,
                            "nickname": nickname,
                            "player1_nickname": manager.player1_nickname,
                            "player2_nickname": manager.player2_nickname,
                        }
                    })
                    # If player 2 just joined, notify player 1 (JOIN-04)
                    if player_num == 2 and manager.player1 is not None:
                        await manager.send_to_player(1, {
                            "event": "player_joined",
                            "data": {"player_number": 2, "player2_nickname": nickname}
                        })
                else:
                    # Unknown role -- reject and close so the socket never hangs (BUG-UNKNOWN-ROLE)
                    await websocket.send_json({
                        "event": "error",
                        "data": {"message": "Неизвестная роль"}
                    })
                    await websocket.close()
                    return
            else:
                # First message was not a join event -- reject and close (BUG-UNKNOWN-ROLE)
                await websocket.send_json({
                    "event": "error",
                    "data": {"message": "Ожидалось событие join"}
                })
                await websocket.close()
                return

        # Event dispatch loop
        while True:
            msg = await websocket.receive_json()
            event = msg.get("event")
            payload = msg.get("data", {})

            # Keep-alive ping/pong — prevents client heartbeat from firing
            # during quiet periods (e.g. admin sitting in lobby with no messages)
            if event == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
                continue

            # Player event routing
            if websocket in (manager.player1, manager.player2):
                player_num = 1 if websocket == manager.player1 else 2
                if event == "submit_answer":
                    answer = payload.get("answer")
                    if isinstance(answer, int) and 0 <= answer <= 1_000_000:
                        if active_session is not None:
                            active_session.submit_answer(player_num, answer)

            # Admin event routing
            elif websocket == manager.admin:
                if event == "start_game":
                    if manager.player1_nickname and manager.player2_nickname:
                        async with game_lock:
                            # Double-check under lock (BUG-04)
                            if game_task is not None and not game_task.done():
                                continue
                            async with app.state.session_factory() as db:
                                questions = await QuestionService.random_selection(db, 9)
                            if len(questions) < 9:
                                await websocket.send_json({
                                    "event": "error",
                                    "data": {"message": "Недостаточно вопросов. Нужно минимум 9."}
                                })
                                continue
                            active_session = GameSession(manager, app.state.session_factory)

                            async def _run_with_error_handler():
                                try:
                                    await active_session.run(questions)
                                except asyncio.CancelledError:
                                    pass  # Normal cancellation
                                except Exception as e:
                                    import traceback
                                    traceback.print_exc()
                                    await manager.broadcast({
                                        "event": "error",
                                        "data": {"message": f"Критическая ошибка игры: {e}"}
                                    })

                            game_task = asyncio.create_task(_run_with_error_handler())
                            active_session.start_event.set()
                elif event == "restart":
                    await reset_game()
                elif event == "reset_players":
                    # Cancel any running game FIRST so in-flight timer ticks
                    # stop before we close player connections.
                    if game_task is not None and not game_task.done():
                        game_task.cancel()
                        try:
                            await game_task
                        except asyncio.CancelledError:
                            pass
                        game_task = None
                    active_session = None

                    # Notify players, revoke their reconnect tokens, and close.
                    from game.tokens import remove_token

                    for player_ws in (manager.player1, manager.player2):
                        if player_ws:
                            # Revoke the reconnect token so the player can't
                            # auto-reconnect into the just-cleared slot.
                            token = getattr(player_ws, '_reconnect_token', None)
                            if token:
                                remove_token(token)
                            try:
                                await asyncio.wait_for(
                                    player_ws.send_json({
                                        "event": "players_reset",
                                        "data": {"message": "Администратор сбросил игроков"}
                                    }),
                                    timeout=3.0,
                                )
                            except Exception:
                                pass

                    for player_ws in (manager.player1, manager.player2):
                        if player_ws:
                            try:
                                await player_ws.close()
                            except Exception:
                                pass

                    manager.player1 = None
                    manager.player2 = None
                    manager.player1_nickname = None
                    manager.player2_nickname = None

                    await websocket.send_json({
                        "event": "players_reset",
                        "data": {"message": "Игроки сброшены"}
                    })

    except WebSocketDisconnect:
        if manager.player1 == websocket:
            manager.player1 = None
            manager.player1_nickname = None
        elif manager.player2 == websocket:
            manager.player2 = None
            manager.player2_nickname = None
        elif manager.admin == websocket:
            manager.admin = None
            if game_task is not None and not game_task.done():
                # Broadcast cancellation before killing the game (BUG-05)
                await manager.send_to_players({
                    "event": "game_cancelled",
                    "data": {"message": "Администратор отключился. Игра завершена."}
                })
                game_task.cancel()
                try:
                    await game_task
                except asyncio.CancelledError:
                    pass
                game_task = None
                active_session = None

# 3. SPA fallback catch-all route — serves index.html for non-API GET paths
#    that don't match a static file on disk. Registered BEFORE StaticFiles mount
#    so it takes priority over the catch-all static directory handler.
#    Does NOT match root "/" (/{full_path:path} requires at least one path segment).
import os
from fastapi import HTTPException
from fastapi.responses import FileResponse


@app.get("/{full_path:path}")
async def serve_spa_fallback(full_path: str):
    """Catch-all route for SPA client-side routing.

    - API paths (/api/*) → 404 (shouldn't reach here; API routes match first)
    - Real static files → served directly from static/ directory
    - Everything else → index.html for React Router
    """
    # Safety: don't serve anything outside the static directory
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)

    static_dir = os.path.join(os.path.dirname(__file__), "static")
    safe_path = os.path.normpath(full_path)
    if ".." in safe_path.split(os.sep):
        raise HTTPException(status_code=404)

    file_path = os.path.join(static_dir, safe_path)

    # Serve existing static files (fonts, sounds, JS bundles, CSS)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    # SPA route — serve index.html
    index_path = os.path.join(static_dir, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    raise HTTPException(status_code=404)


# 4. StaticFiles mount (must be last) — handles root "/" and directory requests
app.mount("/", StaticFiles(directory="static", html=True), name="static")
