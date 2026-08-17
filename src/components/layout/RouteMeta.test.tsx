import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { RouteMeta } from './RouteMeta'
import { ROUTE_META, DEFAULT_META, resolveCanonical, resolveRouteMeta } from '@/utils/routeMeta'
// `public/` 은 `src/` 밖이라 `@/` alias 가 닿지 않는다 — 이 한 건만 상대 경로 + Vite `?raw`
import sitemapXml from '../../../public/sitemap.xml?raw'

/**
 * 이 spec 이 지키는 것은 두 가지다.
 *  ① sitemap 에 올린 URL 이 **자기 주소를 canonical 로 선언**하는가 (원래 문제)
 *  ② sitemap ↔ ROUTE_META 가 **같은 목록**인가 (한쪽만 늘어나면 다시 홈으로 뭉개진다)
 */

/**
 * `index.html` 이 가진 head 를 그대로 재현.
 * 🔴 canonical 은 **일부러 없다** (2026-08-17) — 하드코딩 홈 canonical 이 GSC 색인 제외
 * 사고의 원인이라 index.html 에서 제거했고, RouteMeta 가 렌더 시점에 생성한다.
 * 픽스처에 canonical 을 되살리면 「생성 경로」가 영영 안 돌므로 되살리지 말 것.
 */
function setupHead() {
  document.head.innerHTML = `
    <meta name="description" content="${DEFAULT_META.description}" />
    <meta property="og:title" content="${DEFAULT_META.title}" />
    <meta property="og:description" content="${DEFAULT_META.description}" />
    <meta property="og:url" content="https://chwippo.com" />
    <meta name="twitter:title" content="${DEFAULT_META.title}" />
    <meta name="twitter:description" content="${DEFAULT_META.description}" />
  `
  document.title = DEFAULT_META.title
}

function head() {
  return {
    title: document.title,
    canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    description: document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.getAttribute('content'),
    ogTitle: document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.getAttribute('content'),
    ogUrl: document
      .querySelector<HTMLMetaElement>('meta[property="og:url"]')
      ?.getAttribute('content'),
    twitterTitle: document
      .querySelector<HTMLMetaElement>('meta[name="twitter:title"]')
      ?.getAttribute('content'),
  }
}

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <RouteMeta />
    </MemoryRouter>,
  )
}

