import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { useStore } from '../store'

import {
  createAssetFolder,
  DEFAULT_ASSET_FOLDER_ID,
  deleteAssetFolder,
  getAssetDisplayName,
  loadAssetLibrary,
  renameAssetFolder,
  saveAssetLibrary,
  type AssetFolder,
  type AssetItem,
  type AssetLibraryState,
} from '../lib/assetLibrary'

interface Props {
  open: boolean
  onClose: () => void
}

function FolderIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7.5A2.5 2.5 0 015.5 5h4l2 2h7A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-9z" />
    </svg>
  )
}

function getFolderItems(items: AssetItem[], folderId: string, query: string) {
  const normalized = query.trim().toLowerCase()
  return items.filter(item => {
    const displayName = getAssetDisplayName(item.name).toLowerCase()
    return item.folderId === folderId &&
      (!normalized || item.name.toLowerCase().includes(normalized) || displayName.includes(normalized))
  })
}

export default function AssetLibraryDrawer({ open, onClose }: Props) {
  const [library, setLibrary] = useState<AssetLibraryState>(() => loadAssetLibrary())
  const [selectedFolderId, setSelectedFolderId] = useState(DEFAULT_ASSET_FOLDER_ID)
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([DEFAULT_ASSET_FOLDER_ID])
  const [search, setSearch] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [createFolderInput, setCreateFolderInput] = useState('')
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const showToast = useStore((s) => s.showToast)

  const persistLibrary = (next: AssetLibraryState) => {
    setLibrary(next)
    saveAssetLibrary(next)
  }

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

  const selectedFolder = library.folders.find(item => item.id === selectedFolderId) ?? library.folders[0]
  const visibleFolders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return library.folders
    const matchedFolderIds = new Set(library.items.filter(item => {
      const displayName = getAssetDisplayName(item.name).toLowerCase()
      return item.name.toLowerCase().includes(q) || displayName.includes(q)
    }).map(item => item.folderId))
    return library.folders.filter(folder => folder.name.toLowerCase().includes(q) || matchedFolderIds.has(folder.id))
  }, [library, search])

  if (!rendered) return null

  const startCreateFolder = () => {
    setCreatingFolder(true)
    setCreateFolderInput('')
  }

  const cancelCreateFolder = () => {
    setCreatingFolder(false)
    setCreateFolderInput('')
  }

  const commitCreateFolder = () => {
    try {
      const folder = createAssetFolder(createFolderInput)
      persistLibrary({ ...library, folders: [...library.folders, folder] })
      setSelectedFolderId(folder.id)
      setExpandedFolderIds(ids => Array.from(new Set([...ids, folder.id])))
      setSearch('')
      cancelCreateFolder()
      showToast('文件夹已创建', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const startRenameFolder = (folder: AssetFolder) => {
    setRenamingFolderId(folder.id)
    setRenameInput(folder.name)
  }

  const commitRenameFolder = (folder: AssetFolder) => {
    try {
      const renamed = renameAssetFolder(folder, renameInput)
      persistLibrary({ ...library, folders: library.folders.map(item => item.id === folder.id ? renamed : item) })
      setRenamingFolderId(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const removeFolder = (folderId: string) => {
    if (folderId === DEFAULT_ASSET_FOLDER_ID) return
    persistLibrary(deleteAssetFolder(library, folderId))
    if (selectedFolderId === folderId) setSelectedFolderId(DEFAULT_ASSET_FOLDER_ID)
    showToast('文件夹已删除，素材已移入默认', 'info')
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds(ids => ids.includes(folderId) ? ids.filter(id => id !== folderId) : [...ids, folderId])
  }

  const selectFolder = (folderId: string) => {
    setSelectedFolderId(folderId)
    toggleFolder(folderId)
  }

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
            <div className="mb-4 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-gray-200/70 bg-white px-3 py-2 text-gray-400 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索素材或文件夹" className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500" />
              </div>
              <button type="button" onClick={startCreateFolder} className="shrink-0 rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200" title="新建文件夹">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" /></svg>
              </button>
            </div>

            <div className="space-y-1.5">
              {creatingFolder && (
                <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/80 px-2.5 py-2 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white">
                    <FolderIcon className="h-5 w-5" />
                  </span>
                  <input
                    value={createFolderInput}
                    autoFocus
                    onChange={(e) => setCreateFolderInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitCreateFolder()
                      if (e.key === 'Escape') cancelCreateFolder()
                    }}
                    placeholder="输入文件夹名称"
                    className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-blue-300 dark:border-blue-500/30 dark:bg-white/[0.06] dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                  <button type="button" onClick={commitCreateFolder} className="rounded-lg px-2 py-1 text-xs text-blue-500 hover:bg-white/70 hover:text-blue-600 dark:hover:bg-white/[0.06] dark:hover:text-blue-300">创建</button>
                  <button type="button" onClick={cancelCreateFolder} className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-white/70 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200">取消</button>
                </div>
              )}
              {visibleFolders.map(folder => {
                const isExpanded = expandedFolderIds.includes(folder.id)
                const isSelected = selectedFolder?.id === folder.id
                const items = getFolderItems(library.items, folder.id, search)
                return (
                  <div key={folder.id}>
                    <div
                      className={`group flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition ${isSelected ? 'border-blue-200 bg-blue-50/80 dark:border-blue-500/30 dark:bg-blue-500/10' : 'border-transparent hover:border-gray-200/70 hover:bg-gray-50 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.04]'}`}
                    >
                      <button type="button" onClick={() => selectFolder(folder.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500'}`}>
                          <FolderIcon className="h-5 w-5" />
                        </span>
                        {renamingFolderId === folder.id ? (
                          <input
                            value={renameInput}
                            autoFocus
                            onChange={(e) => setRenameInput(e.target.value)}
                            onBlur={() => commitRenameFolder(folder)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRenameFolder(folder)
                              if (e.key === 'Escape') setRenamingFolderId(null)
                            }}
                            className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-blue-300 dark:border-blue-500/30 dark:bg-white/[0.06] dark:text-gray-100"
                          />
                        ) : (
                          <span className={`truncate text-sm font-medium ${isSelected ? 'text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{folder.name}</span>
                        )}
                      </button>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">{items.length}</span>
                      {renamingFolderId !== folder.id && (
                        <div className="hidden items-center gap-1 group-hover:flex">
                          <button type="button" onClick={() => startRenameFolder(folder)} className="rounded-lg px-1.5 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200">重命名</button>
                          {folder.id !== DEFAULT_ASSET_FOLDER_ID && (
                            <button type="button" onClick={() => removeFolder(folder.id)} className="rounded-lg px-1.5 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">删除</button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={`asset-folder-collapse ${isExpanded ? '' : 'collapsed'}`}>
                      <div className="asset-folder-collapse-inner">
                        {items.length > 0 ? (
                          <div className="mt-2 space-y-1.5 pb-3">
                            <p className="ml-11 text-xs text-gray-400">{items.length} 张素材</p>
                          </div>
                        ) : (
                          <div className="ml-11 mt-2 rounded-2xl border border-dashed border-gray-200/80 px-3 py-4 text-center text-xs text-gray-400 dark:border-white/[0.08] dark:text-gray-500">
                            暂无图片素材
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
