import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import TimerRing from './TimerRing'

export default function PlayingScreen() {
  const questionText = useGameStore((s) => s.questionText)

  return (
    <motion.div
      className="flex flex-1 flex-col bg-wb-bg pt-10 min-h-0"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Timer + Question — takes remaining space, centred */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4">
        <TimerRing />
        <p className="text-center text-xl font-semibold leading-[1.25] text-wb-text sm:text-2xl">
          {questionText}
        </p>
      </div>

      {/* Spacer so content doesn't hide behind the fixed input bar */}
      <div className="h-[68px] flex-none" />
    </motion.div>
  )
}
