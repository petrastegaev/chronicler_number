import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

const RADIUS = 41 // r=41 for 88px diameter with 6px stroke

export default function TimerRing() {
  const remaining = useGameStore((s) => s.remaining)
  const playerNumber = useGameStore((s) => s.playerNumber)

  const progress = remaining / 10 // 1.0 (full) -> 0.0 (empty)

  const getColor = () => {
    if (remaining <= 3) return 'var(--color-danger)' // danger
    if (remaining <= 5) return 'var(--color-warning)' // warning
    return playerNumber === 1 ? 'var(--color-player1)' : 'var(--color-player2)' // player accent
  }

  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      role="timer"
      aria-live="polite"
      aria-label={`Осталось ${remaining} секунд`}
    >
      {/* Background ring */}
      <circle
        cx="44"
        cy="44"
        r={RADIUS}
        fill="none"
        stroke="var(--color-wb-surface)"
        strokeWidth="6"
      />
      {/* Animated progress ring */}
      <motion.circle
        cx="44"
        cy="44"
        r={RADIUS}
        fill="none"
        stroke={getColor()}
        strokeWidth="6"
        strokeLinecap="round"
        style={{
          rotate: '-90deg',
          transformOrigin: 'center',
        }}
        animate={{ pathLength: progress }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      {/* Digits inside */}
      <text
        x="44"
        y="44"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-wb-text)"
        fontSize="64"
        fontFamily="'CoFo Sans Pixel', system-ui, sans-serif"
        fontWeight="600"
      >
        {remaining}
      </text>
    </svg>
  )
}
