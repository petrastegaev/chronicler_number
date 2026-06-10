import { useState, useCallback } from 'react'
import { useAdminStore } from '../../stores/adminStore'
import Toast from './Toast'

interface Question {
  id: number
  text: string
  answer: number
  category: string | null
  created_at: string
}

export default function QuestionAddTab() {
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState('')
  const [category, setCategory] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const setQuestions = useAdminStore((s) => s.setQuestions)
  const setTotalQuestions = useAdminStore((s) => s.setTotalQuestions)

  const canSubmit = text.trim().length > 0 && answer.trim().length > 0

  const refreshQuestionList = useCallback(async () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const host = window.location.host
      const res = await fetch(`${protocol}//${host}/api/questions/?skip=0&limit=20`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { items: Question[]; total: number } = await res.json()
      setQuestions(data.items)
      setTotalQuestions(data.total)
    } catch {
      // Silently fail — list will be stale but user can switch tabs
    }
  }, [setQuestions, setTotalQuestions])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setFormError(null)

    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const host = window.location.host
      const body: { text: string; answer: number; category?: string } = {
        text: text.trim(),
        answer: Number(answer.trim()),
      }
      if (category.trim()) {
        body.category = category.trim()
      }

      const res = await fetch(`${protocol}//${host}/api/questions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        const detail = errData?.detail || `Ошибка ${res.status}`
        setFormError(`Ошибка при добавлении вопроса: ${detail}`)
        return
      }

      setToast('Вопрос добавлен')
      setText('')
      setAnswer('')
      setCategory('')
      await refreshQuestionList()
    } catch {
      setFormError('Ошибка сети. Проверьте соединение.')
    }
  }, [canSubmit, text, answer, category, refreshQuestionList])

  return (
    <>
      <div className="rounded-xl bg-wb-surface p-4">
        <label className="text-sm font-semibold text-wb-text-muted">
          Текст вопроса
        </label>
        <input
          type="text"
          required
          maxLength={500}
          placeholder="Введите вопрос"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-3 w-full rounded-lg border border-wb-text-muted/30 bg-wb-bg px-4 py-3 text-base text-wb-text placeholder-wb-text-muted/50 caret-player1 outline-none focus:border-player1"
        />

        <label className="mt-3 block text-sm font-semibold text-wb-text-muted">
          Ответ
        </label>
        <input
          type="number"
          required
          min={0}
          max={1000000}
          placeholder="Введите ответ"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="mt-3 w-full rounded-lg border border-wb-text-muted/30 bg-wb-bg px-4 py-3 text-base text-wb-text placeholder-wb-text-muted/50 caret-player1 outline-none focus:border-player1"
        />

        <label className="mt-3 block text-sm font-semibold text-wb-text-muted">
          Категория (необязательно)
        </label>
        <input
          type="text"
          maxLength={255}
          placeholder="Категория (необязательно)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-3 w-full rounded-lg border border-wb-text-muted/30 bg-wb-bg px-4 py-3 text-base text-wb-text placeholder-wb-text-muted/50 caret-player1 outline-none focus:border-player1"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-lg bg-player1 font-semibold text-white disabled:opacity-50"
        >
          Добавить вопрос
        </button>

        {formError && (
          <p className="mt-2 text-sm text-danger">{formError}</p>
        )}
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  )
}
