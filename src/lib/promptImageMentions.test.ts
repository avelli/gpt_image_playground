import { describe, expect, it } from 'vitest'
import type { InputImage } from '../types'
import { getAtImageQuery, getPromptMentionParts, insertImageMention } from './promptImageMentions'

const images: InputImage[] = [
  { id: 'image-a', dataUrl: 'data:image/png;base64,a' },
  { id: 'image-b', dataUrl: 'data:image/png;base64,b' },
]

describe('prompt image mentions', () => {
  it('detects @ query after the cursor', () => {
    expect(getAtImageQuery('参考 @图', 5, images)).toEqual({ start: 3, query: '图' })
  })

  it('ignores @ query when there are no current reference images', () => {
    expect(getAtImageQuery('参考 @图', 5, [])).toBeNull()
  })

  it('ignores a completed image mention after selection', () => {
    expect(getAtImageQuery('参考 @图2', 6, images)).toBeNull()
  })

  it('detects @ query in the middle of text without requiring whitespace prefix', () => {
    expect(getAtImageQuery('参考@', 3, images)).toEqual({ start: 2, query: '' })
  })

  it('replaces middle-text @ query with selected current reference image mention', () => {
    expect(insertImageMention('参考@生成', 2, 3, 1)).toEqual({
      prompt: '参考 @图2 生成',
      cursor: 7,
    })
  })



  it('splits valid image mentions for tag rendering', () => {
    expect(getPromptMentionParts('用@图2的方式生成@图9', images)).toEqual([
      { type: 'text', text: '用' },
      { type: 'mention', text: '@图2', imageIndex: 1 },
      { type: 'text', text: '的方式生成@图9' },
    ])
  })
})


