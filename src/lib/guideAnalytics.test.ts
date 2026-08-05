import { describe, it, expect } from 'vitest'

/**
 * 가이드 페이지(정적 HTML)의 추적 태그 회귀 방어.
 *
 * 🔴 이게 없으면 **가이드를 새로 쓸 때마다 조용히 측정 밖으로 빠진다.** 실제로 2026-08-06
 * 실측 시 6장 전부 태그가 없었고, GSC 노출·클릭 말고는 유입을 볼 방법이 없었다.
 * SPA 는 `initClarity()` 가 자동으로 돌지만 정적 HTML 은 사람이 붙여야 하므로 여기서 강제한다.
 *
 * `import.meta.glob` 을 쓰는 이유 — 파일명을 나열하면 **새로 추가된 가이드가 검사에서 빠진다.**
 * 폴더를 통째로 훑어야 "새 가이드에 태그 누락" 이 걸린다.
 */

const guides = import.meta.glob('../../public/guide/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const loader = Object.entries(
  import.meta.glob('../../public/guide/analytics.js', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)[0]?.[1]

describe('가이드 정적 HTML — 이용 분석 태그', () => {
  it('가이드 HTML 을 실제로 읽어왔다 (glob 이 빈 결과면 아래 검사가 전부 무의미)', () => {
    expect(Object.keys(guides).length).toBeGreaterThanOrEqual(6)
  })

  it('모든 가이드가 analytics.js 를 참조한다', () => {
    const missing = Object.entries(guides)
      .filter(([, html]) => !html.includes('/guide/analytics.js'))
      .map(([path]) => path.split('/').pop())
    expect(missing, '태그 누락 가이드').toEqual([])
  })

  it('태그는 head 안에 defer 로 붙는다 (본문 렌더를 막지 않게)', () => {
    for (const [path, html] of Object.entries(guides)) {
      const name = path.split('/').pop()!
      const head = html.slice(0, html.indexOf('</head>'))
      expect(head, `${name}: head 밖에 있음`).toContain('/guide/analytics.js')
      expect(html, `${name}: defer 누락`).toMatch(
        /<script[^>]+src="\/guide\/analytics\.js"[^>]*defer/,
      )
    }
  })
})

describe('analytics.js', () => {
  it('프로젝트 ID 가 비어 있지 않다', () => {
    const id = loader?.match(/PROJECT_ID = '([^']+)'/)?.[1]
    expect(id, 'PROJECT_ID 를 못 찾음').toBeTruthy()
    expect(id!.length).toBeGreaterThan(5)
  })

  // 🔴 이 가드가 빠지면 로컬 개발·CI e2e·Vercel 프리뷰 트래픽이 전부 운영 Clarity 로 들어간다.
  // SPA 는 env 미설정으로 자동 차단되지만 이 파일은 ID 가 상수라 가드 없이는 어디서 열든 켜진다.
  it('운영 도메인 가드가 있다', () => {
    expect(loader).toContain('chwippo.com')
    expect(loader).toMatch(/indexOf\(location\.hostname\) === -1\) return/)
  })

  it('가드가 실제로 동작한다 — localhost 에서는 스크립트를 붙이지 않는다', () => {
    document.head.innerHTML = ''
    runLoader('localhost')
    expect(document.getElementById('clarity-script')).toBeNull()
  })

  it('가드가 실제로 동작한다 — 운영 도메인에서는 붙인다', () => {
    document.head.innerHTML = ''
    runLoader('chwippo.com')
    const s = document.getElementById('clarity-script') as HTMLScriptElement | null
    expect(s).not.toBeNull()
    expect(s!.src).toContain('clarity.ms/tag/')
    expect(s!.async).toBe(true)
  })
})

/**
 * `analytics.js` 를 주어진 hostname 으로 실제 실행한다.
 *
 * 파일이 IIFE 라 import 로는 못 부르고, jsdom 의 `location` 은 재정의가 막혀 있다.
 * 그래서 `location`·`window`·`document` 를 인자로 받는 함수로 감싸 평가한다 —
 * **파일 내용 자체를 그대로 돌리므로** 문자열 매칭보다 강한 검증이다.
 */
function runLoader(hostname: string) {
  const fakeWindow = { clarity: undefined } as unknown as Window & { clarity?: unknown }
  new Function(
    'location',
    'window',
    'document',
    `${loader}`,
  )({ hostname }, fakeWindow, document)
}
