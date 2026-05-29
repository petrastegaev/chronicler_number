import asyncio
from typing import Optional

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.player1: Optional[WebSocket] = None
        self.player2: Optional[WebSocket] = None
        self.admin: Optional[WebSocket] = None
        self.player1_nickname: Optional[str] = None
        self.player2_nickname: Optional[str] = None

    @property
    def player_count(self) -> int:
        count = 0
        if self.player1 is not None:
            count += 1
        if self.player2 is not None:
            count += 1
        return count

    @property
    def all_connections(self) -> list[WebSocket]:
        return [ws for ws in [self.player1, self.player2, self.admin] if ws is not None]

    async def broadcast(self, message: dict):
        tasks = [ws.send_json(message) for ws in self.all_connections]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_player(self, player_num: int, message: dict):
        ws = self.player1 if player_num == 1 else self.player2
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def send_to_players(self, message: dict):
        tasks = []
        if self.player1:
            tasks.append(self.player1.send_json(message))
        if self.player2:
            tasks.append(self.player2.send_json(message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_admin(self, message: dict):
        if self.admin:
            try:
                await self.admin.send_json(message)
            except Exception:
                pass
