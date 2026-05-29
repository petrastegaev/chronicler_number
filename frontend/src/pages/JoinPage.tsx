export default function JoinPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-wb-bg px-4">
      <h1 className="text-4xl font-bold text-wb-text">Дуэль чисел</h1>
      <p className="mt-2 text-2xl font-semibold text-player1">Экран входа</p>
      <p className="mt-4 text-base text-wb-text-muted">
        Подключение первого игрока...
      </p>
      <span className="mt-8 rounded bg-wb-surface px-3 py-1 text-sm text-wb-text-muted">
        Заглушка
      </span>
    </main>
  )
}
