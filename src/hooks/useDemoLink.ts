import { useDemoMode } from '@/contexts/demoMode'

/** `useDemoNavigate` 와 동일한 pass-through 목록 (본앱으로 나가야 하는 공개 경로) */
const DEMO_PASS_THROUGH = new Set(['/', '/login', '/login/callback', '/privacy', '/terms'])

/**
 * `<Link to>` 용 데모 인지 경로 프리픽스 — `useDemoNavigate` 의 선언형(`<Link>`) 짝.
 *
 * 데모(`/demo/*`) 안에서 컴포넌트가 `/board/...` 같은 본앱 절대경로로 링크하면
 * 클릭 시 실서비스 라우트(AuthGuard) 로 빠져 랜딩으로 튕긴다. isDemo 일 때 `/demo` 를
 * 앞에 붙여 데모 안에 머물게 한다. query(`?`)·hash(`#`) 는 보존한다.
 *
 * 본앱(isDemo=false)에선 경로를 그대로 반환 — 동작 불변.
 */
export function useDemoLink(): (path: string) => string {
  const isDemo = useDemoMode()
  return (path: string) => {
    if (!isDemo) return path
    if (!path.startsWith('/') || path.startsWith('/demo')) return path
    const pathname = path.split(/[?#]/)[0]
    if (DEMO_PASS_THROUGH.has(pathname)) return path
    return '/demo' + path
  }
}
