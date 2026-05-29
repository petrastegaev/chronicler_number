import { create } from 'zustand'

interface GameState {
  phase: string
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'idle',
}))
