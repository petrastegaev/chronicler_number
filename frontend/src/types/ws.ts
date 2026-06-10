export interface WsMessage {
  event: string
  data: Record<string, unknown>
}

export interface JoinMessage extends WsMessage {
  event: 'join'
  data: {
    role: 'player' | 'admin'
    nickname: string
  }
}

export interface JoinedEvent extends WsMessage {
  event: 'joined'
  data: {
    role: 'player' | 'admin'
    player_number?: number
    nickname?: string
  }
}

export interface ErrorEvent extends WsMessage {
  event: 'error'
  data: {
    message: string
  }
}

// Phase 2: Game event types
export interface SubmitAnswer extends WsMessage {
  event: 'submit_answer'
  data: {
    answer: number
  }
}

export interface StartGame extends WsMessage {
  event: 'start_game'
  data: Record<string, never>
}

export interface Restart extends WsMessage {
  event: 'restart'
  data: Record<string, never>
}

// Server events
export interface GameStartedEvent extends WsMessage {
  event: 'game_started'
  data: {
    player1_nickname: string
    player2_nickname: string
  }
}

export interface RoundStartedEvent extends WsMessage {
  event: 'round_started'
  data: {
    round_number: number
    total_rounds: number
    question_text: string
  }
}

export interface TimerTickEvent extends WsMessage {
  event: 'timer_tick'
  data: {
    remaining: number
  }
}

export interface RoundResultEvent extends WsMessage {
  event: 'round_result'
  data: {
    round_number: number
    correct_answer: number
    player1_answer: number | null
    player2_answer: number | null
    winner: 'player1' | 'player2' | 'draw'
  }
}

export interface ScoreUpdateEvent extends WsMessage {
  event: 'score_update'
  data: {
    player1_score: number
    player2_score: number
    round_number: number
  }
}

export interface GameEndEvent extends WsMessage {
  event: 'game_end'
  data: {
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
}

export interface GameResetEvent extends WsMessage {
  event: 'game_reset'
  data: {
    message: string
  }
}

export interface StateSnapshotEvent extends WsMessage {
  event: 'state_snapshot'
  data: {
    state: string
    current_round: number
    remaining: number
    question_text: string | null
  }
}
