from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from auth import verify_admin_key
from database import get_db
from models import Stat
from schemas import LeaderboardEntry, LeaderboardResponse, StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db), _: bool = Depends(verify_admin_key)):
    result = await db.execute(select(Stat).limit(1))
    stat_record = result.scalar_one_or_none()
    if stat_record:
        return StatsResponse(game_count=stat_record.game_count)
    return StatsResponse(game_count=0)


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    """Return top players ranked by wins, then win rate."""
    query = text("""
        WITH player_appearances AS (
            SELECT
                player1_nickname AS nickname,
                player1_score AS score,
                CASE WHEN winner_nickname = player1_nickname AND winner_nickname IS NOT NULL THEN 1 ELSE 0 END AS is_win
            FROM game_sessions
            UNION ALL
            SELECT
                player2_nickname AS nickname,
                player2_score AS score,
                CASE WHEN winner_nickname = player2_nickname AND winner_nickname IS NOT NULL THEN 1 ELSE 0 END AS is_win
            FROM game_sessions
        )
        SELECT
            nickname,
            COUNT(*) AS games_played,
            SUM(is_win) AS wins,
            COUNT(*) - SUM(is_win) AS losses,
            ROUND(CAST(SUM(is_win) AS FLOAT) / COUNT(*), 3) AS win_rate,
            SUM(score) AS total_score
        FROM player_appearances
        GROUP BY nickname
        ORDER BY wins DESC, win_rate DESC
        LIMIT :limit
    """)
    result = await db.execute(query, {"limit": limit})
    rows = result.fetchall()

    entries = [
        LeaderboardEntry(
            rank=i + 1,
            nickname=row.nickname,
            games_played=row.games_played,
            wins=row.wins,
            losses=row.losses,
            win_rate=row.win_rate,
            total_score=row.total_score,
        )
        for i, row in enumerate(rows)
    ]

    return LeaderboardResponse(entries=entries)
