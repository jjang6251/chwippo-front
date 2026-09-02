/**
 * Meta Pixel — **방침보다 먼저 켜지면 안 되고, 켜져도 앱을 죽이면 안 된다.**
 *
 * 🔴 이 spec 의 존재 이유는 세 가지다:
 *
 * 1. **미설정 = 완전 no-op** — 개인정보처리방침 §5-2 개정은 2026-09-03 공고 / **09-10 시행**이다.
 *    시행 전에 수집이 시작되면 **고지 없는 수집**이 된다. 게다가 로컬·CI·프리뷰에서 켜지면
 *    운영 광고 모수가 오염된다. `VITE_META_PIXEL_ID` 가 없으면 아무것도 하지 않아야 한다.
 * 2. **어떤 경로에서도 안 던진다** — 광고 차단기는 `fbevents.js` 를 흔히 막는다. 계측이
 *    던지면 **광고를 켜는 순간 서비스가 멈춘다.**
 * 3. **`/ops/*` 제외** — 운영자 한 명의 화면 이동이 광고 모수에 섞이면 표본이 작은 지금은
 *    그대로 왜곡이 된다.
 *
 * 시나리오: 미설정(주입 0·전역 무접촉) · 설정됨(주입·init·PageView) · 중복 호출 ·
 *           기존 fbq 보존 · trackSignupComplete 발화 · fbq 부재/예외 무사고 · ops 경로 판정
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initMetaPixel,
  isMetaPixelActive,
  isPixelExcludedPath,
  trackPageView,
  trackSignupComplete,
} from './metaPixel'

function cleanup() {
  document.getElementById('meta-pixel-script')?.remove()
  delete (window as unknown as { fbq?: unknown }).fbq
  delete (window as unknown as { _fbq?: unknown })._fbq
}

/** 큐 shim 에 쌓인 호출 인자 목록 (스크립트 로드 전이므로 실호출은 전부 여기 남는다) */
function fbqQueue(): unknown[] {
  return (window as unknown as { fbq?: { queue?: unknown[] } }).fbq?.queue ?? []
}

beforeEach(cleanup)
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('initMetaPixel', () => {
  /** 🔴 방침 시행일 전 · 로컬 · CI · 프리뷰 — 여기서 스크립트가 붙으면 고지 없는 수집이다 */
  it('픽셀 ID 미설정이면 아무것도 하지 않는다 (주입 0 · window 무접촉)', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '')
    initMetaPixel()
    expect(document.getElementById('meta-pixel-script')).toBeNull()
    expect(isMetaPixelActive()).toBe(false)
    expect((window as unknown as { fbq?: unknown }).fbq).toBeUndefined()
    expect((window as unknown as { _fbq?: unknown })._fbq).toBeUndefined()
  })

  it('픽셀 ID 가 있으면 표준 스니펫을 주입한다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    initMetaPixel()
    const s = document.getElementById('meta-pixel-script') as HTMLScriptElement
    expect(s).not.toBeNull()
    expect(s.src).toBe('https://connect.facebook.net/en_US/fbevents.js')
    expect(s.async).toBe(true)
    expect(isMetaPixelActive()).toBe(true)
  })

  /**
   * init 다음에 최초 PageView 까지가 표준 스니펫 한 세트다. 순서가 뒤집히거나 PageView 가
   * 빠지면 픽셀이 「설치됨」으로 안 잡힌다.
   */
  it("init 과 최초 PageView 를 순서대로 큐에 쌓는다", () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    initMetaPixel()
    expect(fbqQueue()).toEqual([
      ['init', '123456789'],
      ['track', 'PageView'],
    ])
  })

  /** StrictMode·리마운트로 두 번 불려도 스크립트가 둘이 되면 안 된다 */
  it('중복 호출해도 스크립트·큐가 한 벌이다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    initMetaPixel()
    initMetaPixel()
    expect(document.querySelectorAll('#meta-pixel-script')).toHaveLength(1)
    expect(fbqQueue()).toHaveLength(2)
  })

  /** 이미 있는 fbq 를 덮으면 그때까지 쌓인 큐가 통째로 사라진다 */
  it('이미 fbq 가 있으면 덮어쓰지 않는다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    const existing = vi.fn()
    ;(window as unknown as { fbq: unknown }).fbq = existing

    initMetaPixel()

    expect((window as unknown as { fbq: unknown }).fbq).toBe(existing)
    expect(existing).toHaveBeenCalledWith('init', '123456789')
    expect(existing).toHaveBeenCalledWith('track', 'PageView')
  })

  /** 🔴 차단기·CSP 로 주입이 실패해도 앱은 살아야 한다 */
  it('🔴 스크립트 주입이 실패해도 던지지 않는다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    const spy = vi.spyOn(document.head, 'appendChild').mockImplementation(() => {
      throw new Error('blocked by extension')
    })
    expect(() => initMetaPixel()).not.toThrow()
    spy.mockRestore()
  })
})

describe('전환 이벤트', () => {
  it('trackSignupComplete 가 CompleteRegistration 을 보낸다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    const spy = vi.fn()
    ;(window as unknown as { fbq?: unknown }).fbq = spy

    trackSignupComplete()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('track', 'CompleteRegistration')
  })

  it('trackPageView 가 PageView 를 보낸다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    const spy = vi.fn()
    ;(window as unknown as { fbq?: unknown }).fbq = spy

    trackPageView()

    expect(spy).toHaveBeenCalledWith('track', 'PageView')
  })

  /** 🔴 미설정 환경에서 남의 fbq 로 새어 나가면 안 된다 (프리뷰·CI) */
  it('픽셀 ID 미설정이면 fbq 가 있어도 부르지 않는다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '')
    const spy = vi.fn()
    ;(window as unknown as { fbq?: unknown }).fbq = spy

    trackSignupComplete()
    trackPageView()

    expect(spy).not.toHaveBeenCalled()
  })

  it('🔴 fbq 미존재(광고 차단기) → 안 던진다', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    expect(() => trackSignupComplete()).not.toThrow()
    expect(() => trackPageView()).not.toThrow()
  })

  it('🔴 fbq 가 던져도 삼킨다 — 계측 실패 ≠ 기능 실패', () => {
    vi.stubEnv('VITE_META_PIXEL_ID', '123456789')
    ;(window as unknown as { fbq?: unknown }).fbq = () => {
      throw new Error('fbq boom')
    }
    expect(() => trackSignupComplete()).not.toThrow()
  })
})

/**
 * 관리자 트래픽 제외 — `initMetaPixel`(최초 PageView)과 `MetaPixelPageView`(라우트 변경)가
 * **같은 판정**을 써야 한다. 한쪽에만 두면 `/ops` 로 직접 들어온 방문이 새어 나간다.
 */
describe('isPixelExcludedPath', () => {
  it.each([['/ops'], ['/ops/'], ['/ops/users'], ['/ops/ai-usage']])(
    '%s 는 제외한다',
    (p) => expect(isPixelExcludedPath(p)).toBe(true),
  )

  it.each([['/'], ['/board'], ['/demo/calendar'], ['/opsimposter'], ['/settings']])(
    '%s 는 제외하지 않는다',
    (p) => expect(isPixelExcludedPath(p)).toBe(false),
  )
})
