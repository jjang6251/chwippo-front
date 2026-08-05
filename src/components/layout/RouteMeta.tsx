import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { resolveCanonical, resolveRouteMeta } from '@/utils/routeMeta'

/**
 * 라우트가 바뀔 때 `<title>`·canonical·OG 를 갱신한다.
 *
 * 🔴 없으면 **sitemap 에 올린 URL 이 전부 "표준 주소는 홈" 이라고 선언**한다
 * (`index.html` 의 canonical 이 홈 하드코딩이고 SPA 는 head 를 안 건드렸다).
 *
 * ⚠️ **JS 를 실행하는 크롤러(구글)에서만 효과가 있다.** 네이버 Yeti·카카오톡 공유 미리보기는
 * JS 를 실행하지 않아 정적 `index.html` 만 본다 — **공유 카드는 이걸로 안 바뀐다**
 * (프리렌더가 필요하며 범위 밖). 자세한 내용은 `@/utils/routeMeta` 상단.
 *
 * 라우터 안에 한 번만 두면 된다. 렌더 결과가 없는 부수효과 전용 컴포넌트다.
 */
export function RouteMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const meta = resolveRouteMeta(pathname)
    const canonical = resolveCanonical(pathname)

    document.title = meta.title
    setTagContent('meta[name="description"]', meta.description)
    setTagContent('meta[property="og:title"]', meta.title)
    setTagContent('meta[property="og:description"]', meta.description)
    setTagContent('meta[property="og:url"]', canonical)
    setTagContent('meta[name="twitter:title"]', meta.title)
    setTagContent('meta[name="twitter:description"]', meta.description)

    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (link) link.href = canonical
  }, [pathname])

  return null
}

/**
 * `content` 속성 갱신. 태그가 없으면 만들지 않는다 —
 * `index.html` 에 있는 것만 갱신하는 게 의도다(없는 태그가 조용히 생기면 추적이 어렵다).
 */
function setTagContent(selector: string, value: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
}
