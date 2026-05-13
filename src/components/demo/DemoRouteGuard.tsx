import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// 데모 화면 안의 컴포넌트가 navigate('/board/...') 처럼 `/demo` 없는 절대경로로 이동하면
// 실서비스 라우트(=AuthGuard) 로 빠져 랜딩으로 튕긴다. 그걸 잡아 `/demo` 접두를 다시 붙여 돌려보낸다.
// 라우트 트리 밖(App 루트)에 항상 마운트되어 있어야 escape를 잡을 수 있다 — useLayoutEffect로 paint 전에 보정.
const ESCAPE_OK = new Set(['/', '/login', '/login/callback', '/privacy', '/terms'])

export function DemoRouteGuard() {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const prevPathRef = useRef(pathname)

  useLayoutEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (pathname.startsWith('/demo')) return
    if (ESCAPE_OK.has(pathname)) return
    if (!prev.startsWith('/demo')) return // 데모에 있다가 빠져나간 경우만 보정
    navigate('/demo' + pathname + search + hash, { replace: true })
  }, [pathname, search, hash, navigate])

  return null
}
