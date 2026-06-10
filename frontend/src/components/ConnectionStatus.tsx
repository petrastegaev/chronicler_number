import { motion, AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

export default function ConnectionStatus() {
  const ws = useGameStore((s) => s.ws)
  const phase = useGameStore((s) => s.phase)

  const disconnected = !ws && phase !== 'idle' && phase !== 'joining'

  return (
    <AnimatePresence>
      {disconnected && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,10,46,0.9)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="text-center">
            <p className="text-xl font-semibold text-wb-text">
              Ошибка соединения
            </p>
            <p className="mt-2 text-base text-wb-text-muted">
              {'Обновите страницу'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
