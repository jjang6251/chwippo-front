import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isPixelExcludedPath, trackPageView } from '@/lib/metaPixel'

/**
 * 라우트가 바뀔 때 Meta Pixel `PageView` 를 보낸다.
 *
 * 🔴 없으면 **방문자가 몇 화면을 보든 PageView 가 1건**이다. 메타 표준 스니펫은 정적 HTML
 * 전제라 문서 로드 시 한 번만 쏘는데, SPA 는 그 뒤로 문서를 다시 로드하지 않기 때문이다.
 * `RouteMeta`(title·canonical)와 같은 이유·같은 자리에서 도는 부수효과 전용 컴포넌트다.
 *
 * ⚠️ **최초 1회는 여기서 보내지 않는다** — `initMetaPixel()`(main.tsx)이 부트스트랩 직후
 * 이미 보냈다. 첫 렌더에서도 쏘면 첫 화면만 PageView 2건이 된다.
 *
 * ⚠️ `/ops/*` 는 제외한다 (판정은 `isPixelExcludedPath` 단일 구현). 운영자 한 명의 화면
 * 이동이 광고 모수에 섞이면 표본이 작은 지금은 그대로 왜곡이 된다.
 *
 * 픽셀 미설정(로컬·CI·프리뷰)이면 `trackPageView` 가 no-op 이라 이 컴포넌트도 무해하다.
 */
export function MetaPixelPageView() {
  const { pathname } = useLocation()
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      // 최초 PageView 는 initMetaPixel 이 이미 보냈다 (위 주석)
      mounted.current = true
      return
    }
    if (isPixelExcludedPath(pathname)) return
    trackPageView()
  }, [pathname])

  return null
}
