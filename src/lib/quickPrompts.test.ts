import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUICK_PROMPT_CATEGORY,
  expandQuickPromptMentions,
  getQuickPromptCategories,
  getQuickPromptsByCategory,
  getQuickPromptMentionParts,
  getSlashQuickPromptQuery,
  insertQuickPromptMention,
  loadQuickPrompts,
  quickPromptCategoryMatches,
  quickPromptMatches,
  sanitizeQuickPromptCategory,
  sanitizeQuickPromptTitle,
  type QuickPrompt,
} from './quickPrompts'

const quickPrompts: QuickPrompt[] = [
  { id: 'a', title: '写实风格', content: 'photorealistic, high detail', category: '风格', updatedAt: 1 },
  { id: 'b', title: '电影光影', content: 'cinematic lighting', category: '光影', updatedAt: 2 },
]

describe('quick prompt mentions', () => {
  it('detects slash query before cursor', () => {
    expect(getSlashQuickPromptQuery('生成 /写实', 6, quickPrompts)).toEqual({ start: 3, query: '写实' })
    expect(getSlashQuickPromptQuery('生成 /写实风格', 8, quickPrompts)).toBeNull()
  })

  it('matches quick prompts by title', () => {
    expect(quickPromptMatches('写实', quickPrompts[0])).toBe(true)
    expect(quickPromptMatches('电影', quickPrompts[0])).toBe(false)
  })

  it('inserts quick prompt mention with spacing', () => {
    expect(insertQuickPromptMention('生成 /写', 3, 6, quickPrompts[0])).toEqual({
      prompt: '生成 /写实风格',
      cursor: 8,
    })
  })

  it('renders quick prompt mentions as distinct parts', () => {
    expect(getQuickPromptMentionParts('/写实风格 背景保持', quickPrompts)).toEqual([
      { type: 'quickPrompt', text: '/写实风格', promptId: 'a' },
      { type: 'text', text: ' 背景保持' },
    ])
  })

  it('expands quick prompt mentions before submission', () => {
    expect(expandQuickPromptMentions('/写实风格 背景保持', quickPrompts)).toBe('photorealistic, high detail 背景保持')
  })

  it('normalizes slash titles and rejects empty titles', () => {
    expect(sanitizeQuickPromptTitle('/ 写实 风格 ')).toBe('写实风格')
    expect(() => sanitizeQuickPromptTitle('/   ')).toThrow('请输入快捷提示词标题')
  })

  it('normalizes empty categories to the default category', () => {
    expect(DEFAULT_QUICK_PROMPT_CATEGORY).toBe('默认')
    expect(sanitizeQuickPromptCategory('  ')).toBe('默认')
    expect(sanitizeQuickPromptCategory(' 风格 分类 ')).toBe('风格分类')
  })

  it('loads legacy quick prompts into the default category', () => {
    const storage = {
      getItem: () => JSON.stringify([{ id: 'legacy', title: '旧提示', content: 'legacy content', updatedAt: 1 }]),
    }

    expect(loadQuickPrompts(storage)).toEqual([
      { id: 'legacy', title: '旧提示', content: 'legacy content', category: '默认', updatedAt: 1 },
    ])
  })

  it('lists categories with default category first', () => {
    expect(getQuickPromptCategories([
      { id: 'a', title: 'A', content: 'A', category: '风格', updatedAt: 1 },
      { id: 'b', title: 'B', content: 'B', category: '默认', updatedAt: 2 },
      { id: 'c', title: 'C', content: 'C', category: '风格', updatedAt: 3 },
    ])).toEqual(['默认', '风格'])
  })

  it('matches categories by slash query', () => {
    expect(quickPromptCategoryMatches('', '风格')).toBe(true)
    expect(quickPromptCategoryMatches('风', '风格')).toBe(true)
    expect(quickPromptCategoryMatches('光', '风格')).toBe(false)
  })

  it('gets quick prompts by category', () => {
    expect(getQuickPromptsByCategory(quickPrompts, '风格')).toEqual([quickPrompts[0]])
    expect(getQuickPromptsByCategory([
      ...quickPrompts,
      { id: 'c', title: '默认提示', content: 'default content', category: '', updatedAt: 3 },
    ], '默认')).toEqual([
      { id: 'c', title: '默认提示', content: 'default content', category: '', updatedAt: 3 },
    ])
  })
})



