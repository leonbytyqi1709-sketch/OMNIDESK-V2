export type RoomRole = 'owner' | 'editor' | 'reader'
export interface SharedRoom {
  id: string
  title: string
  description: string
  expiresAt: string
  closed: boolean
  version: number
  role: RoomRole
  active: boolean
}
export interface RoomItem {
  id: string
  kind: 'list' | 'pin'
  text: string
  done: boolean
  version: number
}
export interface RoomMember {
  id: string
  name: string
  role: 'editor' | 'reader'
  version: number
}
export interface RoomInvite {
  id: string
  role: 'editor' | 'reader'
  expiresAt: string
}
export interface RoomDetail {
  room: SharedRoom
  items: RoomItem[]
  members: RoomMember[]
  invites: RoomInvite[]
}
export interface RoomSource {
  name: string
  description: string
  tasks: { id: string; title: string }[]
  limited: boolean
}
