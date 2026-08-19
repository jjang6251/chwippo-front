import { useEffect } from 'react'

/**
 * SPA 내부 이동 확인 가드 — `beforeunload`(새로고침·탭 닫기)가 못 덮는 구멍을 막는다.
 *
 * 🔴 정석은 react-router `useBlocker` 인데 **데이터 라우터 전용**이라 플레인
 * `<BrowserRouter>` 인 이 앱에선 못 쓴다 (2026-08-19 실측 — App.tsx:153). 대신 내부
 * 앵커 클릭을 **캡처 단계**에서 가로채 confirm 을 띄운다. `<Link>` 는 `<a>` 로 렌더되고
 * react-router 의 클릭 핸들러는 `defaultPrevented` 면 이동하지 않으므로, 취소 시
 * preventDefault 하나로 사이드바·하단 탭·브레드크럼·멘션 링크가 전부 막힌다.
 *
 * 한계(문서화된 구멍): 브라우저 뒤로가기(popstate)와 `navigate()` 직접 호출은 못 잡는다.
 * 히스토리 조작 해킹은 라우터와 싸우게 되므로 넣지 않는다 — 진행 수 초짜리 가드에
 * 그 취약성은 과하다. 새로고침·탭 닫기는 `useUnloadGuard` 가 담당(짝으로 쓸 것).
 */
export function useSpaLeaveConfirm(active: boolean, message: string): void {
  useEffect(() => {
    if (!active) return

    const onClickCapture = (e: MouseEvent) => {
      // 수정키·중클릭 = 새 탭 — 현재 화면이 안 떠나므로 막을 이유가 없다
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]')
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      const target = anchor.getAttribute('target')
      // 내부 라우트 이동만 대상 — 외부 링크·새 탭·다운로드는 현재 화면을 안 떠난다
      if (!href.startsWith('/') || (target && target !== '_self') || anchor.hasAttribute('download'))
        return
      if (!window.confirm(message)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [active, message])
}
