export interface Announcement {
  id: string
  title: string
  body: string
  type: 'banner' | 'modal'
  active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateAnnouncementDto {
  title: string
  body: string
  type: 'banner' | 'modal'
  active: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export interface UpdateAnnouncementDto {
  title?: string
  body?: string
  type?: 'banner' | 'modal'
  active?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export type ActiveAnnouncement = Pick<Announcement, 'id' | 'title' | 'body' | 'type'>
