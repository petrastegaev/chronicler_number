import { create } from 'zustand'

interface Question {
  id: number
  text: string
  answer: number
  category: string | null
  created_at: string
}

interface AdminState {
  phase: 'connecting' | 'waiting' | 'lobby' | 'playing' | 'finished'
  player1Nickname: string
  player2Nickname: string
  player1Online: boolean
  player2Online: boolean
  player1Score: number
  player2Score: number
  currentRound: number
  totalRounds: number
  questionText: string
  ws: WebSocket | null
  gameCount: number
  questions: Question[]
  totalQuestions: number
  csvResult: { added: number; errors: string[] } | null
  token: string | null
  adminKey: string | null
  authError: string | null
  everJoined: boolean
}

interface AdminActions {
  setPhase: (phase: AdminState['phase']) => void
  setPlayer1Nickname: (name: string) => void
  setPlayer2Nickname: (name: string) => void
  setPlayer1Online: (online: boolean) => void
  setPlayer2Online: (online: boolean) => void
  setPlayer1Score: (score: number) => void
  setPlayer2Score: (score: number) => void
  setCurrentRound: (round: number) => void
  setTotalRounds: (rounds: number) => void
  setQuestionText: (text: string) => void
  setWs: (ws: WebSocket | null) => void
  setGameCount: (count: number) => void
  setQuestions: (questions: Question[]) => void
  setTotalQuestions: (total: number) => void
  setCsvResult: (result: { added: number; errors: string[] } | null) => void
  clearCsvResult: () => void
  setToken: (token: string | null) => void
  setAdminKey: (key: string | null) => void
  setAuthError: (error: string | null) => void
  setEverJoined: (value: boolean) => void
  resetPlayers: () => void
  setGameStarted: (p1Nickname: string, p2Nickname: string) => void
  setScoreUpdate: (p1Score: number, p2Score: number) => void
  resetForRestart: () => void
  reset: () => void
}

type AdminStore = AdminState & AdminActions

const initialState: AdminState = {
  phase: 'waiting',
  player1Nickname: '',
  player2Nickname: '',
  player1Online: false,
  player2Online: false,
  player1Score: 0,
  player2Score: 0,
  currentRound: 0,
  totalRounds: 9,
  questionText: '',
  ws: null,
  gameCount: 0,
  questions: [],
  totalQuestions: 0,
  csvResult: null,
  token: null,
  adminKey: null,
  authError: null,
  everJoined: false,
}

export const useAdminStore = create<AdminStore>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setEverJoined: (value) => set({ everJoined: value }),
  setPlayer1Nickname: (name) => set({ player1Nickname: name }),
  setPlayer2Nickname: (name) => set({ player2Nickname: name }),
  setPlayer1Online: (online) => set({ player1Online: online }),
  setPlayer2Online: (online) => set({ player2Online: online }),
  setPlayer1Score: (score) => set({ player1Score: score }),
  setPlayer2Score: (score) => set({ player2Score: score }),
  setCurrentRound: (round) => set({ currentRound: round }),
  setTotalRounds: (rounds) => set({ totalRounds: rounds }),
  setQuestionText: (text) => set({ questionText: text }),
  setWs: (ws) => set({ ws }),
  setGameCount: (count) => set({ gameCount: count }),
  setQuestions: (questions) => set({ questions }),
  setTotalQuestions: (total) => set({ totalQuestions: total }),
  setCsvResult: (result) => set({ csvResult: result }),
  clearCsvResult: () => set({ csvResult: null }),
  setToken: (token) => set({ token }),
  setAdminKey: (key) => set({ adminKey: key }),
  setAuthError: (error) => set({ authError: error }),

  resetPlayers: () =>
    set({
      phase: 'lobby',
      player1Nickname: '',
      player2Nickname: '',
      player1Online: false,
      player2Online: false,
      player1Score: 0,
      player2Score: 0,
      currentRound: 0,
    }),

  setGameStarted: (p1Nickname, p2Nickname) =>
    set({
      phase: 'playing',
      player1Nickname: p1Nickname,
      player2Nickname: p2Nickname,
      player1Score: 0,
      player2Score: 0,
    }),

  setScoreUpdate: (p1Score, p2Score) =>
    set({
      player1Score: p1Score,
      player2Score: p2Score,
    }),

  resetForRestart: () =>
    set({
      phase: 'lobby',
      player1Score: 0,
      player2Score: 0,
      currentRound: 0,
      player1Online: false,
      player2Online: false,
      authError: null,
      // Keep nicknames + everJoined for rejoin convenience (Pitfall 1 in RESEARCH.md)
      // Online booleans reset — players must reconnect to be marked Ready
    }),

  reset: () => set(initialState),
}))
