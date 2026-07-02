/**
 * W4 — 베타 D-day 7주 backlog 잘린 기능 flag.
 *
 * W5-W7 (검색·태그·공유·iCal export) 은 출시 후 D+1~3주 진행 예정.
 * 이 flag = true 로 바꾸면 해당 UI 노출 (구현은 별도 PR).
 *
 * ADR-030 (AI hide) 과 일관: 미구현 UI = 완전 미노출 → 완성도 감정 유지.
 */
export const BETA_FEATURES = {
  /** Board 회사명·직무명 검색 (W5) */
  search: false,
  /** 사용자 정의 태그 관리 (W5) */
  tags: false,
  /** 지원카드·자소서 공유 링크 (W6) */
  share: false,
  /** iCal export (W6) */
  icalExport: false,
} as const

export type BetaFeatureKey = keyof typeof BETA_FEATURES
