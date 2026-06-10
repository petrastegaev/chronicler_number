from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Stat
from schemas import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stat).limit(1))
    stat_record = result.scalar_one_or_none()
    if stat_record:
        return StatsResponse(game_count=stat_record.game_count)
    return StatsResponse(game_count=0)
