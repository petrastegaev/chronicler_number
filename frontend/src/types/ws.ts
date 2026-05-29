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
