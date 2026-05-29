import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from connection_manager import ConnectionManager
from models import Base
from routers import questions as questions_router

manager = ConnectionManager()


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

# 2. WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

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
                await websocket.send_json({
                    "event": "joined",
                    "data": {"role": "admin"}
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
                await websocket.send_json({
                    "event": "joined",
                    "data": {"player_number": player_num, "nickname": nickname}
                })

        # Keep connection alive -- detect disconnect via receive loop
        while True:
            await websocket.receive_json()

    except WebSocketDisconnect:
        if manager.player1 == websocket:
            manager.player1 = None
            manager.player1_nickname = None
        elif manager.player2 == websocket:
            manager.player2 = None
            manager.player2_nickname = None
        elif manager.admin == websocket:
            manager.admin = None

# 3. StaticFiles mount MUST be LAST (prevents route shadowing)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
