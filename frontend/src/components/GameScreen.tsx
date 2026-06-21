import { useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { useGameStore } from '../stores/gameStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { useSoundEffects } from '../audio/useSoundEffects'
import { useViewportHeight } from '../hooks/useKeyboardHeight'
import JoinScreen from './JoinScreen'
import WaitingScreen from './WaitingScreen'
import PlayingScreen from './PlayingScreen'
import GameHeader from './GameHeader'
import ResultOverlay from './ResultOverlay'
import FinalScreen from './FinalScreen'
import ConnectionStatus from './ConnectionStatus'
import AnswerInput from './AnswerInput'

export default function GameScreen() {
  const phase = useGameStore((s) => s.phase)
  const ws = useGameStore((s) => s.ws)
  const { connect } = useWebSocket()
  const { keyboardOffset } = useViewportHeight()

  // Mount sound effects hook -- starts preloading, subscribes to store
  useSoundEffects()

  const showHeader = ['playing', 'showing_result', 'finished'].includes(phase)
  const showInput = phase === 'playing'

  useEffect(() => {
    if (!ws) {
      connect()
    }
  }, [ws, connect])

  return (
    <div className="relative flex min-h-screen flex-col bg-wb-bg">
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

      {/* Input bar — fixed above the iOS virtual keyboard.
          keyboardOffset = 0 on desktop, rises with the keyboard on iPad. */}
      {showInput && (
        <div
          className="fixed left-0 right-0 z-30 px-4 pb-4 bg-wb-bg"
          style={{ bottom: keyboardOffset }}
        >
          <div className="mx-auto max-w-md">
            <AnswerInput />
          </div>
        </div>
      )}
    </div>
  )
}
