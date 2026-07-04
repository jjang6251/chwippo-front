import { apiClient } from './client'
import type {
  AlarmConfig,
  NotificationListResult,
} from '@/types/notification'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/** 인앱 알림 센터 목록 (cursor 페이지네이션) */
export const getNotifications = (cursor?: string) =>
  apiClient
    .get('/notifications', { params: cursor ? { cursor } : undefined })
    .then(unwrap<NotificationListResult>)

/** 단건 읽음 처리 */
export const markNotificationRead = (id: string) =>
  apiClient.patch(`/notifications/${id}/read`)

/** 전체 읽음 처리 */
export const markAllNotificationsRead = () =>
  apiClient.patch('/notifications/read-all')

/** 알림 설정 조회 */
export const getAlarmConfig = () =>
  apiClient.get('/me/alarm-config').then(unwrap<AlarmConfig>)

/** 알림 설정 부분 update */
export const updateAlarmConfig = (partial: Partial<AlarmConfig>) =>
  apiClient.patch('/me/alarm-config', partial).then(unwrap<AlarmConfig>)

/** soft-ask 응답 / OS 권한 상태 동기화 */
export const recordAlarmPrompt = (granted: boolean) =>
  apiClient.patch('/me/alarm-prompt', { granted })
