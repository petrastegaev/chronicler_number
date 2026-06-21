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

  useSoundEffects()

  const showHeader = ['playing', 'showing_result', 'finished'].includes(phase)
  const showInput = phase === 'playing'

  useEffect(() => {
    if (!ws) connect()
  }, [ws, connect])

  return (
    <div className="flex h-dvh flex-col bg-wb-bg">
      {showHeader && <GameHeader />}

      {/* Scrollable body — iOS 26 workaround: scroll inside child, not body */}
      <div className="flex flex-1 flex-col overflow-y-auto">
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
      </div>

      <ConnectionStatus />

      {/* Input bar — fixed at viewport bottom.  When the iOS keyboard opens,
          translateY pushes it up exactly by the keyboard height.
          Uses transform (GPU) instead of changing bottom (layout thrash). */}
      {showInput && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 bg-wb-bg px-4 pb-4 pt-2"
          style={{
            transform: `translateY(-${keyboardOffset}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          <div className="mx-auto max-w-md">
            <AnswerInput />
          </div>
        </div>
      )}
    </div>
  )
}
