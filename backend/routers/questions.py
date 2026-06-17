from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth import verify_admin_key
from database import get_db
from models import Question
from schemas import CsvImportResponse, QuestionCreate, QuestionResponse
from services.question_service import QuestionService

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.get("/")
async def list_questions(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin_key),
):
    questions = await QuestionService.get_all(db, skip=skip, limit=limit)
    total = (await db.execute(select(func.count(Question.id)))).scalar_one()
    return {"items": questions, "total": total}


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: int, db: AsyncSession = Depends(get_db), _: bool = Depends(verify_admin_key)):
    question = await QuestionService.get_by_id(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.post("/", response_model=QuestionResponse, status_code=201)
async def create_question(data: QuestionCreate, db: AsyncSession = Depends(get_db), _: bool = Depends(verify_admin_key)):
    question = await QuestionService.create(
        db, text=data.text, answer=data.answer, category=data.category
    )
    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/{question_id}", status_code=204)
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db), _: bool = Depends(verify_admin_key)):
    try:
        deleted = await QuestionService.delete(db, question_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Question not found")
        await db.commit()
    except IntegrityError:
        # FK constraint violation — question is referenced by Round records
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Невозможно удалить вопрос: он используется в истории игр",
        )


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload-csv", response_model=CsvImportResponse)
async def upload_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), _: bool = Depends(verify_admin_key)):
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    result = await QuestionService.csv_import(db, content)
    return CsvImportResponse(**result)
