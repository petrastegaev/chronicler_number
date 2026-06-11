import { useCallback, useState } from 'react'
import { useAdminStore } from '../../stores/adminStore'
import { useAdminWebSocket } from '../../hooks/useAdminWebSocket'
import GameStats from './GameStats'
import PlayerSlot from './PlayerSlot'

export default function GameControlTab() {
  const { startGame, restart } = useAdminWebSocket()
  const [startingGame, setStartingGame] = useState(false)

  const phase = useAdminStore((s) => s.phase)
  const player1Nickname = useAdminStore((s) => s.player1Nickname)
  const player2Nickname = useAdminStore((s) => s.player2Nickname)
  const player1Online = useAdminStore((s) => s.player1Online)
  const player2Online = useAdminStore((s) => s.player2Online)
  const player1Score = useAdminStore((s) => s.player1Score)
  const player2Score = useAdminStore((s) => s.player2Score)
  const currentRound = useAdminStore((s) => s.currentRound)
  const totalRounds = useAdminStore((s) => s.totalRounds)
  const totalQuestions = useAdminStore((s) => s.totalQuestions)

  // Reset startingGame when phase changes to playing (server confirmed start)
  if (startingGame && phase === 'playing') {
    setStartingGame(false)
  }

  const canStartGame =
    player1Online &&
    player2Online &&
    player1Nickname.length > 0 &&
    player2Nickname.length > 0 &&
    totalQuestions >= 9

  const handleStartGame = useCallback(() => {
    if (startingGame || !canStartGame) return
    setStartingGame(true)
    startGame()
  }, [startingGame, canStartGame, startGame])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-wb-text">Дуэль чисел</h2>
        <p className="text-sm text-wb-text-muted">Панель ведущего</p>
      </div>

      {/* Player slots */}
      <div className="flex flex-row gap-3">
        <PlayerSlot
          playerNum={1}
          nickname={player1Nickname || null}
          isOnline={player1Online}
          isPlayer1
        />
        <PlayerSlot
          playerNum={2}
          nickname={player2Nickname || null}
          isOnline={player2Online}
          isPlayer1={false}
        />
      </div>

      {/* Score row (visible during playing/finished) */}
      {(phase === 'playing' || phase === 'finished') && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold text-player1">
              {player1Score}
            </span>
            <span className="text-lg text-wb-text-muted">:</span>
            <span className="text-3xl font-semibold text-player2">
              {player2Score}
            </span>
          </div>
          <span className="text-sm font-semibold text-wb-text-muted">
            Раунд {currentRound} / {totalRounds}
          </span>
        </div>
      )}

      {/* Question pool warning (visible in lobby when totalQuestions < 9) */}
      {phase === 'lobby' && totalQuestions < 9 && (
        <div className="flex flex-row items-start gap-2 rounded-xl border border-warning/30 bg-warning/15 p-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            className="mt-0.5 flex-shrink-0 text-warning"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M12 9v4" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M12 17h.01"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm text-warning">
            Недостаточно вопросов в базе ({totalQuestions} / 9). Игра не может
            начаться.
          </span>
        </div>
      )}

      {/* Action button */}
      {phase === 'lobby' && (
        <button
          type="button"
          onClick={handleStartGame}
          disabled={!canStartGame || startingGame}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-player1 px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {startingGame ? 'Запуск...' : 'Запустить игру'}
        </button>
      )}
      {phase === 'finished' && (
        <button
          type="button"
          onClick={restart}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-player1 px-6 font-semibold text-white"
        >
          Рестарт
        </button>
      )}

      {/* Statistics */}
      <GameStats />
    </div>
  )
}
