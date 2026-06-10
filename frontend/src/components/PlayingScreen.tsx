import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import AnswerInput from './AnswerInput'
import TimerRing from './TimerRing'

export default function PlayingScreen() {
  const questionText = useGameStore((s) => s.questionText)

  return (
    <motion.div
      className="flex min-h-screen flex-col px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Question section (~40% height) */}
      <div className="flex flex-1 items-center justify-center">
        <p className="text-center text-[36px] font-semibold leading-[1.2] text-wb-text">
          {questionText}
        </p>
      </div>

      {/* Input + Timer section (~30% height) */}
      <div className="relative flex-none">
        <div className="mx-auto max-w-md">
          <AnswerInput />
        </div>
        <div className="absolute top-0 right-0">
          <TimerRing />
        </div>
      </div>

      {/* Footer spacer (~30% height) */}
      <div className="flex-1" />
    </motion.div>
  )
}
