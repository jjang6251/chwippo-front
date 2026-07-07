import type { Application } from '@/types/application'

/**
 * A9 — 탈락 케어: 탈락 시점의 스텝 단계 판정.
 *
 * 면접류 단계까지 도달한 탈락 = 회고 가치가 높음 ("다음 면접에서 다르게 할 것").
 * 서류·인적성 탈락 = 이유를 알 수 없어 회고 질문이 공허함 → "남는 것" 안내만.
 */

/** 캘린더 미니맵 dot 분류와 동일 계열의 이름 기반 판정 */
// '발표' 는 제외 — '최종 발표'(결과 발표) 스텝을 면접류로 오판함. PT·피티가 발표면접 커버
const INTERVIEW_PATTERN = /면접|인터뷰|임원|pt|피티|토론/i

export function isInterviewLikeStep(name: string): boolean {
  return INTERVIEW_PATTERN.test(name)
}

/**
 * 탈락 시점까지 면접류 스텝에 도달했는지.
 * currentStepIndex 까지 진행된 스텝 중 하나라도 면접류면 true
 * (현재 스텝이 "최종 발표"처럼 면접 이후 단계여도 면접은 거친 것).
 */
export function reachedInterviewStage(
  app: Pick<Application, 'currentStepIndex'> & {
    steps?: Array<{ name: string; orderIndex: number }> | null
  },
): boolean {
  const steps = app.steps ?? []
  const currentIndex = app.currentStepIndex ?? 0
  return steps.some(
    (s) => s.orderIndex <= currentIndex && isInterviewLikeStep(s.name),
  )
}

/**
 * 도달한 스텝 중 마지막 면접류 스텝 이름 (케어 문구용 — "{1차 면접}까지 간 것 자체가…").
 * 없으면 null (서류·인적성 탈락).
 */
export function lastReachedInterviewStepName(
  app: Pick<Application, 'currentStepIndex'> & {
    steps?: Array<{ name: string; orderIndex: number }> | null
  },
): string | null {
  const steps = app.steps ?? []
  const currentIndex = app.currentStepIndex ?? 0
  const reached = steps
    .filter((s) => s.orderIndex <= currentIndex && isInterviewLikeStep(s.name))
    .sort((a, b) => b.orderIndex - a.orderIndex)
  return reached[0]?.name ?? null
}
