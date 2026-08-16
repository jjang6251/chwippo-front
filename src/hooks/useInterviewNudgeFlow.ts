import { useCallback, useState } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { isInterviewLikeForNudge } from '@/utils/stepTemplates'
import type { Application, InterviewNudge } from '@/types/application'
import {
  isInterviewNudgeDismissedLocally,
  useDismissInterviewNudge,
  useMarkInterviewNudgeShown,
} from '@/hooks/useInterviewNudge'

type Pending = {
  appId: string
  stepId: string
  stepName: string
  companyName: string
  /** 회사 로고(favicon) 조회용 — 없으면 이니셜로 떨어진다 */
  domain?: string
  /** D-day 계산용. 날짜가 없는 스텝이 많아 **있을 때만** 배지를 붙인다 */
  scheduledDate: string | null
  variant: InterviewNudge['variant']
}

/**
 * 면접 유도 모달 흐름 — **진입점 2곳이 공유한다** (`CompanyCard` · `BoardDetail`).
 *
 * 🔴 **`StepPage` 는 쓰지 않는다.** 그 화면엔 이미 `GoToInterviewButton` 이 있어
 * 모달을 또 띄우면 잔소리가 된다. 안 띄우면 `shownAt` 도 안 찍히므로,
 * 나중에 보드에서 그 단계로 이동할 때 정상 노출된다 — 정합성은 안 깨진다.
 *
 * ## 판정을 왜 둘로 나누나
 *
 * | 조건 | 누가 |
 * |---|---|
 * | 이 스텝이 면접인가 (+ 「면접 결과 발표」 제외) | **여기** — `getStepType` 는 프론트 단일 구현이다 |
 * | 안 띄웠나 · 영구차단 · 이 스텝 세션 유무 | **서버** — 단계 이동 응답에 실려 온다 |
 *
 * 정규식을 백엔드에 복제하면 여기에 `온사이트` 를 추가하고 저기를 잊는 순간 조용히 어긋난다.
 * 그래서 서버는 「띄워도 되는 상태인가」만 답하고, 면접 여부는 모른다.
 */
export function useInterviewNudgeFlow() {
  const [pending, setPending] = useState<Pending | null>(null)
  /**
   * CTA 를 누른 뒤 **세션 생성 모달을 띄울 대상.**
   *
   * 🔴 탭으로만 보내면 사용자가 「새 면접 준비 만들기」를 **다시 찾아야 하고**,
   * 방금 이동한 스텝 정보도 버려진다. 넛지가 뜬 순간 우리는 그걸 알고 있으므로
   * `defaultStepId` 로 넘겨 **면접 차수가 채워진 채로** 연다.
   */
  const [creating, setCreating] = useState<{ appId: string; stepId: string } | null>(null)
  const markShown = useMarkInterviewNudgeShown()
  const dismiss = useDismissInterviewNudge()
  const isDemo = useDemoMode()

  /** 단계 이동 성공 응답을 그대로 넘기면 된다 */
  const consider = useCallback(
    (app: Application & { interviewNudge?: InterviewNudge }, stepIndex: number) => {
      /**
       * 🔴 **데모에선 띄우지 않는다** (CEO 2026-08-17).
       * 데모는 계정이 없어 세션 생성이 막혀 있다 — 권해봐야 막다른 길이고,
       * 둘러보는 사람에게 안내 모달이 끼어드는 게 득이 아니다.
       *
       * 이 한 줄이 **차단의 단일 지점**이다. 원래는 데모 응답에 `interviewNudge` 가
       * 안 실린다는 사실에 기대고 있었는데, 그건 **차단이 아니라 우연**이라
       * 데모 어댑터가 필드를 채우는 순간 조용히 뚫린다.
       */
      if (isDemo) return
      const step = app.steps?.[stepIndex]
      if (!step) return
      // ① 프론트 판정 — 면접 유형이면서 「면접 결과 발표」류가 아닐 것
      if (!isInterviewLikeForNudge(step.name)) return
      // ②③④ 서버 판정
      if (!app.interviewNudge?.show) return
      // 「다시 보지 않기」 로컬 보조 방어선 — 서버 저장이 실패했을 때를 덮는다
      if (isInterviewNudgeDismissedLocally()) return

      setPending({
        appId: app.id,
        stepId: step.id,
        stepName: step.name,
        companyName: app.companyName,
        domain: app.domain,
        scheduledDate: step.scheduledDate ?? null,
        variant: app.interviewNudge.variant,
      })
    },
    [isDemo],
  )

  /**
   * 닫기 — X · 오버레이 탭 · ESC · CTA **4경로가 전부 여기로 온다.** 넷은 동등하다.
   * 체크 여부만 결과를 가른다.
   */
  const close = useCallback(
    (dismissForever: boolean) => {
      if (!pending) return
      markShown.mutate({ appId: pending.appId, stepId: pending.stepId })
      if (dismissForever) dismiss.mutate()
      setPending(null)
    },
    [pending, markShown, dismiss],
  )

  /**
   * CTA — 닫기 기록은 `close` 와 **똑같이** 남기고(그 스텝 소진 + 체크 시 영구 차단),
   * 그 다음 생성 모달을 연다.
   */
  const go = useCallback(
    (dismissForever: boolean): { appId: string; stepId: string } | null => {
      const target = pending ? { appId: pending.appId, stepId: pending.stepId } : null
      close(dismissForever)
      if (target) setCreating(target)
      return target
    },
    [pending, close],
  )

  const cancelCreating = useCallback(() => setCreating(null), [])

  return { pending, consider, close, go, creating, cancelCreating }
}
