import type { InputImage } from '../types'
import { storeImage } from './db'

export interface AssetFolder {
  id: string
  name: string
  createdAt: number
}

export interface AssetItem {
  id: string
  imageId: string
  name: string
  folderId: string
  type: 'image'
  createdAt: number
}

export interface AssetLibraryState {
  folders: AssetFolder[]
  items: AssetItem[]
}

export const ASSET_LIBRARY_STORAGE_KEY = 'gpt-image-playground.assetLibrary.v1'
export const DEFAULT_ASSET_FOLDER_ID = 'default'

const DEFAULT_FOLDERS: AssetFolder[] = [
  { id: DEFAULT_ASSET_FOLDER_ID, name: '默认', createdAt: 0 },
]

const MAX_ASSET_FILE_SIZE = 20 * 1024 * 1024

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function sanitizeFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function sanitizeFileName(name: string): string {
  return name.trim() || '未命名图片'
}

export function getAssetDisplayName(name: string): string {
  return sanitizeFileName(name).replace(/\.[a-z0-9]{1,8}$/i, '') || '未命名图片'
}

export function renameAssetItem(item: AssetItem, name: string): AssetItem {
  const sanitized = sanitizeFileName(name)
  if (!sanitized) throw new Error('请输入素材名称')
  return { ...item, name: sanitized }
}

export function getDefaultAssetLibraryState(): AssetLibraryState {
  return { folders: [...DEFAULT_FOLDERS], items: [] }
}

export function normalizeAssetLibraryState(value: unknown): AssetLibraryState {
  if (!value || typeof value !== 'object') return getDefaultAssetLibraryState()
  const raw = value as Partial<AssetLibraryState>
  const folders = Array.isArray(raw.folders)
    ? raw.folders
        .filter((item): item is AssetFolder => Boolean(
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.createdAt === 'number',
        ))
        .map(item => ({ ...item, name: sanitizeFolderName(item.name) || '未命名文件夹' }))
    : []
  const folderIds = new Set([...DEFAULT_FOLDERS, ...folders].map(item => item.id))
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((item): item is AssetItem => Boolean(
          item &&
          typeof item.id === 'string' &&
          typeof item.imageId === 'string' &&
          typeof item.name === 'string' &&
          typeof item.folderId === 'string' &&
          typeof item.createdAt === 'number',
        ))
        .map(item => ({
          ...item,
          name: sanitizeFileName(item.name),
          type: 'image' as const,
          folderId: folderIds.has(item.folderId) ? item.folderId : DEFAULT_ASSET_FOLDER_ID,
        }))
    : []

  const defaultFolder = folders.find(f => f.id === DEFAULT_ASSET_FOLDER_ID) ?? DEFAULT_FOLDERS[0]
  const userFolders = folders.filter(f => f.id !== DEFAULT_ASSET_FOLDER_ID)

  return {
    folders: [defaultFolder, ...userFolders],
    items,
  }
}

export function loadAssetLibrary(storage: Pick<Storage, 'getItem'> = window.localStorage): AssetLibraryState {
  try {
    const raw = storage.getItem(ASSET_LIBRARY_STORAGE_KEY)
    return normalizeAssetLibraryState(raw ? JSON.parse(raw) : null)
  } catch {
    return getDefaultAssetLibraryState()
  }
}

export function saveAssetLibrary(state: AssetLibraryState, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(ASSET_LIBRARY_STORAGE_KEY, JSON.stringify(normalizeAssetLibraryState(state)))
}

export function createAssetFolder(name: string): AssetFolder {
  const sanitized = sanitizeFolderName(name)
  if (!sanitized) throw new Error('请输入文件夹名称')
  return { id: newId('asset_folder'), name: sanitized, createdAt: Date.now() }
}

export function renameAssetFolder(folder: AssetFolder, name: string): AssetFolder {
  const sanitized = sanitizeFolderName(name)
  if (!sanitized) throw new Error('请输入文件夹名称')
  return { ...folder, name: sanitized }
}

export function deleteAssetFolder(state: AssetLibraryState, folderId: string): AssetLibraryState {
  if (folderId === DEFAULT_ASSET_FOLDER_ID) return state
  return normalizeAssetLibraryState({
    folders: state.folders.filter(item => item.id !== folderId),
    items: state.items.map(item => item.folderId === folderId ? { ...item, folderId: DEFAULT_ASSET_FOLDER_ID } : item),
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

export async function createAssetFromFile(file: File, folderId: string): Promise<{ item: AssetItem; inputImage: InputImage }> {
  if (!file.type.startsWith('image/')) throw new Error('仅支持上传图片素材')
  if (file.size > MAX_ASSET_FILE_SIZE) throw new Error(`图片大小不能超过 ${MAX_ASSET_FILE_SIZE / 1024 / 1024}MB`)
  const dataUrl = await fileToDataUrl(file)
  const imageId = await storeImage(dataUrl, 'upload')
  return {
    item: {
      id: newId('asset'),
      imageId,
      name: sanitizeFileName(file.name),
      folderId,
      type: 'image',
      createdAt: Date.now(),
    },
    inputImage: { id: imageId, dataUrl },
  }
}
