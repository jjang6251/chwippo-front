import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ErrorEvent } from '@sentry/react'
import { OUR_BUNDLE, THIRD_PARTY_NOISE_FIXTURES } from '@/test/sentryNoiseFixtures'

/**
 * 시나리오 (코드보다 먼저 정의):
 *  1. DSN 미설정 → Sentry.init 미호출 (로컬·CI 무영향)
 *  2. DSN 설정 → init 호출 + platform 태그
 *  3. 스크러빙 — request.data(자소서 본문) 제거
 *  4. 스크러빙 — URL 쿼리스트링 절단 (OAuth code·state)
 *  5. 스크러빙 — headers(Authorization)·cookies(refresh token) 제거
 *  6. 스크러빙 — user 는 id 만 (이메일·닉네임 제거)
 *  7. 스크러빙 — 예외 message 길이 cap (LLM 프롬프트 유출 차단)
 *  8. 스크러빙 — console breadcrumb 제거
 *  9. 스크러빙 — breadcrumb URL 쿼리스트링 절단
 * 10. init 설정값 — tracesSampleRate 0 · sendDefaultPii false
 * 11. setSentryUser — id 만 전달 / null 이면 해제
 *
 * 서드파티 노이즈 필터 (isThirdPartyNoise · beforeSend) — 픽스처는 운영 실제 이벤트:
 * 12. 걸러야 함 — FRONT-1·B·D·C 4건 → true, beforeSend → null
 * 13. 남겨야 함 — iOS 변종과 메시지가 같지만 가장 안쪽 프레임이 우리 번들
 * 14. 남겨야 함 — 가장 안쪽은 우리 코드, 바깥 프레임에 iabjs 가 섞임
 * 15. 남겨야 함 — exception 없는 이벤트 / stacktrace 없는 예외
 * 16. 남겨야 함 — 우리 도메인 URL 경로에 pagead2 호스트 문자열이 든 프레임
 * 17. 남겨야 함 — 페이지 URL 프레임이지만 함수명이 집합 밖
 * 18. 남겨야 함 — 우리 에러가 서드파티 에러를 cause 로 품음 (예외 여럿 → 전부 서드파티여야 노이즈)
 * 19. 남긴 이벤트는 beforeSend 에서 기존처럼 스크럽된다
 * 20. initSentry 가 init 에 넘기는 beforeSend 가 노이즈를 버리고 나머지를 스크럽한다 (배선)
 * 21. 가장 안쪽이 빈 프레임 → 건너뛰고 한 칸 바깥(iabjs sendDataToNative)으로 판정 → 노이즈
 * 22. 가장 안쪽이 빈 프레임, 한 칸 바깥이 우리 번들 → 우리 코드로 판정 → 남김 (빈 프레임 오판 방지)
 */

const initMock = vi.fn()
const setTagMock = vi.fn()
const setUserMock = vi.fn()

vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initMock(...args),
  setTag: (...args: unknown[]) => setTagMock(...args),
  setUser: (...args: unknown[]) => setUserMock(...args),
  breadcrumbsIntegration: (opts: unknown) => ({ name: 'Breadcrumbs', opts }),
}))

/** 최소 ErrorEvent 골격 — 테스트가 건드리는 필드만 채운다 */
function makeEvent(over: Partial<ErrorEvent> = {}): ErrorEvent {
  return { type: undefined, ...over } as ErrorEvent
}