describe('RouteMeta', () => {
  beforeEach(setupHead)

  it('sitemap 의 9개 SPA 경로가 각각 자기 주소를 canonical 로 선언한다', () => {
    for (const path of Object.keys(ROUTE_META)) {
      setupHead()
      renderAt(path)
      expect(head().canonical, path).toBe(`https://chwippo.com${path === '/' ? '/' : path}`)
    }
  })

  it('데모 경로에서 title·description·OG 가 그 페이지 값으로 바뀐다', () => {
    renderAt('/demo/board')
    const h = head()
    const expected = ROUTE_META['/demo/board']
    expect(h.title).toBe(expected.title)
    expect(h.description).toBe(expected.description)
    expect(h.ogTitle).toBe(expected.title)
    expect(h.twitterTitle).toBe(expected.title)
    // og:* 는 **JS 를 실행하는 소비자**(구글·일부 봇)용이다. 카톡·페북 공유 카드는 JS 를
    // 실행하지 않아 정적 index.html 을 읽으므로 이 값과 무관하다 — 여기서 검증하는 건 전자다.
    expect(h.ogUrl).toBe('https://chwippo.com/demo/board')
  })

  it('홈은 index.html 의 정적 meta 와 같은 값을 유지한다 (초기 렌더가 덮어쓰지 않음)', () => {
    renderAt('/')
    const h = head()
    expect(h.title).toBe(DEFAULT_META.title)
    expect(h.description).toBe(DEFAULT_META.description)
    expect(h.canonical).toBe('https://chwippo.com/')
  })

  it('sitemap 에 없는 로그인 뒤 화면은 홈 canonical 로 모은다 (중복 색인 방지)', () => {
    renderAt('/board/abc-123')
    const h = head()
    expect(h.canonical).toBe('https://chwippo.com/')
    expect(h.title).toBe(DEFAULT_META.title)
  })

  // CWE-1321 — 객체 키 조회에서 Object.prototype 이 새면 title 이 `undefined` 가 되고
  // canonical 이 `https://chwippo.comconstructor` 같은 쓰레기 URL 이 된다.
  it.each(['/__proto__', '/constructor', 'constructor', '__proto__', 'toString'])(
    '프로토타입 키(%s)로도 홈 기본값을 준다',
    (evil) => {
      expect(resolveRouteMeta(evil)).toBe(DEFAULT_META)
      expect(resolveCanonical(evil)).toBe('https://chwippo.com/')
    },
  )

  // 설계상 **meta 태그는 없으면 만들지 않는다** (`index.html` 의 og 기본값이 JS 없는
  // 크롤러의 fallback 이라 하드코딩을 남겼고, 여기 것만 갱신한다).
  // 🔴 **canonical 만 정책이 다르다** (2026-08-17 GSC 사고) — index.html 에서 하드코딩을
  // 제거했으므로 RouteMeta 가 **생성**해야 한다. 안 만들면 SPA 전 라우트가 무canonical 이
  // 아니라... 무canonical 이 맞긴 한데, 렌더를 실행하는 구글에게 줄 올바른 신호가 사라진다.
  it('meta 는 없으면 안 만들지만, canonical 은 없으면 만든다', () => {
    document.head.innerHTML = ''
    document.title = '이전'
    expect(() => renderAt('/privacy')).not.toThrow()
    expect(document.title).toBe(ROUTE_META['/privacy'].title)
    expect(document.querySelector('meta[name="description"]')).toBeNull()
    // 🔴 생성 경로 — 하드코딩 제거 후 유일한 canonical 공급원
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe('https://chwippo.com/privacy')
  })

  it('끝의 / 가 붙어도 같은 페이지로 본다', () => {
    expect(resolveRouteMeta('/privacy/')).toBe(ROUTE_META['/privacy'])
    expect(resolveCanonical('/privacy/')).toBe('https://chwippo.com/privacy')
  })

  // 🔴 SPA 는 **최초 로드 때만** head 를 맞추면 안 된다. 사용자가 링크로 이동하면 이전 페이지의
  // title·canonical 이 그대로 남는다 — 크롤러가 그 상태를 렌더하면 잘못된 canonical 을 읽는다.
  // (`MemoryRouter` 는 initialEntries 를 최초 1회만 읽으므로 rerender 가 아니라 실제 이동으로 검증한다)
  it('링크로 이동하면 meta 도 따라 바뀐다', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <RouteMeta />
        <Link to="/terms">약관</Link>
      </MemoryRouter>,
    )
    expect(head().title).toBe(ROUTE_META['/privacy'].title)
    expect(head().canonical).toBe('https://chwippo.com/privacy')

    await user.click(screen.getByRole('link', { name: '약관' }))
    expect(head().title).toBe(ROUTE_META['/terms'].title)
    expect(head().canonical).toBe('https://chwippo.com/terms')
  })

  // 한국어 SERP 는 title 을 ~30자에서 자른다. 홈(34자)은 이미 색인된 값이라 예외로 두고,
  // **새로 추가하는 라우트만** 32자 이하로 강제한다 — 여기서 안 막으면 잘린 제목이 조용히 늘어난다.
  it('title 은 32자 이하 · 중복 없음 · description 은 실질 문장이다', () => {
    const titles = new Set<string>()
    for (const [path, meta] of Object.entries(ROUTE_META)) {
      expect(meta.title.trim().length, `${path} title 비어 있음`).toBeGreaterThan(5)
      if (path !== '/') {
        expect(meta.title.length, `${path} title 이 SERP 절단선 초과`).toBeLessThanOrEqual(32)
      }
      expect(meta.description.length, `${path} description`).toBeGreaterThan(20)
      expect(meta.description.length, `${path} description 이 너무 김`).toBeLessThanOrEqual(120)
      expect(titles.has(meta.title), `${path} title 중복`).toBe(false)
      titles.add(meta.title)
    }
  })
})

describe('sitemap ↔ ROUTE_META 정합', () => {
  it('sitemap 의 SPA 경로와 ROUTE_META 의 키가 정확히 일치한다', () => {
    const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    // 가이드는 정적 HTML 이라 각자 자기 canonical 을 갖는다 — SPA 라우터의 관할이 아니다
    const spaPaths = locs
      .map((u) => u.replace('https://chwippo.com', '') || '/')
      .filter((p) => !p.startsWith('/guide'))

    expect(spaPaths.sort()).toEqual(Object.keys(ROUTE_META).sort())
  })
})
