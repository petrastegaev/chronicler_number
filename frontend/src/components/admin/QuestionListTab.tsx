import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAdminStore } from '../../stores/adminStore'
import { apiFetch } from '../../hooks/apiFetch'
import ConfirmDialog from './ConfirmDialog'
import Toast from './Toast'

interface Question {
  id: number
  text: string
  answer: number
  category: string | null
  created_at: string
}

export default function QuestionListTab() {
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const questions = useAdminStore((s) => s.questions)
  const totalQuestions = useAdminStore((s) => s.totalQuestions)
  const setQuestions = useAdminStore((s) => s.setQuestions)
  const setTotalQuestions = useAdminStore((s) => s.setTotalQuestions)

  const fetchQuestions = useCallback(
    async (pageNum: number) => {
      setLoading(true)
      setError(null)
      try {
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
        const host = window.location.host
        const res = await apiFetch(
          `${protocol}//${host}/api/questions/?skip=${pageNum * 20}&limit=20`,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { items: Question[]; total: number } = await res.json()
        setQuestions(data.items)
        setTotalQuestions(data.total)
      } catch {
        setError('Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    },
    [setQuestions, setTotalQuestions],
  )

  useEffect(() => {
    fetchQuestions(page)
  }, [page, fetchQuestions])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const host = window.location.host
      const res = await apiFetch(`${protocol}//${host}/api/questions/${target.id}`, {
        method: 'DELETE',
      })
      if (res.status !== 204) throw new Error(`HTTP ${res.status}`)
      // Remove from local list
      const updatedQuestions = questions.filter((q) => q.id !== target.id)
      setQuestions(updatedQuestions)
      setTotalQuestions(Math.max(0, totalQuestions - 1))
      setToast('Вопрос удалён')
    } catch {
      setToast('Ошибка при удалении вопроса')
    }
  }, [deleteTarget, questions, totalQuestions, setQuestions, setTotalQuestions])

  const hasMorePages = totalQuestions > (page + 1) * 20

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-wb-text-muted">Загрузка...</p>
    )
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-danger">{error}</p>
    )
  }

  if (totalQuestions === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg font-semibold text-wb-text">Нет вопросов</p>
        <p className="mt-2 text-sm text-wb-text-muted">
          Добавьте вопросы через форму «Добавить» или импортируйте через CSV.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Question rows */}
      <AnimatePresence>
        {questions.map((q, idx) => (
          <motion.div
            key={q.id}
            layout
            className={`flex flex-row items-center gap-3 px-4 py-3 ${
              idx % 2 === 0 ? 'bg-wb-surface' : 'bg-wb-surface/50'
            }`}
          >
            <span className="min-w-[3ch] font-mono text-sm text-wb-text-muted">
              #{q.id}
            </span>
            <span className="flex-1 truncate text-sm font-semibold text-wb-text">
              {q.text}
            </span>
            {q.category && (
              <span className="rounded bg-wb-bg px-2 text-sm text-wb-text-muted">
                {q.category}
              </span>
            )}
            <button
              type="button"
              aria-label="Удалить вопрос"
              onClick={() => setDeleteTarget(q)}
              className="min-h-[44px] p-3 text-danger"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Pagination footer */}
      {hasMorePages ? (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="w-full cursor-pointer py-4 text-center text-sm text-player1"
        >
          Показать ещё
        </button>
      ) : page > 0 ? (
        <p className="py-4 text-center text-sm text-wb-text-muted">Конец списка</p>
      ) : null}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Удалить вопрос?"
        body={
          deleteTarget
            ? `Вопрос «${deleteTarget.text.length > 60 ? deleteTarget.text.slice(0, 60) + '...' : deleteTarget.text}» будет удалён без возможности восстановления.`
            : ''
        }
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toast */}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  )
}
