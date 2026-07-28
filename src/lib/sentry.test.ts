import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ErrorEvent } from '@sentry/react'

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

  it('11. setSentryUser 는 id 만 전달하고, null 이면 해제한다', async () => {
    const { setSentryUser } = await import('./sentry')
    setSentryUser('u-1')
    expect(setUserMock).toHaveBeenCalledWith({ id: 'u-1' })
    setSentryUser(null)
    expect(setUserMock).toHaveBeenLastCalledWith(null)
  })
})
