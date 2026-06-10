import { useCallback, useEffect, useRef } from 'react'
import { useAdminStore } from '../stores/adminStore'
import type { WsMessage } from '../types/ws'

export function useAdminWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const intentionalCloseRef = useRef(false)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      useAdminStore.setState({ ws })
      ws.send(
        JSON.stringify({
          event: 'join',
          data: { role: 'admin', admin_key: 'booth-admin-2026' },
        })
      )
    }

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data)
      const store = useAdminStore.getState()

      switch (msg.event) {
        case 'joined': {
          const data = msg.data as { role?: string; token?: string }
          store.setPhase('lobby')
          if (data.token) {
            store.setToken(data.token)
          }
          break
        }
        case 'game_started': {
          const data = msg.data as { player1_nickname: string; player2_nickname: string }
          store.setGameStarted(data.player1_nickname, data.player2_nickname)
          break
        }
        case 'round_started': {
          const data = msg.data as { round_number: number; total_rounds: number }
          store.setCurrentRound(data.round_number)
          store.setTotalRounds(data.total_rounds)
          break
        }
        case 'timer_tick': {
          // Admin may receive timer ticks — no action needed currently
          break
        }
        case 'score_update': {
          const data = msg.data as { player1_score: number; player2_score: number }
          store.setScoreUpdate(data.player1_score, data.player2_score)
          break
        }
        case 'game_end': {
          store.setPhase('finished')
          break
        }
        case 'game_reset': {
          store.resetForRestart()
          break
        }
        case 'player_joined': {
          const data = msg.data as {
            player_number: number
            nickname: string
            player1_nickname?: string
            player2_nickname?: string
          }
          if (data.player_number === 1) {
            store.setPlayer1Nickname(data.nickname)
          } else if (data.player_number === 2) {
            store.setPlayer2Nickname(data.nickname)
          }
          // Also catch up with pre-filled nicknames from server
          if (data.player1_nickname) store.setPlayer1Nickname(data.player1_nickname)
          if (data.player2_nickname) store.setPlayer2Nickname(data.player2_nickname)
          break
        }
        default: {
          if (msg.event === 'error') {
            const errorData = msg.data as { message?: string }
            console.warn('[WS Admin] Server error:', errorData.message ?? 'Unknown error')
          }
          break
        }
      }
    }

    ws.onclose = () => {
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false
        return
      }
      useAdminStore.setState({ phase: 'connecting', ws: null })
    }
  }, [])

  const startGame = useCallback(() => {
    const store = useAdminStore.getState()
    store.ws?.send(
      JSON.stringify({
        event: 'start_game',
        data: {},
      })
    )
  }, [])

  const restart = useCallback(() => {
    const store = useAdminStore.getState()
    store.ws?.send(
      JSON.stringify({
        event: 'restart',
        data: {},
      })
    )
  }, [])

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true
      wsRef.current?.close()
    }
  }, [])

  return { connect, startGame, restart }
}
