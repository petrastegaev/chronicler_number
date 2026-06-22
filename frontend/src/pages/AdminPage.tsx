import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import BottomTabBar from '../components/admin/BottomTabBar'
import GameControlTab from '../components/admin/GameControlTab'
import LeaderboardTab from '../components/admin/LeaderboardTab'
import QuestionsTab from '../components/admin/QuestionsTab'
import { useAdminStore } from '../stores/adminStore'
import { useAdminWebSocket } from '../hooks/useAdminWebSocket'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'game' | 'questions' | 'leaderboard'>('game')
  const [adminKey, setAdminKey] = useState('')
  const [keyError, setKeyError] = useState('')
  const ws = useAdminStore((s) => s.ws)
  const phase = useAdminStore((s) => s.phase)
  const authError = useAdminStore((s) => s.authError)
  const everJoined = useAdminStore((s) => s.everJoined)
  const { connect } = useAdminWebSocket()

  const handleLogin = () => {
    if (!adminKey.trim()) {
      setKeyError('Введите ключ администратора')
      return
    }
    setKeyError('')
    // Clear stale reconnect token so the first attempt always goes through
    // the normal join flow — a token from a previous session is invalid
    // after server restart (tokens are in-memory only).
    try { sessionStorage.removeItem('ws_reconnect_token_admin') } catch {}
    useAdminStore.getState().setAuthError(null)
    useAdminStore.getState().setAdminKey(adminKey.trim())
    connect(adminKey.trim())
  }

  // Show login screen only when we've never successfully joined.
  // During transient reconnects (ws=null but everJoined=true) keep the
  // admin UI visible so the login form doesn't flash on every reconnect.
  if (!everJoined) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-wb-bg px-4">
        <motion.div
          className="w-full max-w-sm rounded-xl bg-wb-surface p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-semibold text-wb-text text-center">
            Админ-панель
          </h1>
          <p className="mt-2 text-sm text-wb-text-muted text-center">
            Введите ключ администратора для доступа
          </p>
          <input
            type="password"
            placeholder="Ключ администратора"
            value={adminKey}
            onChange={(e) => {
              setAdminKey(e.target.value)
              setKeyError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin()
            }}
            className="mt-4 w-full rounded-lg border border-wb-text-muted/30 bg-wb-bg px-4 py-3 text-base text-wb-text placeholder:text-wb-text-muted focus:border-player1 focus:outline-none"
            autoFocus
          />
          {keyError && (
            <p className="mt-2 text-sm text-red-500">{keyError}</p>
          )}
          {authError && phase === 'waiting' && (
            <p className="mt-2 text-sm text-red-500">{authError}</p>
          )}
          {phase === 'connecting' && (
            <p className="mt-2 text-sm text-wb-text-muted">Подключение...</p>
          )}
          <button
            type="button"
            onClick={handleLogin}
            disabled={phase === 'connecting'}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-lg bg-player1 px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === 'connecting' ? 'Подключение...' : 'Войти'}
          </button>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-wb-bg">
      {/* Reconnecting banner — ws dropped but session still valid */}
      {!ws && (
        <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-sm text-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Переподключение...
        </div>
      )}

      {/* Main content area — pb-16 to clear fixed bottom tab bar */}
      <div className="flex-1 overflow-y-auto pb-16">
        <AnimatePresence mode="wait">
          {activeTab === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <GameControlTab />
            </motion.div>
          )}
          {activeTab === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <QuestionsTab />
            </motion.div>
          )}
          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <LeaderboardTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  )
}
