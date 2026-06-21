import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'

export default function AnswerInput() {
  const myAnswer = useGameStore((s) => s.myAnswer)
  const setMyAnswer = useGameStore((s) => s.setMyAnswer)
  const submittedAnswer = useGameStore((s) => s.submittedAnswer)
  const setSubmittedAnswer = useGameStore((s) => s.setSubmittedAnswer)
  const remaining = useGameStore((s) => s.remaining)
  const phase = useGameStore((s) => s.phase)
  const ws = useGameStore((s) => s.ws)
  const submitAnswerAction = useGameStore((s) => s.submitAnswerAction)
  const currentRound = useGameStore((s) => s.currentRound)

  // Guard against duplicate submissions within the same round
  const lastSubmittedRoundRef = useRef<number | null>(null)

  const isDisabled = submittedAnswer || !ws

  const handleSubmit = useCallback(() => {
    if (isDisabled) return
    if (myAnswer === null) return // Don't submit empty answers
    if (!Number.isFinite(myAnswer) || myAnswer < 0 || myAnswer > 1_000_000) return
    // Prevent duplicate submissions in the same round
    if (lastSubmittedRoundRef.current === currentRound) return
    lastSubmittedRoundRef.current = currentRound
    submitAnswerAction(myAnswer)
  }, [isDisabled, myAnswer, currentRound, submitAnswerAction])

  // Auto-submit on timer expiry per D-10 with Pitfall 4 mitigation
  useEffect(() => {
    if (remaining === 0 && !submittedAnswer && phase === 'playing' && ws) {
      if (myAnswer === null || !Number.isFinite(myAnswer) || myAnswer < 0 || myAnswer > 1_000_000) {
        // Don't submit empty/invalid answers — the player chose not to answer
        if (lastSubmittedRoundRef.current !== currentRound) {
          lastSubmittedRoundRef.current = currentRound
          setSubmittedAnswer(true)
        }
        return
      }
      if (lastSubmittedRoundRef.current === currentRound) return
      lastSubmittedRoundRef.current = currentRound
      submitAnswerAction(myAnswer)
    }
  }, [remaining, myAnswer, submittedAnswer, phase, ws, currentRound, submitAnswerAction, setSubmittedAnswer])

  return (
    <div className="flex flex-row items-stretch gap-2">
      <input
        type="number"
        min={0}
        max={1000000}
        value={myAnswer ?? ''}
        onChange={(e) => {
          if (e.target.value === '') {
            setMyAnswer(null)
            return
          }
          const val = Number(e.target.value)
          if (!Number.isFinite(val)) return
          setMyAnswer(val)
        }}
        disabled={isDisabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        className="flex-1 min-h-[52px] min-w-0 rounded-lg border border-wb-text-muted/30 bg-wb-bg px-4 text-center text-2xl font-semibold leading-[1.2] text-wb-text placeholder:text-wb-text-muted focus:border-player1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        placeholder="0"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isDisabled}
        className="flex min-h-[52px] shrink-0 items-center justify-center rounded-lg bg-player1 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submittedAnswer ? '✓' : 'Ответить'}
      </button>
    </div>
  )
}
