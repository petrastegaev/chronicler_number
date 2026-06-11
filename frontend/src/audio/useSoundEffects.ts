import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { soundManager } from './SoundManager'

export function useSoundEffects() {
  const initializedRef = useRef(false)

  // Step 1: Preload all sounds on mount
  useEffect(() => {
    soundManager.preload()
    initializedRef.current = true
  }, [])

  // Step 2: Subscribe to timer_tick for tick/tick_fast sounds
  // Uses Zustand vanilla subscribe which receives (state, previousState)
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      // Only play on decrement (not on round start when it resets to 10)
      if (state.remaining < prevState.remaining) {
        if (state.remaining > 3) {
          soundManager.stop('tick')
          soundManager.play('tick')
        } else {
          soundManager.stop('tick_fast')
          soundManager.play('tick_fast')
        }
      }
    })
    return unsub
  }, [])

  // Step 3: Subscribe to round_result for end_round sound
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      if (state.roundResult !== null && prevState.roundResult === null) {
        soundManager.play('end_round')
      }
    })
    return unsub
  }, [])

  // Step 4: Subscribe to game_end for winner sound
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      if (state.gameEndResult !== null && prevState.gameEndResult === null) {
        soundManager.play('winner')
      }
    })
    return unsub
  }, [])

  // Step 5: Stop all sounds on game reset (phase transitions to idle/waiting)
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      if (
        (state.phase === 'idle' || state.phase === 'waiting') &&
        prevState.phase !== state.phase
      ) {
        soundManager.stopAll()
      }
    })
    return unsub
  }, [])
}
