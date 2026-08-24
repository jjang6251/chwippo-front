import { useCallback } from 'react'
import { useDemoMode } from '@/contexts/demoMode'
import { useUpdateStep } from '@/hooks/useStepDetail'
import { fromDateTimeLocalValue } from '@/utils/datetime'
import { postToNative } from '@/utils/nativeBridge'

/**
 * 스텝 일정 저장 — **정책이 붙은 쓰기 경로**. 날짜를 고치는 화면은 전부 이걸 쓴다.
 *
 * ## 왜 훅으로 뺐나
 *
 * 저장은 `updateStep` 한 줄이 아니라 **정책 세 개**가 붙어 있다:
 *  ① `datetime-local` 값 → KST offset ISO (`fromDateTimeLocalValue`) — 시각 보존의 핵심.
 *     `type="date"` 로 만든 값이 들어오면 그 순간 ADR-049 가 없앤 결함이 되살아난다.
 *  ② **알림 권한 soft-ask 트리거** — 날짜를 **저장**할 때만 발신, 삭제(null)엔 미발신.
 *     원래 카드 상세 헤더에 있던 트리거를 ADR-049 가 스텝 날짜 저장으로 옮겨왔다.
 *  ③ **데모(비로그인)에선 발신 금지** — soft-ask 는 로그인 사용자 전용이다.
 *
 * 화면마다 이 셋을 손으로 챙기면 **한 곳만 빠져도 조용히 어긋난다.** 특히 ②는
 * 안 보내도 아무 에러가 안 나서, 빠뜨리면 그 경로로 날짜를 넣은 사람만 푸시 권한을
 * 영영 안 물어보게 된다 (2026-08-25 카드 상세 인라인 편집을 붙이며 뺀 이유).
 */
export function useStepScheduleSave(appId: string, stepId: string) {
  const isDemo = useDemoMode()
  const { mutate: updateStep } = useUpdateStep(appId)

  return useCallback(
    (value: string) => {
      updateStep(
        { stepId, scheduledDate: fromDateTimeLocalValue(value) },
        { onSuccess: () => { if (value && !isDemo) postToNative({ type: 'deadline-saved' }) } },
      )
    },
    [updateStep, stepId, isDemo],
  )
}
