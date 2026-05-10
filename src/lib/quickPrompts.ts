export interface QuickPrompt {
  id: string
  title: string
  content: string
  category: string
  updatedAt: number
}

export interface SlashQuickPromptQuery {
  start: number
  query: string
}

export const QUICK_PROMPTS_STORAGE_KEY = 'gpt-image-playground.quickPrompts.v1'
export const QUICK_PROMPTS_UPDATED_EVENT = 'quick-prompts-updated'
export const DEFAULT_QUICK_PROMPT_CATEGORY = '默认'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeTitle(title: string): string {
  return title.replace(/^\/+/, '').replace(/\s+/g, '').trim()
}

function normalizeCategory(category: string): string {
  return category.replace(/\s+/g, '').trim()
}

export function sanitizeQuickPromptTitle(title: string): string {
  const normalized = normalizeTitle(title)
  if (!normalized) throw new Error('请输入快捷提示词标题')
  return normalized
}

export function sanitizeQuickPromptCategory(category: string | null | undefined): string {
  const normalized = normalizeCategory(category ?? '')
  return normalized || DEFAULT_QUICK_PROMPT_CATEGORY
}

export function getQuickPromptCategories(quickPrompts: QuickPrompt[]): string[] {
  const categories = new Set(quickPrompts.map(item => sanitizeQuickPromptCategory(item.category)))
  return Array.from(categories).sort((a, b) => {
    if (a === DEFAULT_QUICK_PROMPT_CATEGORY) return -1
    if (b === DEFAULT_QUICK_PROMPT_CATEGORY) return 1
    return a.localeCompare(b, 'zh-CN')
  })
}

export function quickPromptCategoryMatches(query: string, category: string): boolean {
  const normalized = normalizeCategory(query).toLowerCase()
  if (!normalized) return true
  return sanitizeQuickPromptCategory(category).toLowerCase().includes(normalized)
}

export function getQuickPromptsByCategory(quickPrompts: QuickPrompt[], category: string): QuickPrompt[] {
  const normalizedCategory = sanitizeQuickPromptCategory(category)
  return quickPrompts.filter(item => sanitizeQuickPromptCategory(item.category) === normalizedCategory)
}

export function getQuickPromptMentionLabel(prompt: Pick<QuickPrompt, 'title'>): string {
  return `/${sanitizeQuickPromptTitle(prompt.title)}`
}

export function quickPromptMatches(query: string, prompt: QuickPrompt): boolean {
  const normalized = normalizeTitle(query).toLowerCase()
  if (!normalized) return true
  return sanitizeQuickPromptTitle(prompt.title).toLowerCase().includes(normalized)
}

export function getSlashQuickPromptQuery(prompt: string, cursor: number, quickPrompts: QuickPrompt[]): SlashQuickPromptQuery | null {
  if (quickPrompts.length === 0) return null

  const beforeCursor = prompt.slice(0, cursor)
  const slashIndex = beforeCursor.lastIndexOf('/')
  if (slashIndex < 0) return null

  const query = beforeCursor.slice(slashIndex + 1)
  if (/\s/.test(query)) return null
  const completed = quickPrompts.some(item => sanitizeQuickPromptTitle(item.title) === normalizeTitle(query))
  if (completed) return null

  return { start: slashIndex, query }
}

export function insertQuickPromptMention(prompt: string, start: number, cursor: number, quickPrompt: QuickPrompt) {
  const mention = getQuickPromptMentionLabel(quickPrompt)
  const prefix = start > 0 && prompt[start - 1] !== ' ' ? ' ' : ''
  const suffix = prompt.slice(cursor)
  const separator = suffix.startsWith(' ') || suffix.length === 0 ? '' : ' '
  const nextPrompt = `${prompt.slice(0, start)}${prefix}${mention}${separator}${suffix}`
  return {
    prompt: nextPrompt,
    cursor: start + prefix.length + mention.length + separator.length,
  }
}

export type QuickPromptMentionPart =
  | { type: 'text'; text: string }
  | { type: 'quickPrompt'; text: string; promptId: string }

export function getQuickPromptMentionParts(prompt: string, quickPrompts: QuickPrompt[]): QuickPromptMentionPart[] {
  if (quickPrompts.length === 0) return [{ type: 'text', text: prompt }]
  const byTitle = new Map(quickPrompts.map(item => [sanitizeQuickPromptTitle(item.title), item]))
  const titles = Array.from(byTitle.keys()).sort((a, b) => b.length - a.length)
  if (titles.length === 0) return [{ type: 'text', text: prompt }]

  const pattern = new RegExp(`/(?:${titles.map(escapeRegExp).join('|')})(?=$|\\s)`, 'g')
  const parts: QuickPromptMentionPart[] = []
  let lastIndex = 0

  for (const match of prompt.matchAll(pattern)) {
    if (match.index == null) continue
    const text = match[0]
    const title = text.slice(1)
    const quickPrompt = byTitle.get(title)
    if (!quickPrompt) continue

    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: prompt.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'quickPrompt', text, promptId: quickPrompt.id })
    lastIndex = match.index + text.length
  }

  if (lastIndex < prompt.length) {
    parts.push({ type: 'text', text: prompt.slice(lastIndex) })
  }
  return parts.length > 0 ? parts : [{ type: 'text', text: prompt }]
}

export function expandQuickPromptMentions(prompt: string, quickPrompts: QuickPrompt[]): string {
  return getQuickPromptMentionParts(prompt, quickPrompts)
    .map(part => {
      if (part.type === 'text') return part.text
      return quickPrompts.find(item => item.id === part.promptId)?.content ?? part.text
    })
    .join('')
}

export function loadQuickPrompts(storage: Pick<Storage, 'getItem'> = window.localStorage): QuickPrompt[] {
  try {
    const raw = storage.getItem(QUICK_PROMPTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QuickPrompt[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string' && typeof item.updatedAt === 'number')
      .map(item => ({ ...item, category: sanitizeQuickPromptCategory(item.category) }))
  } catch {
    return []
  }
}

export function saveQuickPrompts(quickPrompts: QuickPrompt[], storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(QUICK_PROMPTS_STORAGE_KEY, JSON.stringify(quickPrompts.map(item => ({ ...item, category: sanitizeQuickPromptCategory(item.category) }))))
  if (typeof window !== 'undefined' && storage === window.localStorage) {
    window.dispatchEvent(new Event(QUICK_PROMPTS_UPDATED_EVENT))
  }
}

export function createQuickPrompt(title: string, content: string, category: string = DEFAULT_QUICK_PROMPT_CATEGORY): QuickPrompt {
  return {
    id: `quick_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: sanitizeQuickPromptTitle(title),
    content: content.trim(),
    category: sanitizeQuickPromptCategory(category),
    updatedAt: Date.now(),
  }
}

export function exportQuickPrompts(quickPrompts: QuickPrompt[]): string {
  return JSON.stringify(quickPrompts, null, 2)
}

export function importQuickPrompts(json: string): QuickPrompt[] {
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('无效的快捷提示词数据')
  return parsed
    .filter(item => item && typeof item.title === 'string' && typeof item.content === 'string')
    .map(item => ({
      id: item.id || `quick_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: sanitizeQuickPromptTitle(item.title),
      content: (item.content || '').trim(),
      category: sanitizeQuickPromptCategory(item.category),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    }))
}