describe('sentry 스크러빙 (scrubEvent)', () => {
  let scrubEvent: typeof import('./sentry').scrubEvent

  beforeEach(async () => {
    vi.resetModules()
    scrubEvent = (await import('./sentry')).scrubEvent
  })

  it('3. request.data(자소서 본문)를 제거한다', () => {
    const event = makeEvent({
      request: { url: 'https://chwippo.com/coverletters', data: '저는 백엔드 개발자로서...' },
    })
    const out = scrubEvent(event)
    expect(out?.request?.data).toBeUndefined()
  })

  it('4. URL 쿼리스트링을 절단한다 (OAuth code·state)', () => {
    const event = makeEvent({
      request: { url: 'https://chwippo.com/auth/kakao/callback?code=SECRET&state=xyz' },
    })
    const out = scrubEvent(event)
    expect(out?.request?.url).toBe('https://chwippo.com/auth/kakao/callback')
    expect(JSON.stringify(out)).not.toContain('SECRET')
  })

  it('5. headers(Authorization)·cookies(refresh token)를 제거한다', () => {
    const event = makeEvent({
      request: {
        url: 'https://chwippo.com/api',
        headers: { Authorization: 'Bearer eyJhbGciOi...' },
        cookies: { refresh_token: 'rt_secret' },
      },
    })
    const out = scrubEvent(event)
    expect(out?.request?.headers).toBeUndefined()
    expect(out?.request?.cookies).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain('rt_secret')
  })

  it('6. user 는 id 만 남기고 이메일·닉네임을 제거한다', () => {
    const event = makeEvent({
      user: { id: 'u-123', email: 'me@example.com', username: '성원', ip_address: '1.2.3.4' },
    })
    const out = scrubEvent(event)
    expect(out?.user).toEqual({ id: 'u-123' })
  })

  it('7. 예외 message 를 500자로 cap 한다 (LLM 프롬프트 유출 차단)', () => {
    const long = '자'.repeat(2000)
    const event = makeEvent({ exception: { values: [{ type: 'Error', value: long }] } })
    const out = scrubEvent(event)
    const value = out?.exception?.values?.[0]?.value ?? ''
    expect(value.length).toBeLessThan(600)
    expect(value).toContain('(잘림)')
  })

  it('7-b. event.message 도 동일하게 cap 한다', () => {
    const out = scrubEvent(makeEvent({ message: 'x'.repeat(2000) }))
    expect((out?.message ?? '').length).toBeLessThan(600)
  })

  it('8. console breadcrumb 을 제거한다', () => {
    const event = makeEvent({
      breadcrumbs: [
        { category: 'console', message: '[RouteErrorBoundary] 자소서 답변 전문...' },
        { category: 'navigation' },
      ],
    })
    const out = scrubEvent(event)
    expect(out?.breadcrumbs).toHaveLength(1)
    expect(out?.breadcrumbs?.[0].category).toBe('navigation')
  })

  it('9. breadcrumb URL 의 쿼리스트링을 절단한다', () => {
    const event = makeEvent({
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/search?q=삼성전자', method: 'GET' } }],
    })
    const out = scrubEvent(event)
    expect(out?.breadcrumbs?.[0].data?.url).toBe('/api/search')
    expect(out?.breadcrumbs?.[0].data?.method).toBe('GET')
  })

  it('빈 이벤트에도 안전하다 (필드 부재)', () => {
    expect(() => scrubEvent(makeEvent())).not.toThrow()
  })
})

/** 예외 1개짜리 이벤트 — frames 는 바깥→안쪽 (마지막이 던져진 지점) */
function eventWithFrames(
  frames: { filename?: string; function?: string }[],
  value = 'boom',
): ErrorEvent {
  return makeEvent({ exception: { values: [{ type: 'Error', value, stacktrace: { frames } }] } })
}

describe('sentry 서드파티 노이즈 필터 (isThirdPartyNoise · beforeSend)', () => {
  let isThirdPartyNoise: typeof import('./sentry').isThirdPartyNoise
  let beforeSend: typeof import('./sentry').beforeSend

  beforeEach(async () => {
    vi.resetModules()
    ;({ isThirdPartyNoise, beforeSend } = await import('./sentry'))
  })

  it.each(THIRD_PARTY_NOISE_FIXTURES)('12. $issue($id) 실제 이벤트를 거른다', ({ make }) => {
    expect(isThirdPartyNoise(make())).toBe(true)
    expect(beforeSend(make())).toBeNull()
  })

  it('13. iOS 변종과 메시지가 같아도 가장 안쪽 프레임이 우리 번들이면 남긴다', () => {
    const event = eventWithFrames(
      [
        { filename: OUR_BUNDLE, function: '?' },
        { filename: OUR_BUNDLE, function: 'Qe' },
      ],
      "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
    )
    expect(isThirdPartyNoise(event)).toBe(false)
    expect(beforeSend(event)).not.toBeNull()
  })

  it('14. 바깥 프레임에 iabjs 가 섞여도 가장 안쪽이 우리 코드면 남긴다', () => {
    const event = eventWithFrames([
      { filename: 'iabjs://navigation_performance_logger_android', function: 'sendDataToNative' },
      { filename: OUR_BUNDLE, function: 'ht' },
    ])
    expect(isThirdPartyNoise(event)).toBe(false)
  })

  it('15. exception 이 없거나 stacktrace 가 없으면 판정 불가 — 남긴다', () => {
    expect(isThirdPartyNoise(makeEvent({ message: 'boom' }))).toBe(false)
    expect(isThirdPartyNoise(makeEvent({ exception: { values: [] } }))).toBe(false)
    expect(
      isThirdPartyNoise(makeEvent({ exception: { values: [{ type: 'Error', value: 'boom' }] } })),
    ).toBe(false)
  })

  it('16. 우리 도메인 URL 경로에 pagead2 호스트 문자열이 들어 있어도 남긴다 (호스트로만 판정)', () => {
    const event = eventWithFrames([
      { filename: 'https://chwippo.com/pagead2.googlesyndication.com/pagead/js/rum.js', function: 'Ia' },
    ])
    expect(isThirdPartyNoise(event)).toBe(false)
  })

  it('17. 페이지 URL 프레임이어도 함수명이 인앱 브라우저 집합 밖이면 남긴다', () => {
    const event = eventWithFrames([
      { filename: 'https://chwippo.com/', function: '?' },
      { filename: 'https://chwippo.com/', function: 'handleClick' },
    ])
    expect(isThirdPartyNoise(event)).toBe(false)
  })

  it('18. 우리 에러가 서드파티 에러를 cause 로 품으면 남긴다 (예외 전부가 서드파티여야 노이즈)', () => {
    const [iabCause] = THIRD_PARTY_NOISE_FIXTURES[1].make().exception?.values ?? []
    const event = makeEvent({
      exception: {
        values: [
          iabCause,
          { type: 'Error', value: '저장 실패', stacktrace: { frames: [{ filename: OUR_BUNDLE, function: 'Zt' }] } },
        ],
      },
    })
    expect(isThirdPartyNoise(event)).toBe(false)
  })

  it('19. 남긴 이벤트는 beforeSend 에서 기존처럼 스크럽된다', () => {
    const event = eventWithFrames([{ filename: OUR_BUNDLE, function: 'Qe' }], 'x'.repeat(2000))
    event.request = { url: 'https://chwippo.com/auth/kakao/callback?code=SECRET', data: '자소서 본문' }
    event.user = { id: 'u-1', email: 'me@example.com' }

    const out = beforeSend(event)
    expect(out?.request?.url).toBe('https://chwippo.com/auth/kakao/callback')
    expect(out?.request?.data).toBeUndefined()
    expect(out?.user).toEqual({ id: 'u-1' })
    expect((out?.exception?.values?.[0]?.value ?? '').length).toBeLessThan(600)
  })

  it('21. 가장 안쪽 빈 프레임은 건너뛰고 한 칸 바깥(iabjs)으로 판정한다 — 노이즈', () => {
    const event = eventWithFrames([
      { filename: 'iabjs://navigation_performance_logger_android', function: 'sendDataToNative' },
      {},
    ])
    expect(isThirdPartyNoise(event)).toBe(true)
  })

  it('22. 가장 안쪽 빈 프레임을 건너뛴 바깥이 우리 번들이면 남긴다 (빈 프레임 오판 방지)', () => {
    const event = eventWithFrames([{ filename: OUR_BUNDLE, function: 'Qe' }, {}])
    expect(isThirdPartyNoise(event)).toBe(false)
  })
})

