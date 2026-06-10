import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from connection_manager import ConnectionManager
from models import Base
from routers import questions as questions_router
from routers import stats as stats_router
from typing import Optional

from game.session import GameSession
from game.tokens import generate_token, remove_token, restore_from_token
from services.question_service import QuestionService

manager = ConnectionManager()
active_session: Optional[GameSession] = None
game_task: Optional[asyncio.Task] = None


async def reset_game():
    """Destroy active session, cancel game task, broadcast reset, return to lobby."""
    global active_session, game_task
    if active_session is None or active_session.state in ("waiting_for_players",):
        return
    if game_task is not None and not game_task.done():
        game_task.cancel()
        game_task = None
    active_session = None
    await manager.broadcast({
        "event": "game_reset",
        "data": {"message": "Game has been reset by admin"}
    })


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    engine = create_async_engine("sqlite+aiosqlite:///data/game.db", echo=False)

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
    yield

    # --- SHUTDOWN ---
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
    if reconnect_token:
        session_data = restore_from_token(reconnect_token)
        if session_data:
            nickname = session_data["nickname"]
            role = session_data["role"]
            if role == "admin":
                manager.admin = websocket
                websocket._reconnect_token = reconnect_token
                await websocket.send_json({
                    "event": "joined",
                    "data": {"role": "admin", "nickname": nickname, "token": reconnect_token}
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
        # First message must be a join event (D-10)
        data = await websocket.receive_json()
        if data.get("event") == "join":
            role = data.get("data", {}).get("role")
            nickname = data.get("data", {}).get("nickname", "")

            if role == "admin":
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
                    "data": {"role": "admin", "token": token}
                })
            elif role == "player":
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
                # If player 2 just joined, notify player 1 (JOIN-04)
                if player_num == 2 and manager.player1 is not None:
                    await manager.send_to_player(1, {
                        "event": "player_joined",
                        "data": {"player2_nickname": nickname}
                    })

        # Event dispatch loop
        while True:
            msg = await websocket.receive_json()
            event = msg.get("event")
            payload = msg.get("data", {})

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
                        # Guard: check game_task lifecycle to prevent double-session race
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
                        game_task = asyncio.create_task(active_session.run(questions))
                        active_session.start_event.set()
                elif event == "restart":
                    await reset_game()

    except WebSocketDisconnect:
        # Clean up reconnect token if tracked
        token = getattr(websocket, '_reconnect_token', None)
        if token:
            remove_token(token)
        if manager.player1 == websocket:
            manager.player1 = None
            manager.player1_nickname = None
        elif manager.player2 == websocket:
            manager.player2 = None
            manager.player2_nickname = None
        elif manager.admin == websocket:
            manager.admin = None
            if game_task is not None and not game_task.done():
                game_task.cancel()
                game_task = None
                active_session = None

# 3. StaticFiles mount MUST be LAST (prevents route shadowing)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
