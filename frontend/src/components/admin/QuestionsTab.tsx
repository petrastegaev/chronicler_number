import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAdminStore } from '../../stores/adminStore'
import CsvImportTab from './CsvImportTab'
import QuestionListTab from './QuestionListTab'
import QuestionAddTab from './QuestionAddTab'

export default function QuestionsTab() {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add' | 'csv'>('list')
  const totalQuestions = useAdminStore((s) => s.totalQuestions)

  const subTabs: { key: 'list' | 'add' | 'csv'; label: string }[] = [
    { key: 'list', label: `Список (${totalQuestions})` },
    { key: 'add', label: 'Добавить' },
    { key: 'csv', label: 'CSV' },
  ]

  return (
    <div className="flex flex-col">
      {/* Sub-tab bar */}
      <div className="flex h-11 flex-row items-stretch bg-transparent">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-semibold ${
                isActive
                  ? 'border-b-2 border-player1 text-wb-text'
                  : 'border-b-2 border-transparent text-wb-text-muted'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content area */}
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {activeSubTab === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <QuestionListTab />
            </motion.div>
          )}
          {activeSubTab === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <QuestionAddTab />
            </motion.div>
          )}
          {activeSubTab === 'csv' && (
            <motion.div
              key="csv"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <CsvImportTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
