export interface BrowserItem {
  id: string
  title: string
  url: string
  selection: string
  annotation: string
  projectId: string | null
  projectName: string | null
  version: number
  createdAt: string
  updatedAt: string
}
export interface BrowserItemInput {
  id: string
  title: string
  url: string
  selection: string
  annotation: string
  projectId: string | null
}
export interface BrowserDevice {
  id: string
  name: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
}
export interface BrowserProject {
  id: string
  name: string
}
