import { getPromptMentionParts, type PromptMentionPart } from './promptImageMentions'
import { getQuickPromptMentionParts, type QuickPrompt, type QuickPromptMentionPart } from './quickPrompts'

export type PromptDisplayPart = PromptMentionPart | QuickPromptMentionPart

export function getDisplayPromptText(task: { prompt: string; inputPrompt?: string | null }): string {
  return task.inputPrompt?.trim() ? task.inputPrompt : task.prompt
}

export function getPromptDisplayParts(prompt: string, inputImageCount: number, quickPrompts: QuickPrompt[]): PromptDisplayPart[] {
  const imagePlaceholders = Array.from({ length: inputImageCount }, (_, index) => ({ id: `image-${index}`, dataUrl: '' }))
  const imageParts = getPromptMentionParts(prompt, imagePlaceholders)

  return imageParts.reduce<PromptDisplayPart[]>((acc, part) => {
    if (part.type === 'text') acc.push(...getQuickPromptMentionParts(part.text, quickPrompts))
    else acc.push(part)
    return acc
  }, [])
}

export function getCardPromptDisplayParts(task: { prompt: string; inputPrompt?: string | null }, inputImageCount: number, quickPrompts: QuickPrompt[]): PromptDisplayPart[] {
  return getPromptDisplayParts(getDisplayPromptText(task), inputImageCount, quickPrompts)
}


