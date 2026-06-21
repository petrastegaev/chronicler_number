import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface ToastProps {
  message: string | null
  onDismiss: () => void
}

export default function Toast({ message, onDismiss }: ToastProps) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (message !== null) {
      const timer = setTimeout(() => {
        onDismissRef.current()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <AnimatePresence>
        {message !== null && (
          <motion.div
            className="rounded-lg border border-wb-text-muted/20 bg-wb-surface px-5 py-3 shadow-lg"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-center text-sm font-semibold text-wb-text">
              {message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
