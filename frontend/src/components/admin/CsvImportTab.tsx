import { motion, AnimatePresence } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { useAdminStore } from '../../stores/adminStore'

interface PreviewRow {
  text: string
  answer: string
  category: string
}

type Stage = 'initial' | 'preview' | 'result'

export default function CsvImportTab() {
  const [stage, setStage] = useState<Stage>('initial')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [uploadResult, setUploadResult] = useState<{
    added: number
    errors: string[]
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setCsvResult = useAdminStore((s) => s.setCsvResult)
  const clearCsvResult = useAdminStore((s) => s.clearCsvResult)
  const setQuestions = useAdminStore((s) => s.setQuestions)
  const setTotalQuestions = useAdminStore((s) => s.setTotalQuestions)

  const resetToInitial = useCallback(() => {
    setStage('initial')
    setSelectedFile(null)
    setPreviewRows([])
    setTotalRows(0)
    setUploadResult(null)
    clearCsvResult()
  }, [clearCsvResult])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        let text = reader.result as string
        // Strip BOM (byte order mark) if present — backend uses utf-8-sig
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1)
        }
        function parseCsvLine(line: string): string[] {
          const parts: string[] = []
          let current = ''
          let inQuotes = false
          for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') {
              // Handle escaped quotes inside quoted field
              if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"'
                i++
              } else {
                inQuotes = !inQuotes
              }
            } else if (ch === ',' && !inQuotes) {
              parts.push(current)
              current = ''
            } else {
              current += ch
            }
          }
          parts.push(current)
          return parts
        }
        const lines = text.split('\n').filter((line) => line.trim())
        const parsed = lines.slice(0, 5).map((line) => {
          const parts = parseCsvLine(line)
          return {
            text: parts[0]?.trim() || '',
            answer: parts[1]?.trim() || '',
            category: parts[2]?.trim() || '',
          }
        })
        setPreviewRows(parsed)
        setTotalRows(lines.length)
        setSelectedFile(file)
        setStage('preview')
      }
      reader.readAsText(file)
    },
    []
  )

  const handleConfirmUpload = useCallback(async () => {
    if (!selectedFile) return
    setUploading(true)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
      const host = window.location.host
      const res = await fetch(`${protocol}//${host}/api/questions/upload-csv`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      setUploadResult(data)
      setCsvResult(data)
      setStage('result')

      // Refresh question list after successful upload
      if (data.added > 0) {
        const listRes = await fetch(`${protocol}//${host}/api/questions/?skip=0&limit=20`)
        if (listRes.ok) {
          const listData = await listRes.json()
          setQuestions(listData.items)
          setTotalQuestions(listData.total)
        }
      }
    } catch {
      setUploadResult({ added: 0, errors: ['Ошибка сети. Проверьте соединение.'] })
      setStage('result')
    } finally {
      setUploading(false)
    }
  }, [selectedFile, setCsvResult, setQuestions, setTotalQuestions])

  const renderInitial = () => (
    <motion.div
      key="initial"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-wb-text-muted/30 p-8"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        aria-label="Выберите CSV-файл"
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-wb-text-muted"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-lg font-semibold text-wb-text">
          Выберите CSV-файл
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </motion.div>
  )

  const renderPreview = () => (
    <motion.div
      key="preview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="mb-3 text-sm font-semibold text-wb-text">
        {selectedFile?.name}
      </p>

      <div className="overflow-hidden rounded-lg bg-wb-bg">
        {/* Header */}
        <div className="flex flex-row bg-wb-surface px-3 py-2 text-sm font-semibold text-wb-text">
          <span className="w-10 flex-shrink-0 text-wb-text-muted">#</span>
          <span className="flex-1">Текст</span>
          <span className="w-20 flex-shrink-0 text-right">Ответ</span>
          <span className="ml-2 w-24 flex-shrink-0 text-right">Категория</span>
        </div>

        {/* Data rows */}
        {previewRows.map((row, i) => (
          <div
            key={i}
            className={`flex flex-row px-3 py-2 text-sm text-wb-text ${
              i % 2 === 0 ? '' : 'bg-wb-surface/50'
            }`}
          >
            <span className="w-10 flex-shrink-0 font-mono text-wb-text-muted">
              {i + 1}
            </span>
            <span className="flex-1 truncate">{row.text}</span>
            <span className="w-20 flex-shrink-0 text-right font-mono">
              {row.answer}
            </span>
            <span className="ml-2 w-24 flex-shrink-0 truncate text-right text-wb-text-muted">
              {row.category || '-'}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-sm text-wb-text-muted">
        Показаны первые 5 строк из {totalRows}
      </p>

      <div className="mt-4 flex flex-row gap-3">
        <button
          type="button"
          onClick={resetToInitial}
          className="min-h-[44px] flex-1 rounded-lg border border-wb-text-muted/30 text-sm font-semibold text-wb-text"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleConfirmUpload}
          disabled={uploading}
          className="min-h-[44px] flex-1 rounded-lg bg-player1 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? 'Загрузка...' : 'Да, импортировать'}
        </button>
      </div>
    </motion.div>
  )

  const renderResult = () => (
    <motion.div
      key="result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="rounded-xl bg-wb-surface p-4">
        {/* Success line */}
        {uploadResult && uploadResult.added > 0 && (
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-correct"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-sm font-semibold text-correct">
              Успешно добавлено: {uploadResult.added}
            </span>
          </div>
        )}

        {/* Errors */}
        {uploadResult && uploadResult.errors.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-danger">Ошибки:</p>
            <div className="mt-1 max-h-[200px] overflow-y-auto">
              {uploadResult.errors.map((err, i) => (
                <p key={i} className="text-sm text-danger">
                  {'•'} {err}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Show added=0 success line even if there were only errors */}
        {uploadResult && uploadResult.added === 0 && uploadResult.errors.length === 0 && (
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-correct"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-sm font-semibold text-correct">
              Успешно добавлено: 0
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={resetToInitial}
          className="mt-4 min-h-[44px] w-full rounded-lg border border-wb-text-muted/30 text-sm font-semibold text-wb-text"
        >
          Добавить ещё
        </button>
      </div>
    </motion.div>
  )

  return (
    <div>
      <AnimatePresence mode="wait">
        {stage === 'initial' && renderInitial()}
        {stage === 'preview' && renderPreview()}
        {stage === 'result' && renderResult()}
      </AnimatePresence>
    </div>
  )
}
