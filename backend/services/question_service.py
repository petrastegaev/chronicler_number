from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Question


class QuestionService:
    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(Question).order_by(Question.id).offset(skip).limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, question_id: int):
        result = await db.execute(
            select(Question).where(Question.id == question_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, text: str, answer: int, category: str = None):
        question = Question(text=text, answer=answer, category=category)
        db.add(question)
        await db.commit()
        await db.refresh(question)
        return question

    @staticmethod
    async def delete(db: AsyncSession, question_id: int):
        question = await QuestionService.get_by_id(db, question_id)
        if question:
            await db.delete(question)
            await db.commit()
            return True
        return False

    @staticmethod
    async def random_selection(db: AsyncSession, count: int = 9):
        result = await db.execute(
            select(Question).order_by(func.random()).limit(count)
        )
        return result.scalars().all()
