import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { useWebSocket } from '../hooks/useWebSocket'
import JoinScreen from './JoinScreen'
import WaitingScreen from './WaitingScreen'
import PlayingScreen from './PlayingScreen'
import GameHeader from './GameHeader'
import ResultOverlay from './ResultOverlay'
import FinalScreen from './FinalScreen'
import ConnectionStatus from './ConnectionStatus'

export default function GameScreen() {
  const phase = useGameStore((s) => s.phase)
  const ws = useGameStore((s) => s.ws)
  const { connect } = useWebSocket()

  const showHeader = ['playing', 'showing_result', 'finished'].includes(phase)

  useEffect(() => {
    if (!ws) {
      connect()
    }
  }, [ws, connect])

  return (
    <div className="relative min-h-screen bg-wb-bg overflow-hidden">
      {showHeader && <GameHeader />}
      <AnimatePresence>
        {phase === 'idle' || phase === 'joining' ? (
          <JoinScreen key="join" />
        ) : phase === 'waiting' ? (
          <WaitingScreen key="waiting" />
        ) : phase === 'playing' ? (
          <PlayingScreen key="playing" />
        ) : phase === 'showing_result' ? (
          <ResultOverlay key="result" />
        ) : phase === 'finished' ? (
          <FinalScreen key="finished" />
        ) : null}
      </AnimatePresence>
      <ConnectionStatus />
    </div>
  )
}
