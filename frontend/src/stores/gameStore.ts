import { create } from 'zustand'
import type { RoundResultEvent, GameEndEvent } from '../types/ws'

interface GameState {
  phase: string
  playerNumber: 1 | 2 | null
  player1Nickname: string
  player2Nickname: string
  player1Score: number
  player2Score: number
  currentRound: number
  totalRounds: number
  questionText: string
  remaining: number
  // Phase 3 additions:
  ws: WebSocket | null
  submittedAnswer: boolean
  myAnswer: number | null
  roundResult: RoundResultEvent['data'] | null
  gameEndResult: GameEndEvent['data'] | null
}

interface GameActions {
  setPhase: (phase: string) => void
  setPlayerNumber: (num: 1 | 2 | null) => void
  setGameStarted: (p1: string, p2: string) => void
  setRoundStarted: (round: number, total: number, text: string) => void
  setTimer: (remaining: number) => void
  setScoreUpdate: (p1Score: number, p2Score: number) => void
  reset: () => void
  // Phase 3 additions:
  setSubmittedAnswer: (value: boolean) => void
  setMyAnswer: (value: number | null) => void
  resetRound: () => void
}

type GameStore = GameState & GameActions

export const initialState: GameState = {
  phase: 'idle',
  playerNumber: null,
  player1Nickname: '',
  player2Nickname: '',
  player1Score: 0,
  player2Score: 0,
  currentRound: 0,
  totalRounds: 9,
  questionText: '',
  remaining: 10,
  // Phase 3 additions:
  ws: null,
  submittedAnswer: false,
  myAnswer: null,
  roundResult: null,
  gameEndResult: null,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setPlayerNumber: (num) => set({ playerNumber: num }),
  setGameStarted: (p1, p2) =>
    set({
      phase: 'playing',
      player1Nickname: p1,
      player2Nickname: p2,
    }),
  setRoundStarted: (round, total, text) =>
    set({
      currentRound: round,
      totalRounds: total,
      questionText: text,
      remaining: 10,
    }),
  setTimer: (remaining) => set({ remaining }),
  setScoreUpdate: (p1Score, p2Score) =>
    set({
      player1Score: p1Score,
      player2Score: p2Score,
    }),
  reset: () => set(initialState),

  // Phase 3 additions:
  setSubmittedAnswer: (value) => set({ submittedAnswer: value }),
  setMyAnswer: (value) => set({ myAnswer: value }),
  resetRound: () =>
    set({
      submittedAnswer: false,
      myAnswer: null,
      roundResult: null,
    }),
}))
