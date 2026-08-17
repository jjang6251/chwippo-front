/**
 * Microsoft Clarity 도입 — **방침보다 먼저 켜지면 안 된다.**
 *
 * 🔴 이 spec 의 존재 이유는 두 가지다:
 *
 * 1. **시행일 전 비활성 보장** — 개인정보처리방침 개정은 2026-08-04 공고 / **08-11 시행**이다.
 *    시행 전에 수집이 시작되면 **고지 없는 수집**이 된다. `VITE_CLARITY_PROJECT_ID` 미설정이면
 *    아무것도 하지 않아야 한다 (Sentry DSN 과 같은 절차).
 * 2. **앱/웹 구분 태그** — 앱(WebView)도 수집하되(비공개 테스트 관측), `platform` 태그로
 *    갈라 보지 못하면 두 흐름이 섞여 해석이 어긋난다. 태그가 빠지면 켠 의미가 없다.
 *
 * 시나리오: 미설정 · 설정됨 · 앱 · 플랫폼 태그(app/web) · 중복 호출 · 마스킹 상수
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLARITY_MASK, initClarity, isClarityActive, trackClarityEvent } from './clarity'

function cleanup() {
  document.getElementById('clarity-script')?.remove()
  document.documentElement.removeAttribute('data-native')
  delete (window as unknown as { clarity?: unknown }).clarity
}

/** 큐 shim 에 쌓인 호출 인자 목록 (스크립트 로드 전이므로 실호출은 전부 여기 남는다) */
function clarityQueue(): unknown[] {
  const w = window as unknown as {
    clarity?: ((...a: unknown[]) => void) & { q?: unknown[] }
  }
  return w.clarity?.q ?? []
}

describe('initClarity', () => {
  beforeEach(cleanup)
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  /** 🔴 방침 시행일 전 · 로컬 · CI — 여기서 스크립트가 붙으면 고지 없는 수집이다 */
  it('프로젝트 ID 미설정이면 아무것도 하지 않는다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', '')
    initClarity()
    expect(document.getElementById('clarity-script')).toBeNull()
    expect(isClarityActive()).toBe(false)
  })

  /** 앱도 예외가 아니다 — 미설정이면 shim 도 태그도 없어야 완전 no-op 이다 */
  it('앱(WebView)도 프로젝트 ID 미설정이면 완전 no-op 이다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', '')
    document.documentElement.dataset.native = '1'
    initClarity()
    expect(document.getElementById('clarity-script')).toBeNull()
    expect(isClarityActive()).toBe(false)
    expect((window as unknown as { clarity?: unknown }).clarity).toBeUndefined()
    expect(clarityQueue()).toHaveLength(0)
  })

  it('프로젝트 ID 가 있으면 스크립트를 주입한다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    initClarity()
    const s = document.getElementById('clarity-script') as HTMLScriptElement
    expect(s).not.toBeNull()
    expect(s.src).toContain('clarity.ms/tag/abc123')
    expect(s.async).toBe(true)
  })

  /**
   * 2026-08-15 계약 반전 — 앱(WebView)도 수집한다. Play 비공개 테스트에서 앱 사용을
   * 관측할 수단이 이것뿐이다. 섞임은 아래 `platform` 태그로 푼다.
   */
  it('앱(WebView)에서도 주입한다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    document.documentElement.dataset.native = '1'
    initClarity()
    expect(document.getElementById('clarity-script')).not.toBeNull()
    expect(isClarityActive()).toBe(true)
  })

  /** StrictMode·리마운트로 두 번 불려도 스크립트가 둘이 되면 안 된다 */
  it('중복 호출해도 스크립트는 하나다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    initClarity()
    initClarity()
    expect(document.querySelectorAll('#clarity-script')).toHaveLength(1)
  })
})

/**
 * 앱·웹 세션이 한 프로젝트에 섞여도 필터로 갈라 볼 수 있어야 한다.
 * 어휘는 Sentry `platform` 태그와 동일 — 두 도구를 같은 단어로 필터하기 위함이다.
 */
