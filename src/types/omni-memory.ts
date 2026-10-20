export const MEMORY_CATEGORIES = [
  'preference',
  'knowledge',
  'decision',
] as const
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]
export interface OmniMemory {
  id: string
  title: string
  content: string
  category: MemoryCategory
  projectId: string | null
  projectName: string | null
  projectMissing: boolean
  pinned: boolean
  archived: boolean
  version: number
  createdAt: string
  updatedAt: string
  sourceMessageId: string | null
  sourceSessionId: string | null
  sourceRole: 'user' | 'assistant' | null
  sourceMissing: boolean
}
export interface MemoryInput {
  title: string
  content: string
  category: MemoryCategory
  projectId: string | null
  pinned: boolean
  archived: boolean
}
export interface MemoryVersion extends MemoryInput {
  version: number
  createdAt: string
}
export interface MemoryReference {
  id: string
  title: string
  version: number
  currentVersion: number | null
  available: boolean
  archived: boolean
  changed: boolean
}
export interface ChatMemoryReceipt {
  status: 'used' | 'none' | 'disabled' | 'unavailable'
  projectId: string | null
  references: MemoryReference[]
}

export interface AutoMemoryEvent {
  id: string
  status: 'pending' | 'saved'
  memoryId: string | null
  targetId: string
  targetVersion: number | null
  savedVersion: number | null
  currentVersion: number | null
  title: string
  content: string
  previousContent: string | null
  category: MemoryCategory
  projectId: string | null
  changed: boolean
  archived: boolean
}
export interface AutoMemoryState {
  status: 'done' | 'processing' | 'unavailable'
  events: AutoMemoryEvent[]
}
