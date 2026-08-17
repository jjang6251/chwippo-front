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

    /**
     * 🔴 canonical 은 **없으면 만든다** (2026-08-17 — GSC 「대체 페이지」 색인 제외 사고).
     *
     * 예전엔 `index.html` 의 홈 하드코딩 태그를 갱신만 했는데, 그 하드코딩 자체가
     * 사고의 원인이었다 — 원시 HTML 단계에서 /login·/demo/* 가 전부 「내 표준 주소는
     * 홈」이라고 선언해, 구글이 sitemap 에 올린 페이지들을 홈의 대체로 분류하고
     * 색인에서 뺐다. 그래서 하드코딩을 **제거**했고(틀린 신호 < 무신호), 이제 이
     * 컴포넌트가 렌더 시점에 올바른 값으로 생성한다.
     *
     * ⚠️ og:url 등 meta 태그는 여전히 「있으면 갱신」이다 — og 는 색인이 아니라 공유
     * 카드용이고, JS 없는 크롤러(카카오·네이버)에게 index.html 의 기본값이 fallback
     * 으로 필요해서 하드코딩을 남겼다. canonical 만 정책이 다르다.
     */
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }
    link.href = canonical
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
