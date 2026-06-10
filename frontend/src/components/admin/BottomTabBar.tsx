interface BottomTabBarProps {
  activeTab: 'game' | 'questions'
  onTabChange: (tab: 'game' | 'questions') => void
}

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-wb-text-muted/20 bg-wb-surface">
      <button
        type="button"
        onClick={() => onTabChange('game')}
        className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          fill="none"
          className={activeTab === 'game' ? 'text-player1' : 'text-wb-text-muted'}
        >
          <path
            d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8v8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          className={`text-sm ${activeTab === 'game' ? 'font-semibold text-wb-text' : 'text-wb-text-muted'}`}
        >
          Игра
        </span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange('questions')}
        className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          fill="none"
          className={activeTab === 'questions' ? 'text-player1' : 'text-wb-text-muted'}
        >
          <path
            d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="9"
            y="3"
            width="6"
            height="4"
            rx="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 12h6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          className={`text-sm ${activeTab === 'questions' ? 'font-semibold text-wb-text' : 'text-wb-text-muted'}`}
        >
          Вопросы
        </span>
      </button>
    </nav>
  )
}
