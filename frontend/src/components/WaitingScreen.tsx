import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

export default function WaitingScreen() {
  const player2Nickname = useGameStore((s) => s.player2Nickname)

  const waitingText = player2Nickname
    ? 'Ожидание запуска администратором'
    : 'Ожидание соперника...'

  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h1 className="text-[64px] font-semibold leading-[1.0] text-wb-text">
        Дуэль чисел
      </h1>
      <p className="mt-8 text-xl leading-[1.3] text-wb-text-muted">
        {waitingText}
      </p>
    </motion.div>
  )
}
