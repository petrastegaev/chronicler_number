import { useCallback, useEffect, useRef } from 'react'
import { useAdminStore } from '../stores/adminStore'
import type { WsMessage } from '../types/ws'

const MAX_RECONNECT_DELAY = 10000
const BASE_RECONNECT_DELAY = 1000
const HEARTBEAT_INTERVAL = 15000
const HEARTBEAT_TIMEOUT = 30000

function isWsMessage(raw: unknown): raw is WsMessage {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'event' in raw &&
    typeof (raw as Record<string, unknown>).event === 'string'
  )
}

export function useAdminWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const intentionalCloseRef = useRef(false)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectingRef = useRef(false)
  const adminKeyRef = useRef<string | null>(null)
  const connectionIdRef = useRef(0)
  const lastMessageTimeRef = useRef(Date.now())
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ref-based patterns to break circular dependencies between connect and scheduleReconnect
  const connectRef = useRef<(adminKey: string) => void>(() => {})

  const handleMessageRef = useRef<(event: MessageEvent) => void>(() => {})

  handleMessageRef.current = (event: MessageEvent) => {
    lastMessageTimeRef.current = Date.now()

    const raw: unknown = JSON.parse(event.data)
    if (!isWsMessage(raw)) {
      console.warn('[WS Admin] Received malformed message (missing event field), skipping')
      return
    }
    const msg: WsMessage = raw

    const store = useAdminStore.getState()

    switch (msg.event) {
      case 'joined': {
        const data = msg.data as {
          role?: string
          token?: string
          player1_nickname?: string | null
          player2_nickname?: string | null
        }
        store.setPhase('lobby')
        if (data.token) {
          store.setToken(data.token)
          // Save reconnect token in sessionStorage to prevent cross-tab leakage (BUG-CROSS-TAB-TOKEN)
          try { sessionStorage.setItem('ws_reconnect_token_admin', data.token) } catch {}
        }
        // Apply existing player state (admin connected after players)
        if (data.player1_nickname) {
          store.setPlayer1Nickname(data.player1_nickname)
          store.setPlayer1Online(true)
        }
        if (data.player2_nickname) {
          store.setPlayer2Nickname(data.player2_nickname)
          store.setPlayer2Online(true)
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
      case 'game_cancelled': {
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
          store.setPlayer1Online(true)
        } else if (data.player_number === 2) {
          store.setPlayer2Nickname(data.nickname)
          store.setPlayer2Online(true)
        }
        if (data.player1_nickname) store.setPlayer1Nickname(data.player1_nickname)
        if (data.player2_nickname) store.setPlayer2Nickname(data.player2_nickname)
        break
      }
      default: {
        if (msg.event === 'error') {
          const errorData = msg.data as { message?: string }
          console.warn('[WS Admin] Server error:', errorData.message ?? 'Unknown error')
          // Clear stale reconnect token to break infinite reconnect loop (BUG-STALE-TOKEN-LOOP)
          if (errorData.message?.includes('Недействительный токен')) {
            try { sessionStorage.removeItem('ws_reconnect_token_admin') } catch {}
          }
          store.setAuthError(errorData.message ?? 'Ошибка авторизации')
        }
        break
      }
    }
  }

  const startHeartbeat = useCallback((connectionId: number) => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
    }
    lastMessageTimeRef.current = Date.now()

    heartbeatTimerRef.current = setInterval(() => {
      if (connectionIdRef.current !== connectionId) {
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current)
          heartbeatTimerRef.current = null
        }
        return
      }
      const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current
      if (timeSinceLastMessage > HEARTBEAT_TIMEOUT) {
        console.warn('[WS Admin] Heartbeat timeout — no message in 30s, reconnecting...')
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current)
          heartbeatTimerRef.current = null
        }
        wsRef.current?.close()
      }
    }, HEARTBEAT_INTERVAL)
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_RECONNECT_DELAY
    )
    reconnectAttemptRef.current += 1

    console.warn(`[WS Admin] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptRef.current})`)

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      if (!intentionalCloseRef.current && adminKeyRef.current) {
        connectRef.current(adminKeyRef.current)
      }
    }, delay)
  }, [])

  const connect = useCallback((adminKey: string) => {
    if (connectingRef.current) return // Prevent multiple concurrent connects
    connectingRef.current = true
    adminKeyRef.current = adminKey

    const connectionId = ++connectionIdRef.current

    useAdminStore.setState({ phase: 'connecting' })

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    // Restore reconnect token from sessionStorage (per-tab) for seamless session recovery (BUG-CROSS-TAB-TOKEN)
    const savedToken = (() => { try { return sessionStorage.getItem('ws_reconnect_token_admin') } catch { return null } })()
    const tokenParam = savedToken ? `?token=${savedToken}` : ''
    const ws = new WebSocket(`${protocol}//${host}/ws${tokenParam}`)
    wsRef.current = ws

    ws.onopen = () => {
      connectingRef.current = false
      reconnectAttemptRef.current = 0
      useAdminStore.setState({ ws })
      startHeartbeat(connectionId)
      ws.send(
        JSON.stringify({
          event: 'join',
          data: { role: 'admin', admin_key: adminKey },
        })
      )
    }

    ws.onmessage = (event: MessageEvent) => {
      if (connectionIdRef.current !== connectionId) return
      try {
        handleMessageRef.current(event)
      } catch (e) {
        console.warn('[WS Admin] Error in message handler:', e)
      }
    }

    ws.onclose = () => {
      connectingRef.current = false
      if (connectionIdRef.current !== connectionId) return
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false
        return
      }
      const currentPhase = useAdminStore.getState().phase
      if (currentPhase === 'connecting') {
        // Connection failed before join — return to waiting so user can retry
        useAdminStore.setState({ phase: 'waiting', ws: null })
      } else {
        useAdminStore.setState({ ws: null })
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      connectingRef.current = false
      // onclose will fire after this
    }
  }, [startHeartbeat])

  // Keep connectRef in sync so scheduleReconnect always calls the latest connect
  connectRef.current = connect

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
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
      wsRef.current?.close()
    }
  }, [])

  return { connect, startGame, restart }
}