describe('platform 태그', () => {
  beforeEach(cleanup)
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('앱(WebView)이면 app 으로 태그한다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    document.documentElement.dataset.native = '1'
    initClarity()
    expect(clarityQueue()).toEqual([['set', 'platform', 'app']])
  })

  it('웹이면 web 으로 태그한다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    initClarity()
    expect(clarityQueue()).toEqual([['set', 'platform', 'web']])
  })

  /** 중복 주입 방지 가드보다 태그가 앞서면 리마운트마다 같은 태그가 쌓인다 */
  it('중복 호출해도 태그는 한 번만 쌓인다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    initClarity()
    initClarity()
    expect(clarityQueue()).toEqual([['set', 'platform', 'web']])
  })
})

/**
 * 스크립트가 아직 안 실려도 `clarity(...)` 호출이 유실되면 안 된다 —
 * Microsoft 스니펫이 큐 shim 을 두는 이유다. 로드 완료 후 큐가 재생된다.
 */
describe('큐 shim', () => {
  beforeEach(cleanup)
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('스크립트 로드 전 호출이 큐에 쌓인다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    initClarity()

    const w = window as unknown as {
      clarity: ((...a: unknown[]) => void) & { q?: unknown[] }
    }
    w.clarity('event', 'testEvent')

    // initClarity 가 넣은 platform 태그 뒤에 순서대로 쌓인다
    expect(w.clarity.q).toEqual([
      ['set', 'platform', 'web'],
      ['event', 'testEvent'],
    ])
  })

  /** 이미 있는 clarity 를 덮으면 그때까지 쌓인 큐가 통째로 사라진다 */
  it('이미 clarity 가 있으면 덮어쓰지 않는다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    const existing = vi.fn()
    ;(window as unknown as { clarity: unknown }).clarity = existing

    initClarity()

    expect((window as unknown as { clarity: unknown }).clarity).toBe(existing)
  })
})

describe('CLARITY_MASK', () => {
  /**
   * 🔴 `data-clarity-mask="false"` 는 **효과가 없다** (Microsoft 문서).
   * 해제는 `data-clarity-unmask` 로만 되므로, 값이 문자열 `'true'` 인지 못 박아
   * boolean `true` 로 바뀌어 속성이 사라지는 사고를 막는다.
   */
  it("문자열 'true' 로 마스킹 속성을 준다", () => {
    expect(CLARITY_MASK).toEqual({ 'data-clarity-mask': 'true' })
  })
})

/**
 * trackClarityEvent (2026-08-17 · 공고 허브 계측) — 분기 3개를 전부 실행한다.
 * 🔴 핵심 계약: **계측 실패가 기능(외부 이동)을 막으면 안 된다** — 광고 차단기가
 * 스크립트를 막은 환경에서도 클릭은 정상이어야 한다.
 */
describe('trackClarityEvent', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as unknown as { clarity?: unknown }).clarity
  })

  it('프로젝트 ID 미설정 → 완전 no-op (window.clarity 를 건드리지도 않는다)', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', '')
    const spy = vi.fn()
    ;(window as unknown as { clarity?: unknown }).clarity = spy
    trackClarityEvent('jobhub_test')
    expect(spy).not.toHaveBeenCalled()
  })

  it("ID 설정 + clarity 존재 → ('event', 이름) 으로 호출", () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    const spy = vi.fn()
    ;(window as unknown as { clarity?: unknown }).clarity = spy
    trackClarityEvent('jobhub_jobkorea_calendar')
    expect(spy).toHaveBeenCalledWith('event', 'jobhub_jobkorea_calendar')
  })

  it('🔴 clarity 미존재(광고 차단기) → 안 던진다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    expect(() => trackClarityEvent('jobhub_test')).not.toThrow()
  })

  it('🔴 clarity 가 던져도 삼킨다 — 계측 실패 ≠ 기능 실패', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    ;(window as unknown as { clarity?: unknown }).clarity = () => {
      throw new Error('clarity boom')
    }
    expect(() => trackClarityEvent('jobhub_test')).not.toThrow()
  })
})
