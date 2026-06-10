import { useState } from 'react'
import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { useWebSocket } from '../hooks/useWebSocket'

export default function JoinScreen() {
  const [nickname, setNickname] = useState('')
  const phase = useGameStore((s) => s.phase)
  const { join } = useWebSocket()

  const isSubmitting = phase === 'joining'

  const handleJoin = () => {
    const trimmed = nickname.trim()
    if (!trimmed || isSubmitting) return
    join(trimmed)
  }

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
      <div className="mt-8 w-full max-w-[400px] rounded-xl bg-wb-surface p-6">
        <input
          type="text"
          maxLength={15}
          placeholder="Введите ваш ник"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleJoin()
          }}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-wb-text-muted/30 bg-wb-bg px-4 py-3 text-base text-wb-text placeholder:text-wb-text-muted focus:border-player1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleJoin}
          disabled={isSubmitting}
          className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-lg bg-player1 px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Отправка...' : 'Присоединиться'}
        </button>
      </div>
    </motion.div>
  )
}
