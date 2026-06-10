import csv
import io

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Question


MAX_ROWS = 5000


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

    @staticmethod
    async def csv_import(db: AsyncSession, file_content: bytes) -> dict:
        """Parse CSV content, validate each row, and import valid questions.

        Expected CSV format: text,answer[,category]
        Returns: {"added": int, "errors": list[str]}
        """
        added = 0
        errors: list[str] = []

        reader = csv.reader(io.StringIO(file_content.decode("utf-8-sig")))
        for row_num, row in enumerate(reader, start=1):
            # Skip empty rows
            if not row or all(cell.strip() == "" for cell in row):
                continue

            if len(row) < 2:
                errors.append(f"Строка {row_num}: недостаточно полей")
                continue

            text = row[0].strip()
            if not text:
                errors.append(f"Строка {row_num}: Пустой текст вопроса")
                continue

            answer_str = row[1].strip()
            try:
                answer = int(answer_str)
            except (ValueError, TypeError):
                errors.append(f"Строка {row_num}: Ответ не является целым числом")
                continue

            if not (0 <= answer <= 1_000_000):
                errors.append(f"Строка {row_num}: Ответ вне диапазона (0-1 000 000)")
                continue

            category = row[2].strip() if len(row) > 2 and row[2].strip() else None
            if category is not None and len(category) > 255:
                errors.append(f"Строка {row_num}: Категория слишком длинная")
                continue

            await QuestionService.create(db, text=text, answer=answer, category=category)
            added += 1

            if added >= MAX_ROWS:
                errors.append(f"Import stopped: maximum {MAX_ROWS} rows exceeded")
                break

        return {"added": added, "errors": errors}
