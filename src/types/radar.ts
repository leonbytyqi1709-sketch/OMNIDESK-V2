export type RadarCategory = 'news' | 'security' | 'release' | 'status'
export interface RadarTopic {
  id: string
  name: string
  keywords: string[]
  projectId: string | null
  projectName: string | null
  projectMissing: boolean
  enabled: boolean
  version: number
}
export interface RadarSource {
  id: string
  topicId: string
  name: string
  url: string
  category: RadarCategory
  enabled: boolean
  version: number
  lastAttempt: string | null
  lastSuccess: string | null
  lastSchedulerAt: string | null
  error: string | null
  due: boolean
}
export interface RadarItem {
  projectId: string | null
  projectName: string | null
  projectMissing: boolean
  projectOverride: boolean
  id: string
  sourceId: string
  topicId: string
  title: string
  url: string
  excerpt: string
  publishedAt: string | null
  foundAt: string
  read: boolean
  saved: boolean
  matches: string[]
  memoryId: string | null
  explanation: { summary: string; relevance: string } | null
}
export interface RadarOverview {
  topics: RadarTopic[]
  sources: RadarSource[]
  items: RadarItem[]
  limited: boolean
}
