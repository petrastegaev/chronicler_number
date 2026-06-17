import { useGameStore } from '../stores/gameStore'

export default function GameHeader() {
  const playerNumber = useGameStore((s) => s.playerNumber)
  const player1Nickname = useGameStore((s) => s.player1Nickname)
  const player2Nickname = useGameStore((s) => s.player2Nickname)
  const player1Score = useGameStore((s) => s.player1Score)
  const player2Score = useGameStore((s) => s.player2Score)
  const currentRound = useGameStore((s) => s.currentRound)
  const totalRounds = useGameStore((s) => s.totalRounds)

  const ownNickname =
    playerNumber === 1 ? player1Nickname : playerNumber === 2 ? player2Nickname : ''
  const ownScore = playerNumber === 1 ? player1Score : playerNumber === 2 ? player2Score : 0
  const playerAccentClass =
    playerNumber === 1 ? 'text-player1' : playerNumber === 2 ? 'text-player2' : 'text-wb-text'

  return (
    <header className="flex w-full items-center justify-between bg-wb-surface py-2 px-4">
      <span className={`text-base font-regular ${playerAccentClass}`}>
        {ownNickname}
      </span>
      <span className="text-base font-regular text-wb-text-muted">Число летописца</span>
      <span className="text-base font-regular text-wb-text-muted">
        <span className={`text-xl font-semibold leading-[1.3] ${playerAccentClass}`}>
          {ownScore}
        </span>
        {' '}
        &middot;{' '}
        <span>Раунд {currentRound} / {totalRounds}</span>
      </span>
    </header>
  )
}
