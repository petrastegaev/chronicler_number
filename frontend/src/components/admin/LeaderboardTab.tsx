import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { apiFetch } from '../../hooks/apiFetch'

interface LeaderboardEntry {
  rank: number
  nickname: string
  games_played: number
  wins: number
  losses: number
  win_rate: number
  total_score: number
}

type LoadState = 'loading' | 'loaded' | 'error' | 'empty'

function rankBadge(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

export default function LeaderboardTab() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
    const host = window.location.host
    apiFetch(`${protocol}//${host}/api/stats/leaderboard?limit=20`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!data.entries || data.entries.length === 0) {
          setState('empty')
        } else {
          setEntries(data.entries)
          setState('loaded')
        }
      })
      .catch(() => {
        setState('error')
      })
  }, [])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-wb-text">Таблица рекордов</h2>
        <p className="text-sm text-wb-text-muted">Лучшие игроки за всё время</p>
      </div>

      {/* Loading */}
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-wb-text-muted/30 border-t-player1" />
          <p className="text-sm text-wb-text-muted">Загрузка...</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-2 py-12">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            className="text-red-400"
          >
            <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 8v4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-wb-text-muted">Не удалось загрузить таблицу рекордов</p>
        </div>
      )}

      {/* Empty */}
      {state === 'empty' && (
        <div className="flex flex-col items-center gap-2 py-12">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            className="text-wb-text-muted"
          >
            <path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-wb-text-muted">Пока нет сыгранных игр</p>
          <p className="text-xs text-wb-text-muted/70">Сыграйте первую игру, чтобы увидеть рекорды</p>
        </div>
      )}

      {/* Table */}
      {state === 'loaded' && (
        <motion.div
          className="overflow-hidden rounded-xl border border-wb-text-muted/20"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-wb-text-muted/20 bg-wb-surface">
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-wb-text-muted">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-wb-text-muted">
                    Игрок
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-wb-text-muted">
                    Игр
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-wb-text-muted">
                    Побед
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-wb-text-muted">
                    Пораж.
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-wb-text-muted">
                    %
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-wb-text-muted">
                    Очки
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const badge = rankBadge(entry.rank)
                  return (
                    <motion.tr
                      key={entry.nickname}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      className="border-b border-wb-text-muted/10 last:border-b-0"
                    >
                      <td className="px-3 py-2.5 text-center font-semibold text-wb-text-muted">
                        {badge ? (
                          <span role="img" aria-label={`rank ${entry.rank}`}>
                            {badge}
                          </span>
                        ) : (
                          entry.rank
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-wb-text">
                        {entry.nickname}
                      </td>
                      <td className="px-3 py-2.5 text-center text-wb-text-muted">
                        {entry.games_played}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-green-400">
                        {entry.wins}
                      </td>
                      <td className="px-3 py-2.5 text-center text-wb-text-muted">
                        {entry.losses}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-wb-text-muted">
                        {Math.round(entry.win_rate * 100)}%
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-wb-text-muted">
                        {entry.total_score}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
