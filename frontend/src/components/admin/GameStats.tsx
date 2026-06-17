import { useEffect, useState } from 'react'
import { useAdminStore } from '../../stores/adminStore'
import { apiFetch } from '../../hooks/apiFetch'

export default function GameStats() {
  const [gameCount, setGameCount] = useState(0)
  const phase = useAdminStore((s) => s.phase)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const host = window.location.host
    apiFetch(`${protocol}//${host}/api/stats/`)
      .then((res) => res.json())
      .then((data) => {
        setGameCount(data.game_count)
      })
      .catch(() => {
        // Network error — silently keep gameCount at 0
      })
  }, [phase])

  return (
    <p className="py-4 text-center text-sm font-semibold text-wb-text-muted">
      Сыграно игр: {gameCount}
    </p>
  )
}
