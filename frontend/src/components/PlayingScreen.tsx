import { motion } from 'motion/react'

export default function PlayingScreen() {
  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <p className="text-base text-wb-text-muted">Загрузка...</p>
    </motion.div>
  )
}
