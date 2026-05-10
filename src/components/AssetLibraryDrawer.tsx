import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AssetLibraryDrawer({ open, onClose }: Props) {
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (open) {
      setRendered(true)
      setClosing(false)
      return
    }
    if (rendered) {
      setClosing(true)
      closeTimerRef.current = window.setTimeout(() => {
        setRendered(false)
        setClosing(false)
      }, 280)
    }
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [open, rendered])

  usePreventBackgroundScroll(rendered)

  if (!rendered) return null

  return createPortal(
    <div data-no-drag-select className="fixed inset-0 z-[120] pointer-events-none p-4">
      <div className={`absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto ${closing ? 'animate-drawer-overlay-out' : 'animate-overlay-in'}`} onMouseDown={onClose} />
      <aside className={`absolute bottom-4 right-4 top-4 flex w-[calc(100%-2rem)] max-w-[440px] pointer-events-auto flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/95 text-gray-800 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-900/95 dark:text-gray-100 dark:ring-white/10 ${closing ? 'animate-drawer-out' : 'animate-drawer-in'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-5 dark:border-white/[0.08]">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-100">
                素材库
              </h2>
              <p className="mt-1.5 text-sm leading-5 text-gray-400 dark:text-gray-500">管理常用图片素材，点击使用可加入参考图。</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200" aria-label="关闭">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar">
            <p className="text-sm text-gray-400">素材库功能加载中...</p>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
