/**
 * 관리자 회원 상세 — 지원 카드 상태 칩.
 *
 * 사용자 화면의 `boardViewGroups.getStepChip` 과 **같은 규칙**이어야 한다.
 * 운영자와 사용자가 같은 카드를 다른 색·다른 말로 보면 CS 때 대화가 어긋난다.
 * admin 은 경량 DTO(회사·직무·상태만)를 받아 타입이 달라 로직을 공유할 수 없으므로,
 * 규칙이 갈라지지 않도록 여기 따로 두고 spec 으로 고정한다.
 * `getStepChip` 규칙을 바꾸면 여기도 같이 봐야 한다.
 *
 * 차이: 사용자 화면의 "결과 대기"(warning) 는 스텝 예정일이 지났는지 계산이 필요해
 * 여기선 쓰지 않는다 — 운영 조회에는 현재 단계명이면 충분하다.
 */

export type AdminApplicationStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'PASSED'
  | 'FAILED'

export type AdminChipTone = 'warning' | 'success' | 'neutral'

/** 칩 계산에 필요한 최소 형태 — 전체 DTO 를 요구하지 않는다 */
export interface AdminChipInput {
  status: AdminApplicationStatus
  currentStepName: string | null
}

export function cardChip(app: AdminChipInput): {
  label: string
  tone: AdminChipTone
} {
  if (app.status === 'PASSED') return { label: '최종 합격', tone: 'success' }
  if (app.status === 'FAILED') return { label: '불합격', tone: 'neutral' }
  if (app.status === 'PLANNED') return { label: '지원 예정', tone: 'neutral' }
  return { label: app.currentStepName ?? '진행 중', tone: 'neutral' }
}
