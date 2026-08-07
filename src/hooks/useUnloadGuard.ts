import { useEffect } from 'react'

/**
 * AI 호출처럼 **되돌릴 수 없는 작업이 진행 중일 때** 새로고침·탭 닫기를 경고한다.
 *
 * 🔴 왜 필요한가 — LLM 호출은 코인이 차감되고 쿨다운이 걸린다. 사용자가 응답을 기다리다
 * 새로고침하면 **차감은 됐는데 결과는 없는** 상태가 된다. 면접 기능에는 이 가드가 아예
 * 없었다 (자소서·노트·공고정리엔 있었다).
 *
 * `useAiFeedbackUnloadGuard` 는 자소서 점검 스토어에 묶여 있어 재사용이 안 된다.
 * 이건 boolean 하나만 받는 범용 버전이다.
 *
 * ⚠️ 문구는 지정할 수 없다 — 표준 `beforeunload` 는 커스텀 메시지를 무시하고
 * 브라우저 기본 문구를 띄운다. `preventDefault()` 만으로 충분하다.
 */
export function useUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])
}
