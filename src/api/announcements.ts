import { apiClient } from './client'
import type { Announcement, ActiveAnnouncement, CreateAnnouncementDto, UpdateAnnouncementDto } from '@/types/announcement'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * 지금 보여줄 공지들 — **0~2개**. 모달 최신 1 + 배너 최신 1 이고, 모달이 앞에 온다.
 * (예전엔 통틀어 1개만 내려줘서 배너 공지가 모달 공지에 가려 아예 안 보였다.)
 */
export const getActiveAnnouncements = (): Promise<ActiveAnnouncement[]> =>
  apiClient.get<{ data: ActiveAnnouncement[] }>('/announcements/active').then(unwrap)

export const getAdminAnnouncements = (): Promise<Announcement[]> =>
  apiClient.get<{ data: Announcement[] }>('/admin/announcements').then(unwrap)

export const createAnnouncement = (dto: CreateAnnouncementDto): Promise<Announcement> =>
  apiClient.post<{ data: Announcement }>('/admin/announcements', dto).then(unwrap)

export const updateAnnouncement = (id: string, dto: UpdateAnnouncementDto): Promise<Announcement> =>
  apiClient.patch<{ data: Announcement }>(`/admin/announcements/${id}`, dto).then(unwrap)

export const deleteAnnouncement = (id: string): Promise<void> =>
  apiClient.delete(`/admin/announcements/${id}`).then(() => undefined)
