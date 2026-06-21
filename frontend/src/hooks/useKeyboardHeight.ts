import { useEffect, useState } from 'react'

interface ViewportMetrics {
  /** Visible viewport height in px — shrinks when keyboard opens on iOS. */
  height: number
  /** Extra space needed below the input to keep it above the keyboard. */
  keyboardOffset: number
}

/**
 * Returns the visible viewport height and keyboard offset.
 *
 * On iOS Safari the virtual keyboard overlays the viewport without
 * resizing the layout viewport.  CSS dvh doesn't help here — we must
 * read visualViewport.height directly and shrink the game container
 * to the truly visible area.
 *
 * On desktop (no visualViewport API) falls back to window.innerHeight
 * with zero keyboard offset.
 */
export function useViewportHeight(): ViewportMetrics {
  const [metrics, setMetrics] = useState<ViewportMetrics>({
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    keyboardOffset: 0,
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) {
      // Desktop — no visualViewport, use layout viewport
      const onResize = () => setMetrics({ height: window.innerHeight, keyboardOffset: 0 })
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    const update = () => {
      const visibleHeight = Math.round(vv.height)
      // keyboardOffset = the amount the visual viewport was pushed up
      // (layout viewport minus visible area above keyboard, minus scroll offset)
      const offset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      setMetrics({ height: visibleHeight, keyboardOffset: offset })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return metrics
}
