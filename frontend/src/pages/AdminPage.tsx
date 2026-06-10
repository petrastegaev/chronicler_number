import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import BottomTabBar from '../components/admin/BottomTabBar'
import GameControlTab from '../components/admin/GameControlTab'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'game' | 'questions'>('game')

  return (
    <main className="flex min-h-screen flex-col bg-wb-bg">
      {/* Main content area — pb-16 to clear fixed bottom tab bar */}
      <div className="flex-1 overflow-y-auto pb-16">
        <AnimatePresence mode="wait">
          {activeTab === 'game' ? (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <GameControlTab />
            </motion.div>
          ) : (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center px-4 pt-6"
            >
              <h2 className="text-lg font-semibold text-wb-text">Вопросы</h2>
              <p className="mt-2 text-sm text-wb-text-muted">
                Управление вопросами (скоро)
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  )
}
