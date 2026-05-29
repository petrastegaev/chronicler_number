from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import QuestionCreate, QuestionResponse
from services.question_service import QuestionService

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.get("/", response_model=list[QuestionResponse])
async def list_questions(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await QuestionService.get_all(db, skip=skip, limit=limit)


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: int, db: AsyncSession = Depends(get_db)):
    question = await QuestionService.get_by_id(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.post("/", response_model=QuestionResponse, status_code=201)
async def create_question(data: QuestionCreate, db: AsyncSession = Depends(get_db)):
    return await QuestionService.create(
        db, text=data.text, answer=data.answer, category=data.category
    )


@router.delete("/{question_id}", status_code=204)
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await QuestionService.delete(db, question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")
