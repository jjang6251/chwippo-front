import { apiClient } from './client'
import type {
  AlarmConfig,
  AlarmConfigUpdate,
  NotificationListResult,
  NotificationType,
} from '@/types/notification'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * 인앱 알림 센터 목록 (cursor 페이지네이션 + 서버사이드 type 필터).
 * type 미전달 = 전체. unreadCount 는 필터와 무관하게 항상 전체 미읽음.
 */
export const getNotifications = (cursor?: string, type?: NotificationType) =>
  apiClient
    .get('/notifications', {
      params: {
        ...(cursor ? { cursor } : {}),
        ...(type ? { type } : {}),
      },
    })
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

/** 알림 설정 부분 update (eventToggles 는 일부 유형만 보내도 됨) */
export const updateAlarmConfig = (partial: AlarmConfigUpdate) =>
  apiClient.patch('/me/alarm-config', partial).then(unwrap<AlarmConfig>)

/** soft-ask 응답 / OS 권한 상태 동기화 */
export const recordAlarmPrompt = (granted: boolean) =>
  apiClient.patch('/me/alarm-prompt', { granted })

/**
 * 「이 사람에게 알림이 실제로 갈 상태인가」 — 기기 등록 + 설정 토글을 서버가 합쳐 준 파생값.
 *
 * 🔴 새 컬럼이 아니다. 프론트가 `alarm-config` 와 기기 목록을 따로 받아 판정하면
 * **판정 규칙이 두 벌**이 되고, 「알림 켜져 있는데 안 온다」의 원인이 어느 쪽인지 못 가린다.
 */
export interface AlarmStatus {
  /** 앱(네이티브) 기기가 하나라도 등록돼 있나 — 웹만 쓰면 false */
  hasDevice: boolean
  /** 알림 전체 스위치 */
  enabled: boolean
  /** 임박(2시간 전) 알림 토글 — 공고 일정 메모가 여기에 묶인다 */
  imminentOn: boolean
}

export const getAlarmStatus = () =>
  apiClient.get('/me/alarm-status').then(unwrap<AlarmStatus>)
