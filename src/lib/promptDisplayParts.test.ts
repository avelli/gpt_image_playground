import { describe, expect, it } from 'vitest'
import { getCardPromptDisplayParts, getDisplayPromptText, getPromptDisplayParts } from './promptDisplayParts'
import type { QuickPrompt } from './quickPrompts'

const quickPrompts: QuickPrompt[] = [
  { id: 'a', title: 'PPT修改', content: '把 PPT 文案调整得更专业', category: '工作', updatedAt: 1 },
]

describe('getPromptDisplayParts', () => {
  it('splits image mentions and quick prompt mentions for card rendering', () => {
    expect(getPromptDisplayParts('/PPT修改 参考 @图1', 1, quickPrompts)).toEqual([
      { type: 'quickPrompt', text: '/PPT修改', promptId: 'a' },
      { type: 'text', text: ' 参考 ' },
      { type: 'mention', text: '@图1', imageIndex: 0 },
    ])
  })

  it('prefers the original input prompt over the final expanded prompt for display', () => {
    expect(getDisplayPromptText({ prompt: '把 PPT 文案调整得更专业 参考 @图1', inputPrompt: '/PPT修改 参考 @图1' })).toBe('/PPT修改 参考 @图1')
  })

  it('uses original input prompt parts for task card rendering', () => {
    expect(getCardPromptDisplayParts({ prompt: '把 PPT 文案调整得更专业', inputPrompt: '/PPT修改' }, 0, quickPrompts)).toEqual([
      { type: 'quickPrompt', text: '/PPT修改', promptId: 'a' },
    ])
  })
})


