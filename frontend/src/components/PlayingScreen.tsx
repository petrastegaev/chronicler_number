import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import AnswerInput from './AnswerInput'
import TimerRing from './TimerRing'

export default function PlayingScreen() {
  const questionText = useGameStore((s) => s.questionText)

  return (
    <motion.div
      className="flex h-dvh flex-col bg-wb-bg pt-10"
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

      {/* Input — pinned to bottom, above keyboard */}
      <div className="flex-none px-4 pb-4">
        <div className="mx-auto max-w-md">
          <AnswerInput />
        </div>
      </div>
    </motion.div>
  )
}
