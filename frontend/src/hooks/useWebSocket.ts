import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import type { WsMessage } from '../types/ws'

const MAX_RECONNECT_DELAY = 10000 // 10 seconds max backoff
const BASE_RECONNECT_DELAY = 1000  // 1 second initial delay
const HEARTBEAT_INTERVAL = 15000   // Ping every 15 seconds
const HEARTBEAT_TIMEOUT = 30000    // Consider dead if no message for 30 seconds

/** Runtime type guard: validates the parsed object has the shape of a WsMessage */
function isWsMessage(raw: unknown): raw is WsMessage {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'event' in raw &&
    typeof (raw as Record<string, unknown>).event === 'string'
  )
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const intentionalCloseRef = useRef(false)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectingRef = useRef(false)
  const connectionIdRef = useRef(0) // Generation counter to detect stale connections
  const lastMessageTimeRef = useRef(Date.now())
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ref-based patterns to break circular dependencies between connect and scheduleReconnect
  const connectRef = useRef<() => void>(() => {})

  // Ref-based handler to avoid stale closures in onmessage
  const handleMessageRef = useRef<(event: MessageEvent) => void>(() => {})

  handleMessageRef.current = (event: MessageEvent) => {
    lastMessageTimeRef.current = Date.now()

    const raw: unknown = JSON.parse(event.data)
    if (!isWsMessage(raw)) {
      console.warn('[WS] Received malformed message (missing event field), skipping')
      return
    }
    const msg: WsMessage = raw

    const store = useGameStore.getState()

    switch (msg.event) {
      case 'joined': {
        const data = msg.data as {
          player_number?: 1 | 2
          player1_nickname?: string | null
          player2_nickname?: string | null
          token?: string
        }
        // Save reconnect token in sessionStorage to prevent cross-tab leakage (BUG-CROSS-TAB-TOKEN)
        if (data.token) {
          try { sessionStorage.setItem('ws_reconnect_token_player', data.token) } catch {}
        }
        store.setPlayerNumber(data.player_number ?? null)
        const opponentNick =
          data.player_number === 1 ? data.player2_nickname : data.player1_nickname
        if (opponentNick) {
          store.setOpponentNickname(opponentNick)
        }
        store.setPhase('waiting')
        break
      }
      case 'player_joined': {
        const data = msg.data as { player2_nickname: string }
        store.setOpponentNickname(data.player2_nickname)
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
          p1_qualifies: boolean
          p2_qualifies: boolean
        }
        store.setRoundResultData(data)
        break
      }
      case 'score_update': {
        const data = msg.data as { player1_score: number; player2_score: number; round_number?: number }
        if (data.round_number !== undefined && data.round_number !== store.currentRound) {
          console.warn(
            `[WS] score_update round_number mismatch: got ${data.round_number}, expected ${store.currentRound}`
          )
        }
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
        store.setGameEndResultData(data)
        break
      }
      case 'players_reset': {
        // Admin cleared the player slots — go back to join screen.
        // Clear reconnect token so the automatic reconnect (triggered by
        // server closing the WS) starts a fresh session, not a restore
        // of the just-cleared slot.
        try { sessionStorage.removeItem('ws_reconnect_token_player') } catch {}
        store.reset()
        store.setPhase('idle')
        break
      }
      case 'game_reset': {
        store.reset()
        store.setPhase('waiting')
        break
      }
      case 'game_cancelled': {
        const data = msg.data as { message: string }
        console.warn('[WS] Game cancelled:', data.message)
        store.reset()
        store.setPhase('idle')
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
          // Clear stale reconnect token to break infinite reconnect loop (BUG-STALE-TOKEN-LOOP)
          if (errorData.message?.includes('Недействительный токен')) {
            try { sessionStorage.removeItem('ws_reconnect_token_player') } catch {}
          }
          store.setPhase('idle')
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
      // Check if this connection is still the active one
      if (connectionIdRef.current !== connectionId) {
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current)
          heartbeatTimerRef.current = null
        }
        return
      }
      const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current
      if (timeSinceLastMessage > HEARTBEAT_TIMEOUT) {
        console.warn('[WS] Heartbeat timeout — no message received in 30s, reconnecting...')
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current)
          heartbeatTimerRef.current = null
        }
        // Force close and let onclose trigger reconnect
        wsRef.current?.close()
      }
    }, HEARTBEAT_INTERVAL)
  }, [])

  const connect = useCallback(() => {
    if (connectingRef.current) return // Prevent multiple concurrent connects
    connectingRef.current = true

    const connectionId = ++connectionIdRef.current

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    // Restore reconnect token from sessionStorage (per-tab) for seamless session recovery (BUG-CROSS-TAB-TOKEN)
    const savedToken = (() => { try { return sessionStorage.getItem('ws_reconnect_token_player') } catch { return null } })()
    const tokenParam = savedToken ? `?token=${savedToken}` : ''
    const ws = new WebSocket(`${protocol}//${host}/ws${tokenParam}`)
    wsRef.current = ws

    ws.onopen = () => {
      connectingRef.current = false
      reconnectAttemptRef.current = 0
      useGameStore.setState({ ws })
      startHeartbeat(connectionId)
    }

    // Delegate through ref to avoid stale closures
    ws.onmessage = (event: MessageEvent) => {
      // Guard against stale connection messages
      if (connectionIdRef.current !== connectionId) return
      try {
        handleMessageRef.current(event)
      } catch (e) {
        console.warn('[WS] Error in message handler:', e)
      }
    }

    ws.onclose = () => {
      connectingRef.current = false
      // Only act if this is still the active connection
      if (connectionIdRef.current !== connectionId) return
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false
        return
      }

      const currentPhase = useGameStore.getState().phase
      // Only reset to idle if we haven't progressed past joining
      if (currentPhase === 'idle' || currentPhase === 'joining') {
        useGameStore.setState({ ws: null, phase: 'idle' })
      } else {
        // In-game disconnect — attempt reconnect with backoff
        useGameStore.setState({ ws: null })
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

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return // Already scheduled

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_RECONNECT_DELAY
    )
    reconnectAttemptRef.current += 1

    console.warn(`[WS] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptRef.current})`)

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      if (!intentionalCloseRef.current) {
        connectRef.current()
      }
    }, delay)
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
    // Guard: don't submit if already submitted, null answer, or wrong phase
    if (store.submittedAnswer) return
    if (answer === null) return
    if (store.phase !== 'playing') return

    store.setSubmittedAnswer(true) // Set BEFORE sending to prevent double-submit race
    store.ws?.send(
      JSON.stringify({
        event: 'submit_answer',
        data: { answer },
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

  return { connect, join, submitAnswer }
}
