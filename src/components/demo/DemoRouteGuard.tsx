import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// 데모 화면 안의 컴포넌트가 navigate('/board/...') 처럼 `/demo` 없는 절대경로로 이동하면
// 실서비스 라우트(=AuthGuard) 로 빠져 랜딩으로 튕긴다. 그걸 잡아 `/demo` 접두를 다시 붙여 돌려보낸다.
// 라우트 트리 밖(App 루트)에 항상 마운트되어 있어야 escape를 잡을 수 있다 — useLayoutEffect로 paint 전에 보정.
//
// 2026-07-14 강화: AuthGuard 의 `<Navigate to="/">` 가 이 가드보다 먼저 실행되면
// `/demo/x → /activity/y → /` 처럼 두 홉으로 랜딩에 도달해 기존 prev 비교가 놓쳤다 (실측 재현).
// → "데모 세션" ref 를 유지하고, 세션 중 비데모 경로는 홉 수와 무관하게 전부 복귀시킨다.
//   의도된 퇴장(데모 화면에서 직접 ESCAPE_OK 경로 클릭 — 둘러보기 종료·로그인)만 세션을 끝낸다.
const ESCAPE_OK = new Set(['/', '/login', '/login/callback', '/privacy', '/terms'])

export function DemoRouteGuard() {
  const location = useLocation()
  const { pathname, search, hash } = location
  const navigate = useNavigate()
  const inDemoSessionRef = useRef(pathname.startsWith('/demo'))

  useLayoutEffect(() => {
    if (pathname.startsWith('/demo')) {
      inDemoSessionRef.current = true
      return
    }
    if (!inDemoSessionRef.current) return
    // 의도된 퇴장은 명시 플래그로만 판정 (경로 추론 금지 — AuthGuard 의 지연 Navigate('/') 가
    // 가드 복귀 직후 발사되면 prev 가 /demo 라서 "직접 나감"처럼 위장되는 경합 실측)
    const state = location.state as { demoExit?: boolean } | null
    if (ESCAPE_OK.has(pathname) && state?.demoExit) {
      inDemoSessionRef.current = false
      return
    }
    navigate('/demo' + (pathname === '/' ? '' : pathname) + search + hash, { replace: true })
  }, [pathname, search, hash, navigate, location.state])

  return null
}
