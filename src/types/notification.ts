export type NotificationType = 'briefing' | 'deadline_urgent' | 'admin'

/** 마감 알림 포인트 — 브리핑에 어느 D-day 부터 포함할지 */
export type DeadlinePoints = 'd1' | 'd3' | 'd7'

export interface AlarmConfig {
  /** 마스터 스위치 — false 면 briefing·deadline_urgent 전부 안 감 (admin 은 계속) */
  master: boolean
  briefingEnabled: boolean
  deadlinePoints: DeadlinePoints
  deadlineUrgentEnabled: boolean
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  deepLink: string | null
  payload: Record<string, unknown> | null
  read: boolean
  createdAt: string
}

export interface NotificationListResult {
  items: NotificationItem[]
  /** 다음 페이지 커서 (마지막 항목 createdAt ISO) · null = 끝 */
  nextCursor: string | null
  unreadCount: number
}
