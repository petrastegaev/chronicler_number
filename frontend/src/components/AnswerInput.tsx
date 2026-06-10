import { useEffect } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useWebSocket } from '../hooks/useWebSocket'

export default function AnswerInput() {
  const myAnswer = useGameStore((s) => s.myAnswer)
  const setMyAnswer = useGameStore((s) => s.setMyAnswer)
  const submittedAnswer = useGameStore((s) => s.submittedAnswer)
  const setSubmittedAnswer = useGameStore((s) => s.setSubmittedAnswer)
  const remaining = useGameStore((s) => s.remaining)
  const phase = useGameStore((s) => s.phase)
  const ws = useGameStore((s) => s.ws)
  const { submitAnswer } = useWebSocket()

  const isDisabled = submittedAnswer || !ws

  const handleSubmit = () => {
    if (isDisabled) return
    submitAnswer(myAnswer)
    setSubmittedAnswer(true)
  }

  // Auto-submit on timer expiry per D-10 with Pitfall 4 mitigation
  useEffect(() => {
    if (remaining === 0 && !submittedAnswer && phase === 'playing' && ws) {
      submitAnswer(myAnswer)
      setSubmittedAnswer(true)
    }
  }, [remaining]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-md">
        <input
          type="number"
          min={0}
          max={1000000}
          value={myAnswer ?? ''}
          onChange={(e) => {
            const val = e.target.value === '' ? null : Number(e.target.value)
            setMyAnswer(val)
          }}
          disabled={isDisabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
          className="w-full min-h-[56px] rounded-lg border border-wb-text-muted/30 bg-wb-bg px-4 text-center text-[36px] font-semibold leading-[1.2] text-wb-text placeholder:text-wb-text-muted focus:border-player1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          placeholder="0"
        />
        <p className="mt-2 text-center text-sm text-wb-text-muted">
          Введите целое число от 0 до 1 000 000
        </p>
      </div>
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className="flex min-h-[56px] items-center justify-center rounded-lg bg-player1 px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submittedAnswer ? 'Ответ принят' : 'Ответить'}
      </button>
    </div>
  )
}
