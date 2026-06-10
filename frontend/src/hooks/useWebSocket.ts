import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import type { WsMessage } from '../types/ws'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws`)

    ws.onopen = () => {
      useGameStore.setState({ ws })
    }

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data)
      const store = useGameStore.getState()

      switch (msg.event) {
        case 'joined': {
          const data = msg.data as { player_number?: 1 | 2 }
          store.setPlayerNumber(data.player_number ?? null)
          store.setPhase('waiting')
          break
        }
        case 'game_started': {
          const data = msg.data as { player1_nickname: string; player2_nickname: string }
          store.setGameStarted(data.player1_nickname, data.player2_nickname)
          break
        }
        case 'round_started': {
          const data = msg.data as { round_number: number; total_rounds: number; question_text: string }
          store.setRoundStarted(data.round_number, data.total_rounds, data.question_text)
          store.resetRound()
          break
        }
        case 'timer_tick': {
          const data = msg.data as { remaining: number }
          store.setTimer(data.remaining)
          break
        }
        case 'round_result': {
          const data = msg.data as {
            round_number: number
            correct_answer: number
            player1_answer: number | null
            player2_answer: number | null
            winner: 'player1' | 'player2' | 'draw'
          }
          useGameStore.setState({ roundResult: data, phase: 'showing_result' })
          break
        }
        case 'score_update': {
          const data = msg.data as { player1_score: number; player2_score: number }
          store.setScoreUpdate(data.player1_score, data.player2_score)
          break
        }
        case 'game_end': {
          const data = msg.data as {
            player1_nickname: string
            player2_nickname: string
            player1_score: number
            player2_score: number
            winner: string | null
            rounds: Array<{
              round_number: number
              winner: 'player1' | 'player2' | 'draw'
              player1_answer: number | null
              player2_answer: number | null
            }>
          }
          useGameStore.setState({ gameEndResult: data, phase: 'finished' })
          break
        }
        case 'game_reset': {
          store.reset()
          store.setPhase('waiting')
          break
        }
        case 'state_snapshot': {
          const data = msg.data as {
            state: string
            current_round: number
            remaining: number
            question_text: string | null
          }
          store.setPhase(data.state)
          if (data.question_text) {
            store.setRoundStarted(data.current_round, 9, data.question_text)
          }
          store.setTimer(data.remaining)
          break
        }
        default: {
          if (msg.event === 'error') {
            const errorData = msg.data as { message?: string }
            console.error('[WS] Server error:', errorData.message ?? 'Unknown error')
            store.setPhase('idle')
          }
          break
        }
      }
    }

    ws.onclose = () => {
      useGameStore.setState({ ws: null, phase: 'idle' })
    }

    wsRef.current = ws
  }, [])

  const join = useCallback((nickname: string) => {
    const store = useGameStore.getState()
    store.setPhase('joining')
    store.ws?.send(
      JSON.stringify({
        event: 'join',
        data: { role: 'player', nickname },
      })
    )
  }, [])

  const submitAnswer = useCallback((answer: number | null) => {
    const store = useGameStore.getState()
    if (answer === null) return // Don't submit empty answers
    store.ws?.send(
      JSON.stringify({
        event: 'submit_answer',
        data: { answer },
      })
    )
  }, [])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return { connect, join, submitAnswer }
}
