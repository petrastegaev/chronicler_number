import { motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'

const SIZE = 72
const RADIUS = 33
const CX = SIZE / 2
const CY = SIZE / 2

export default function TimerRing() {
  const remaining = useGameStore((s) => s.remaining)
  const playerNumber = useGameStore((s) => s.playerNumber)
  const progress = remaining / 10

  const getColor = () => {
    if (remaining <= 3) return 'var(--color-danger)'
    if (remaining <= 5) return 'var(--color-warning)'
    return playerNumber === 1 ? 'var(--color-player1)' : 'var(--color-player2)'
  }

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="timer"
      aria-live="polite"
      aria-label={`Осталось ${remaining} секунд`}
    >
      <circle
        cx={CX}
        cy={CY}
        r={RADIUS}
        fill="none"
        stroke="var(--color-wb-surface)"
        strokeWidth="6"
      />
      <motion.circle
        cx={CX}
        cy={CY}
        r={RADIUS}
        fill="none"
        stroke={getColor()}
        strokeWidth="6"
        strokeLinecap="round"
        style={{ rotate: '-90deg', transformOrigin: 'center' }}
        animate={{ pathLength: progress }}
        transition={{ duration: 0.1 }}
      />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-wb-text)"
        fontSize="48"
        fontFamily="'CoFo Sans Pixel', system-ui, sans-serif"
        fontWeight="600"
      >
        {remaining}
      </text>
    </svg>
  )
}
