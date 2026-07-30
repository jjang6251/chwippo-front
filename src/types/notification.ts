export type NotificationType =
  | 'briefing'
  | 'deadline_urgent'
  | 'imminent'
  | 'admin'

/** 마감 알림 포인트 — 브리핑에 어느 D-day '부터' 포함할지 (누적 프리셋) */
export type DeadlinePoints = 'd1' | 'd3' | 'd7'

/** 아침 브리핑 발송 시각 (KST · 07~10시) */
export type BriefingHour = 7 | 8 | 9 | 10

/** 브리핑 유형별 on/off (기본 전부 true) */
export interface EventToggles {
  deadline: boolean
  interview: boolean
  exam: boolean
  resultDate: boolean
  todo: boolean
}

export interface AlarmConfig {
  /**
   * 레거시 차단기 스위치 — 서버 정규화 후 항상 true.
   * "전체 알림"은 이 필드가 아니라 채널 3종의 select-all 파생값
   * (briefingEnabled && deadlineUrgentEnabled && imminentEnabled).
   */
  master: boolean
  briefingEnabled: boolean
  deadlinePoints: DeadlinePoints
  /** 아침 브리핑 발송 시각 (KST · 07~10시) */
  briefingHour: BriefingHour
  /** 브리핑 유형별 on/off */
  eventToggles: EventToggles
  deadlineUrgentEnabled: boolean
  /** 2시간 전 임박 리마인드 채널 on/off */
  imminentEnabled: boolean
}

/** 부분 update 입력 — eventToggles 는 일부 유형만 보내도 됨 (서버가 현재값에 merge) */
export type AlarmConfigUpdate = Partial<Omit<AlarmConfig, 'eventToggles'>> & {
  eventToggles?: Partial<EventToggles>
}

/**
 * 인앱 알림의 구조화 이벤트 (payload.events).
 *
 * 과거 알림에는 **없다** — body 문자열만 있던 시절 데이터라 `parseNotificationEvents` 가
 * null 을 돌려주고, 화면은 기존처럼 body 텍스트로 폴백한다.
 */
export interface NotificationEvent {
  /** 회사명·시험명 등 주체 (강조 표시) */
  subject: string
  /** "서류 마감"·"1차 면접"·"14:00" 등 */
  label: string
  /** 오늘=0 · 미래 양수 · null = 날짜 없음 */
  dday: number | null
  deepLink: string | null
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
