import type { CalendarEvent } from '@/api/calendar'

/**
 * activity-redesign — 일정 기반 질문 카드 선택.
 *
 * CEO 결정: 면접·코테·인적성·시험류 스텝만 (서류 마감 제외 — 노이즈).
 * 어제·오늘 겪은 일정 중, 아직 답하지 않았고(dismiss 포함) 가장 오래된 것 1개.
 * 어제 것 우선 — 겪고 하루 지난 시점이 기록 적기.
 */

const QUESTION_STEP_PATTERN = /면접|인터뷰|임원|pt|피티|토론|코테|코딩|인적성|필기|시험/i

export interface ScheduleQuestion {
  stepId: string
  applicationId: string
  companyName: string
  stepName: string
  /** '어제' | '오늘' */
  dateLabel: string
}

export function isQuestionableStep(name: string): boolean {
  return QUESTION_STEP_PATTERN.test(name)
}

export function pickScheduleQuestion(opts: {
  events: CalendarEvent[]
  today: string
  yesterday: string
  answeredStepIds: ReadonlySet<string>
  dismissedStepIds: ReadonlySet<string>
}): ScheduleQuestion | null {
  const { events, today, yesterday, answeredStepIds, dismissedStepIds } = opts

  const candidates = events.filter(
    (e) =>
      e.type === 'step' &&
      e.stepId &&
      e.companyName &&
      e.stepName &&
      isQuestionableStep(e.stepName) &&
      (e.date === yesterday || e.date === today) &&
      !answeredStepIds.has(e.stepId) &&
      !dismissedStepIds.has(e.stepId),
  )
  if (candidates.length === 0) return null

  // 어제 것 우선, 같은 날짜면 이른 시간 우선
  const sorted = [...candidates].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.time ?? '99:99') < (b.time ?? '99:99') ? -1 : 1
  })
  const picked = sorted[0]
  return {
    stepId: picked.stepId!,
    applicationId: picked.applicationId ?? '',
    companyName: picked.companyName!,
    stepName: picked.stepName!,
    dateLabel: picked.date === yesterday ? '어제' : '오늘',
  }
}

const DISMISS_KEY = 'chwippo:schedule-question-dismissed'

/** dismiss 는 localStorage — 최근 50개만 유지 (무한 성장 방지) */
export function loadDismissedStepIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function dismissStepQuestion(stepId: string): void {
  try {
    const ids = [...loadDismissedStepIds(), stepId].slice(-50)
    localStorage.setItem(DISMISS_KEY, JSON.stringify(ids))
  } catch {
    // best-effort
  }
}
