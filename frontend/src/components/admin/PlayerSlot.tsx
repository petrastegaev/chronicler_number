interface PlayerSlotProps {
  playerNum: 1 | 2
  nickname: string | null
  isOnline: boolean
  isPlayer1: boolean
}

export default function PlayerSlot({ playerNum, nickname, isOnline, isPlayer1 }: PlayerSlotProps) {
  const displayName = nickname ?? (playerNum === 1 ? 'Игрок 1' : 'Игрок 2')

  return (
    <div className="flex flex-1 flex-col rounded-xl bg-wb-surface p-4">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${isPlayer1 ? 'bg-player1' : 'bg-player2'}`} />
        <span className="text-lg font-semibold text-wb-text">{displayName}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {isOnline ? (
          <>
            <span className="h-3 w-3 rounded-full bg-correct" />
            <span className="text-sm text-correct">Готов</span>
          </>
        ) : (
          <>
            <span className="h-3 w-3 rounded-full bg-wb-text-muted/50" />
            <span className="text-sm text-wb-text-muted">Нет подключения</span>
          </>
        )}
      </div>
    </div>
  )
}
