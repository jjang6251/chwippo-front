import { describe, expect, it } from 'vitest'
import {
  DEFAULT_META,
  ROUTE_META,
  SITE_ORIGIN,
  resolveCanonical,
  resolveRouteMeta,
} from './routeMeta'

describe('routeMeta — 조회·프로토타입 가드', () => {
  it('등록 경로는 해당 메타를 돌려준다', () => {
    expect(resolveRouteMeta('/')).toBe(ROUTE_META['/'])
    expect(resolveRouteMeta('/privacy')).toBe(ROUTE_META['/privacy'])
  })

  it("끝의 '/' 는 무시한다 (/privacy/ = /privacy)", () => {
    expect(resolveRouteMeta('/privacy/')).toBe(ROUTE_META['/privacy'])
  })

  it('미등록 경로는 DEFAULT_META', () => {
    expect(resolveRouteMeta('/no-such-page')).toBe(DEFAULT_META)
  })

  it("프로토타입 키('__proto__'·'constructor'·'hasOwnProperty')는 Object.prototype 값이 새지 않고 DEFAULT_META (CWE-1321)", () => {
    for (const key of ['__proto__', 'constructor', 'hasOwnProperty']) {
      expect(resolveRouteMeta(key)).toBe(DEFAULT_META)
    }
  })

  it('미등록 경로의 canonical 은 홈으로 모은다', () => {
    expect(resolveCanonical('/no-such-page')).toBe(`${SITE_ORIGIN}/`)
  })
})

/**
 * 🔴 구형 WebKit 시뮬레이션 (2026-08-12 실사고 CHWIPPO-FRONT-3).
 * `Object.hasOwn` 은 ES2022 — iOS/Safari 15.4 미만 엔진에는 존재하지 않는다.
 * 이 조회는 전 페이지 렌더 경로라 그 기기에선 앱·웹 전 화면이 죽었다 (16회/19초).
 * jsdom·최신 기기는 전부 이 API 를 가지므로 "지워진 환경"을 흉내내야만 회귀가 잡힌다
 * (/qa 16축: 실행 환경 호환). 구현이 Object.hasOwn 으로 되돌아가면 이 블록이 실패한다.
 *
 * ⚠️ 패턴 주의 — stub 은 **호출 구간에만** 걸고 단언 전에 복원한다. jsdom 과 vitest
 * 내부도 Object.hasOwn 을 쓰므로, describe 범위로 stub 하면 하네스가 먼저 죽는다 (실측).
 */
describe('routeMeta — Object.hasOwn 이 없는 구형 엔진에서도 동작', () => {
  it('조회·trailing slash·프로토타입 가드 전부 동일하게 동작한다', () => {
    const original = Object.hasOwn
    let results: unknown[]
    try {
      ;(Object as { hasOwn?: unknown }).hasOwn = undefined
      results = [
        resolveRouteMeta('/privacy'),
        resolveRouteMeta('/privacy/'),
        resolveRouteMeta('/no-such-page'),
        resolveRouteMeta('__proto__'),
        resolveCanonical('/no-such-page'),
      ]
    } finally {
      ;(Object as { hasOwn?: unknown }).hasOwn = original
    }
    expect(results[0]).toBe(ROUTE_META['/privacy'])
    expect(results[1]).toBe(ROUTE_META['/privacy'])
    expect(results[2]).toBe(DEFAULT_META)
    expect(results[3]).toBe(DEFAULT_META)
    expect(results[4]).toBe(`${SITE_ORIGIN}/`)
  })
})
