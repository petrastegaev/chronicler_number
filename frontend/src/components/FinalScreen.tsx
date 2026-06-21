import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

export default function FinalScreen() {
  const gameEndResult = useGameStore((s) => s.gameEndResult)
  const phase = useGameStore((s) => s.phase)

  if (phase !== 'finished') return null

  // Backend sends the actual winner nickname (or null for draw), not "player1"/"player2" role labels.
  const winnerNickname = gameEndResult?.winner ?? null
  const isDraw = winnerNickname === null

  const winnerIsP1 = winnerNickname !== null && winnerNickname === gameEndResult?.player1_nickname
  const winnerIsP2 = winnerNickname !== null && winnerNickname === gameEndResult?.player2_nickname

  const winnerColor = winnerIsP1
    ? 'var(--color-player1)'
    : winnerIsP2
      ? 'var(--color-player2)'
      : 'var(--color-wb-text)'

  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center bg-wb-bg px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <h1
        className="text-[64px] font-semibold leading-[1.0]"
        style={{ color: isDraw ? 'var(--color-wb-text)' : winnerColor }}
      >
        {isDraw ? 'Ничья' : `Победитель: ${winnerNickname}`}
      </h1>

      <p className="mt-8 text-xl font-semibold leading-[1.3] text-wb-text-muted">
        {'Финальный счёт'}
      </p>

      <p
        className="mt-4 text-xl font-semibold leading-[1.3]"
        style={{ color: 'var(--color-player1)' }}
      >
        {gameEndResult?.player1_nickname ?? 'Игрок 1'}
        {': '}
        {gameEndResult?.player1_score ?? 0}
      </p>

      <p
        className="mt-2 text-xl font-semibold leading-[1.3]"
        style={{ color: 'var(--color-player2)' }}
      >
        {gameEndResult?.player2_nickname ?? 'Игрок 2'}
        {': '}
        {gameEndResult?.player2_score ?? 0}
      </p>

      <p className="mt-12 text-base text-wb-text-muted">
        {'Ожидание перезапуска...'}
      </p>
    </motion.div>
  )
}
