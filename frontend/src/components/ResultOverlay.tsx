import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

export default function ResultOverlay() {
  const roundResult = useGameStore((s) => s.roundResult)
  const playerNumber = useGameStore((s) => s.playerNumber)

  if (!roundResult) return null

  const isWinner =
    (roundResult.winner === 'player1' && playerNumber === 1) ||
    (roundResult.winner === 'player2' && playerNumber === 2)

  const isLoser =
    (roundResult.winner === 'player1' && playerNumber === 2) ||
    (roundResult.winner === 'player2' && playerNumber === 1)

  const myAnswer =
    playerNumber === 1 ? roundResult.player1_answer : roundResult.player2_answer
  const opponentAnswer =
    playerNumber === 1 ? roundResult.player2_answer : roundResult.player1_answer

  const winnerText = isWinner ? 'Вы выиграли раунд!' : isLoser ? 'Соперник выиграл раунд' : 'Ничья'

  const winnerColor = roundResult.winner === 'draw'
    ? 'var(--color-wb-text)'
    : isWinner
      ? playerNumber === 1 ? 'var(--color-player1)' : 'var(--color-player2)'
      : 'var(--color-wb-text)'

  const myAnswerColor = isWinner
    ? (playerNumber === 1 ? 'var(--color-player1)' : 'var(--color-player2)')
    : 'var(--color-wb-text)'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,22,22,0.85)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="w-full max-w-md rounded-xl bg-wb-surface p-6 text-center"
        initial={{ opacity: 0, scaleY: 0.85 }}
        animate={{ opacity: 1, scaleY: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <p
          className="text-xl font-semibold leading-[1.3]"
          style={{ color: winnerColor }}
        >
          {winnerText}
        </p>

        <p
          className="mt-4 text-xl font-semibold leading-[1.3]"
          style={{ color: myAnswerColor }}
        >
          {'Ваш ответ: '}
          {myAnswer !== null && myAnswer !== undefined ? myAnswer : '—'}
        </p>

        <p className="mt-2 text-xl font-semibold leading-[1.3] text-correct">
          {'Правильный ответ: '}
          {roundResult.correct_answer}
        </p>

        <p className="mt-2 text-xl font-semibold leading-[1.3] text-wb-text">
          {'Ответ соперника: '}
          {opponentAnswer !== null && opponentAnswer !== undefined ? opponentAnswer : '—'}
        </p>
      </motion.div>
    </motion.div>
  )
}
