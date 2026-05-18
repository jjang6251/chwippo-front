import { apiClient } from './client'
import type { Announcement, ActiveAnnouncement, CreateAnnouncementDto, UpdateAnnouncementDto } from '@/types/announcement'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const getActiveAnnouncement = (): Promise<ActiveAnnouncement | null> =>
  apiClient.get<{ data: ActiveAnnouncement | null }>('/announcements/active').then(unwrap)

export const getAdminAnnouncements = (): Promise<Announcement[]> =>
  apiClient.get<{ data: Announcement[] }>('/admin/announcements').then(unwrap)

export const createAnnouncement = (dto: CreateAnnouncementDto): Promise<Announcement> =>
  apiClient.post<{ data: Announcement }>('/admin/announcements', dto).then(unwrap)

export const updateAnnouncement = (id: string, dto: UpdateAnnouncementDto): Promise<Announcement> =>
  apiClient.patch<{ data: Announcement }>(`/admin/announcements/${id}`, dto).then(unwrap)

export const deleteAnnouncement = (id: string): Promise<void> =>
  apiClient.delete(`/admin/announcements/${id}`).then(() => undefined)
