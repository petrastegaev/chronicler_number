import { motion, AnimatePresence } from 'motion/react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  confirmVariant?: 'danger' | 'primary'
}

export default function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,10,46,0.85)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="mx-4 max-w-sm rounded-xl bg-wb-surface p-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-lg font-semibold text-wb-text">{title}</h3>
            <p className="mt-2 text-sm text-wb-text-muted">{body}</p>
            <div className="mt-6 flex flex-row gap-3">
              <button
                className="min-h-[44px] flex-1 rounded-lg border border-wb-text-muted/30 text-sm font-semibold text-wb-text"
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
              <button
                className={`min-h-[44px] flex-1 rounded-lg text-sm font-semibold text-white ${
                  confirmVariant === 'primary' ? 'bg-player1' : 'bg-danger'
                }`}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