describe('sentry 초기화 (initSentry)', () => {
  const origEnv = { ...import.meta.env }

  beforeEach(() => {
    vi.resetModules()
    initMock.mockClear()
    setTagMock.mockClear()
    setUserMock.mockClear()
  })

  afterEach(() => {
    Object.assign(import.meta.env, origEnv)
  })

  it('1. DSN 미설정이면 init 을 호출하지 않는다', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    const { initSentry } = await import('./sentry')
    initSentry()
    expect(initMock).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('2·10. DSN 설정 시 init + platform 태그, quota 설정이 안전값이다', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.sentry.io/1')
    const { initSentry } = await import('./sentry')
    initSentry()

    expect(initMock).toHaveBeenCalledTimes(1)
    const cfg = initMock.mock.calls[0][0] as Record<string, unknown>
    expect(cfg.sendDefaultPii).toBe(false)
    expect(cfg.tracesSampleRate).toBe(0)
    expect(typeof cfg.beforeSend).toBe('function')

    // console breadcrumb 비활성 — Breadcrumbs 통합이 console:false 로 교체됐는지
    const integrations = (cfg.integrations as (d: unknown[]) => { name: string; opts?: unknown }[])(
      [{ name: 'Breadcrumbs' }, { name: 'GlobalHandlers' }],
    )
    const bc = integrations.find((i) => i.name === 'Breadcrumbs')
    expect(bc?.opts).toEqual({ console: false })
    expect(integrations.some((i) => i.name === 'GlobalHandlers')).toBe(true)

    expect(setTagMock).toHaveBeenCalledWith('platform', 'web')
    vi.unstubAllEnvs()
  })

  it('20. init 에 넘긴 beforeSend 가 노이즈는 버리고 나머지는 스크럽한다 (배선)', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.sentry.io/1')
    const { initSentry } = await import('./sentry')
    initSentry()

    const cfg = initMock.mock.calls[0][0] as { beforeSend: (e: ErrorEvent) => ErrorEvent | null }
    for (const { make } of THIRD_PARTY_NOISE_FIXTURES) {
      expect(cfg.beforeSend(make())).toBeNull()
    }
    const kept = cfg.beforeSend(makeEvent({ request: { url: 'https://chwippo.com/x?code=SECRET' } }))
    expect(kept?.request?.url).toBe('https://chwippo.com/x')
    vi.unstubAllEnvs()
  })

  it('11. setSentryUser 는 id 만 전달하고, null 이면 해제한다', async () => {
    const { setSentryUser } = await import('./sentry')
    setSentryUser('u-1')
    expect(setUserMock).toHaveBeenCalledWith({ id: 'u-1' })
    setSentryUser(null)
    expect(setUserMock).toHaveBeenLastCalledWith(null)
  })
})
