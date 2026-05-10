import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { useStore, ensureImageCached } from '../store'

import {
  createAssetFolder,
  createAssetFromFile,
  DEFAULT_ASSET_FOLDER_ID,
  deleteAssetFolder,
  getAssetDisplayName,
  loadAssetLibrary,
  renameAssetFolder,
  renameAssetItem,
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

function ImageIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4-4a2 2 0 012.828 0L16 17m-2-2l1-1a2 2 0 012.828 0L20 16m-1-11H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2zm-5 4h.01" />
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
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null)
  const [assetRenameInput, setAssetRenameInput] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [createFolderInput, setCreateFolderInput] = useState('')
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [draggedAssetIds, setDraggedAssetIds] = useState<string[]>([])
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [rendered, setRendered] = useState(open)
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const addInputImage = useStore((s) => s.addInputImage)
  const showToast = useStore((s) => s.showToast)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)

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
  const selectedAssetIdSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds])
  const selectedAssetCount = selectedAssetIds.length

  useEffect(() => {
    setSelectedAssetIds(ids => ids.filter(id => library.items.some(item => item.id === id)))
  }, [library.items])

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

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !selectedFolder) return
    const results = await Promise.allSettled(
      Array.from(files).map(file => createAssetFromFile(file, selectedFolder.id)),
    )
    if (uploadInputRef.current) uploadInputRef.current.value = ''
    const newItems: AssetItem[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        newItems.push(result.value.item)
      } else {
        const reason = result.reason
        showToast(reason instanceof Error ? reason.message : String(reason), 'error')
      }
    }
    if (newItems.length > 0) {
      persistLibrary({ ...library, items: [...newItems, ...library.items] })
      setExpandedFolderIds(ids => Array.from(new Set([...ids, selectedFolder.id])))
      showToast(`已上传 ${newItems.length} 张素材`, 'success')
    }
  }

  const addAssetToInput = async (item: AssetItem) => {
    const dataUrl = await ensureImageCached(item.imageId)
    if (!dataUrl) {
      showToast('素材图片已丢失', 'error')
      return
    }
    addInputImage({ id: item.imageId, dataUrl })
    showToast('已添加到当前参考图', 'success')
  }

  const openAssetOriginal = (item: AssetItem) => {
    setLightboxImageId(item.imageId, library.items.map(asset => asset.imageId))
  }

  const removeAsset = (assetId: string) => {
    persistLibrary({ ...library, items: library.items.filter(item => item.id !== assetId) })
    setSelectedAssetIds(ids => ids.filter(id => id !== assetId))
  }

  const startRenameAsset = (item: AssetItem) => {
    setRenamingAssetId(item.id)
    setAssetRenameInput(getAssetDisplayName(item.name))
  }

  const commitRenameAsset = (item: AssetItem) => {
    try {
      const renamed = renameAssetItem(item, assetRenameInput)
      persistLibrary({ ...library, items: library.items.map(asset => asset.id === item.id ? renamed : asset) })
      setRenamingAssetId(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    }
  }

  const toggleAssetSelected = (assetId: string) => {
    setSelectedAssetIds(ids => ids.includes(assetId) ? ids.filter(id => id !== assetId) : [...ids, assetId])
  }

  const removeSelectedAssets = () => {
    if (selectedAssetIds.length === 0) {
      showToast('请先选择要删除的素材', 'info')
      return
    }
    const selected = new Set(selectedAssetIds)
    persistLibrary({ ...library, items: library.items.filter(item => !selected.has(item.id)) })
    setSelectedAssetIds([])
    showToast(`已删除 ${selected.size} 张素材`, 'success')
  }

  const startDragAsset = (event: React.DragEvent<HTMLDivElement>, item: AssetItem) => {
    const ids = selectedAssetIdSet.has(item.id) ? selectedAssetIds : [item.id]
    setDraggedAssetIds(ids)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', ids.join(','))
  }

  const finishDragAsset = () => {
    setDraggedAssetIds([])
    setDragOverFolderId(null)
  }

  const moveDraggedAssetsToFolder = (folderId: string) => {
    if (draggedAssetIds.length === 0) return
    const dragged = new Set(draggedAssetIds)
    const movableIds = library.items.filter(item => dragged.has(item.id) && item.folderId !== folderId).map(item => item.id)
    if (movableIds.length === 0) {
      finishDragAsset()
      return
    }
    const movable = new Set(movableIds)
    persistLibrary({
      ...library,
      items: library.items.map(item => movable.has(item.id) ? { ...item, folderId } : item),
    })
    setSelectedFolderId(folderId)
    setExpandedFolderIds(ids => Array.from(new Set([...ids, folderId])))
    setSelectedAssetIds(ids => ids.filter(id => !movable.has(id)))
    finishDragAsset()
    showToast(`已移动 ${movable.size} 张素材`, 'success')
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
                <ImageIcon className="h-5 w-5 text-blue-500" />
                素材库
              </h2>
              <p className="mt-1.5 text-sm leading-5 text-gray-400 dark:text-gray-500">管理常用图片素材，点击使用可加入参考图。</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200" aria-label="关闭">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleUpload(e.target.files)} />

          <div className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-gray-200/70 bg-white px-3 py-2 text-gray-400 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索素材或文件夹" className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500" />
              </div>
              <button type="button" onClick={startCreateFolder} className="shrink-0 rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200" title="新建文件夹">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" /></svg>
              </button>
              <button type="button" onClick={() => uploadInputRef.current?.click()} className="shrink-0 rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200" title="上传图片">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </button>
              <button type="button" onClick={removeSelectedAssets} className={`relative shrink-0 rounded-xl p-2 transition ${selectedAssetCount > 0 ? 'text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-400'}`} title={selectedAssetCount > 0 ? `删除选中的 ${selectedAssetCount} 张素材` : '删除选中素材'}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0h10" /></svg>
                {selectedAssetCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{selectedAssetCount}</span>}
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
                  <div
                    key={folder.id}
                    onDragOver={(e) => {
                      if (draggedAssetIds.length === 0) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverFolderId(folder.id)
                    }}
                    onDragLeave={(e) => {
                      const nextTarget = e.relatedTarget
                      if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return
                      setDragOverFolderId(current => current === folder.id ? null : current)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      moveDraggedAssetsToFolder(folder.id)
                    }}
                  >
                    <div
                      className={`group flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition ${dragOverFolderId === folder.id ? 'border-blue-300 bg-blue-100/80 ring-2 ring-blue-200/70 dark:border-blue-400/40 dark:bg-blue-500/15 dark:ring-blue-500/20' : isSelected ? 'border-blue-200 bg-blue-50/80 dark:border-blue-500/30 dark:bg-blue-500/10' : 'border-transparent hover:border-gray-200/70 hover:bg-gray-50 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.04]'}`}
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
                            {items.map(item => {
                              const isAssetSelected = selectedAssetIdSet.has(item.id)
                              return (
                                <div
                                  key={item.id}
                                  data-image-context-root
                                  data-image-id={item.imageId}
                                  draggable={renamingAssetId !== item.id}
                                  onDragStart={(e) => startDragAsset(e, item)}
                                  onDragEnd={finishDragAsset}
                                  onClick={() => toggleAssetSelected(item.id)}
                                  className={`group flex cursor-pointer items-center gap-3 rounded-2xl border px-2 py-2 transition ${draggedAssetIds.includes(item.id) ? 'opacity-45' : ''} ${isAssetSelected ? 'border-blue-200 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10' : 'border-transparent hover:border-gray-200/70 hover:bg-gray-50 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.04]'}`}
                                  title={isAssetSelected ? '取消选择' : '选择素材'}
                                >
                                  <span className={`ml-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${isAssetSelected ? 'border-blue-500 bg-blue-500 text-white opacity-100 shadow-sm' : 'border-transparent bg-transparent text-transparent opacity-0'}`}>
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  </span>
                                <div
                                  onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    openAssetOriginal(item)
                                  }}
                                  className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-gray-200/70 bg-gray-100 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
                                  title="双击打开原图"
                                >
                                  <AssetThumb imageId={item.imageId} name={item.name} />
                                </div>
                                {renamingAssetId === item.id ? (
                                  <input
                                    value={assetRenameInput}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setAssetRenameInput(e.target.value)}
                                    onBlur={() => commitRenameAsset(item)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') commitRenameAsset(item)
                                      if (e.key === 'Escape') setRenamingAssetId(null)
                                    }}
                                    className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-blue-300 dark:border-blue-500/30 dark:bg-white/[0.06] dark:text-gray-100"
                                  />
                                ) : (
                                  <div className="min-w-0 flex-1 text-left">
                                    <div className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">{getAssetDisplayName(item.name)}</div>
                                  </div>
                                )}
                                {renamingAssetId !== item.id && (
                                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); void addAssetToInput(item) }} className="rounded-lg px-2 py-1 text-xs text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-300">使用</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); startRenameAsset(item) }} className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200">重命名</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeAsset(item.id) }} className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">删除</button>
                                  </div>
                                )}
                                </div>
                              )
                            })}
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

function AssetThumb({ imageId, name }: { imageId: string; name: string }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    ensureImageCached(imageId).then(dataUrl => {
      if (!cancelled && dataUrl) setSrc(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [imageId])

  return src
    ? <img src={src} alt={name} data-image-id={imageId} className="h-full w-full object-cover" />
    : <div className="h-full w-full animate-pulse bg-gray-100 dark:bg-white/[0.06]" />
}
