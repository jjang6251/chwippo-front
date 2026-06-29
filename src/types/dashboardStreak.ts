/** W3 — Dashboard streak·heatmap·status 분포 */
export type ApplicationStatus =
  | 'IN_PROGRESS'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'PASSED'
  | 'FAILED'

export interface DashboardStreakResponse {
  streak: {
    /** 연속 일수 — 오늘 활동 있으면 N (>=1), 없으면 0 */
    current: number
    /** 가장 최근 활동일 (KST 'YYYY-MM-DD'). 활동 0회면 null */
    lastActivityDate: string | null
  }
  /** 365일 heatmap — count=0 인 날도 포함 (정확히 365 entries) */
  heatmap: { date: string; count: number }[]
  /** 지원 카드 status 분포 (deleted_at IS NULL) */
  statusDistribution: { status: ApplicationStatus; count: number }[]
}
