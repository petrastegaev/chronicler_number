import asyncio
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update

from connection_manager import ConnectionManager
from models import GameSession as GameSessionModel, Round, Stat


class GameSession:
    """Server-authoritative game state machine. Singleton -- one game at a time."""

    def __init__(self, manager: ConnectionManager, session_factory):
        self.manager = manager
        self.session_factory = session_factory
        self.state = "waiting_for_players"
        self.questions: list = []
        self.current_round: int = 0
        self.p1_score: int = 0
        self.p2_score: int = 0
        self.p1_answer: Optional[int] = None
        self.p2_answer: Optional[int] = None
        self.round_results: list[dict] = []
        self._remaining: int = 10
        self.answer_deadline: float = 0.0
        self.start_event = asyncio.Event()

    async def run(self, questions: list):
        """Main game loop. Launched via asyncio.create_task()."""
        self.questions = questions
        # Snapshot nicknames at game start so a mid-game disconnect (which nulls
        # manager.playerN_nickname) cannot blank the persisted/broadcast names (BUG-NICKNAME-NULL).
        self.player1_nickname = self.manager.player1_nickname or ""
        self.player2_nickname = self.manager.player2_nickname or ""
        self.state = "ready"

        await self.manager.broadcast({
            "event": "game_started",
            "data": {
                "player1_nickname": self.player1_nickname,
                "player2_nickname": self.player2_nickname,
            }
        })

        # Wait for admin to start the game
        await self.start_event.wait()
        self.start_event.clear()

        for round_num in range(1, 10):
            self.current_round = round_num
            question = self.questions[round_num - 1]
            await self._run_round(question)

        await self._finish_game()

    async def _run_round(self, question):
        """Execute a single round: present question, tick timer, show result."""
        self.p1_answer = None
        self.p2_answer = None
        self.state = "presenting_question"

        # Broadcast round_started to all
        await self.manager.broadcast({
            "event": "round_started",
            "data": {
                "round_number": self.current_round,
                "total_rounds": 9,
                "question_text": question.text,
            }
        })
        self.state = "accepting_answers"
        self.answer_deadline = time.monotonic() + 10.0 + 0.05

        # Timer: 10 seconds, tick every 1 second (11 ticks: 10 down to 0)
        for remaining in range(10, -1, -1):
            await self.manager.broadcast({
                "event": "timer_tick",
                "data": {"remaining": remaining}
            })
            self._remaining = remaining
            if remaining > 0:
                await asyncio.sleep(1)

        # Fairness window: allow in-flight submit_answer calls to be processed
        await asyncio.sleep(0.05)

        # Timer expired -- compute result
        self.state = "showing_result"
        result = self._compute_round_result(question)
        self.round_results.append(result)

        # Broadcast round_result to all
        await self.manager.broadcast({
            "event": "round_result",
            "data": result
        })

        # Update scores
        if result["winner"] == "player1":
            self.p1_score += 1
        elif result["winner"] == "player2":
            self.p2_score += 1

        # Broadcast score_update to admin only
        await self.manager.send_to_admin({
            "event": "score_update",
            "data": {
                "player1_score": self.p1_score,
                "player2_score": self.p2_score,
                "round_number": self.current_round,
            }
        })

        # 3-second pause between rounds
        await asyncio.sleep(3)

    def submit_answer(self, player_num: int, answer: int):
        """Called from the WebSocket event dispatcher. First answer per player wins."""
        if self.state != "accepting_answers":
            return  # Round not active
        if time.monotonic() > self.answer_deadline:
            return  # Beyond fairness window
        if player_num == 1 and self.p1_answer is None:
            self.p1_answer = answer
        elif player_num == 2 and self.p2_answer is None:
            self.p2_answer = answer

    def _compute_round_result(self, question) -> dict:
        """Compute winner by absolute difference proximity scoring."""
        correct = question.answer

        def diff(answer):
            if answer is None:
                return float("inf")
            return abs(answer - correct)

        d1 = diff(self.p1_answer)
        d2 = diff(self.p2_answer)

        if d1 < d2:
            winner = "player1"
        elif d2 < d1:
            winner = "player2"
        else:
            winner = "draw"

        return {
            "round_number": self.current_round,
            "correct_answer": correct,
            "player1_answer": self.p1_answer if self.p1_answer is not None else None,
            "player2_answer": self.p2_answer if self.p2_answer is not None else None,
            "winner": winner,
        }

    async def _finish_game(self):
        """Broadcast game_end with full results and persist to SQLite."""
        self.state = "finished"

        if self.p1_score > self.p2_score:
            winner = self.player1_nickname
        elif self.p2_score > self.p1_score:
            winner = self.player2_nickname
        else:
            winner = None  # "Ничья"

        game_end_data = {
            "player1_nickname": self.player1_nickname,
            "player2_nickname": self.player2_nickname,
            "player1_score": self.p1_score,
            "player2_score": self.p2_score,
            "winner": winner,
            "rounds": [
                {
                    "round_number": r["round_number"],
                    "winner": r["winner"],
                    "player1_answer": r["player1_answer"],
                    "player2_answer": r["player2_answer"],
                }
                for r in self.round_results
            ],
        }

        await self.manager.broadcast({
            "event": "game_end",
            "data": game_end_data,
        })

        # Shield-protected DB persistence
        await asyncio.shield(self._persist_game(winner))

    async def _persist_game(self, winner_nickname: str | None):
        """Persist game results to SQLite. Wrapped in shield to survive task cancellation."""
        async with self.session_factory() as db:
            try:
                game_session = GameSessionModel(
                    player1_nickname=self.player1_nickname,
                    player2_nickname=self.player2_nickname,
                    player1_score=self.p1_score,
                    player2_score=self.p2_score,
                    winner_nickname=winner_nickname,
                    ended_at=datetime.now(timezone.utc),
                )
                db.add(game_session)
                await db.flush()

                for r in self.round_results:
                    q = self.questions[r["round_number"] - 1]
                    round_record = Round(
                        game_session_id=game_session.id,
                        question_id=q.id,
                        round_number=r["round_number"],
                        player1_answer=r["player1_answer"],
                        player2_answer=r["player2_answer"],
                        winner={"player1": 1, "player2": 2, "draw": None}.get(r["winner"]),
                    )
                    db.add(round_record)

                # BUG-06: Use atomic UPDATE to avoid read-then-write race.
                # INSERT the Stat row if it doesn't exist (first run).
                stat = await db.execute(select(Stat).limit(1))
                stat_record = stat.scalar_one_or_none()
                if stat_record is None:
                    db.add(Stat(game_count=1))
                else:
                    await db.execute(
                        update(Stat).where(Stat.id == stat_record.id).values(
                            game_count=Stat.game_count + 1
                        )
                    )

                await db.commit()
            except Exception:
                await db.rollback()
                raise
