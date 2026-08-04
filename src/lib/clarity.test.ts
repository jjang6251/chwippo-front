/**
 * Microsoft Clarity 도입 — **방침보다 먼저 켜지면 안 된다.**
 *
 * 🔴 이 spec 의 존재 이유는 두 가지다:
 *
 * 1. **시행일 전 비활성 보장** — 개인정보처리방침 개정은 2026-08-04 공고 / **08-11 시행**이다.
 *    시행 전에 수집이 시작되면 **고지 없는 수집**이 된다. `VITE_CLARITY_PROJECT_ID` 미설정이면
 *    아무것도 하지 않아야 한다 (Sentry DSN 과 같은 절차).
 * 2. **앱(WebView) 제외** — 네이티브 화면 흐름과 섞이면 해석이 어긋난다.
 *
 * 시나리오: 미설정 · 설정됨 · 앱 · 중복 호출 · 마스킹 상수
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLARITY_MASK, initClarity, isClarityActive } from './clarity'

function cleanup() {
  document.getElementById('clarity-script')?.remove()
  document.documentElement.removeAttribute('data-native')
  delete (window as unknown as { clarity?: unknown }).clarity
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

  it('프로젝트 ID 가 있으면 스크립트를 주입한다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    initClarity()
    const s = document.getElementById('clarity-script') as HTMLScriptElement
    expect(s).not.toBeNull()
    expect(s.src).toContain('clarity.ms/tag/abc123')
    expect(s.async).toBe(true)
  })

  /** 앱은 네이티브 화면 흐름과 섞여 해석이 어긋난다 — 별도 경로가 필요하다 */
  it('앱(WebView)에서는 주입하지 않는다', () => {
    vi.stubEnv('VITE_CLARITY_PROJECT_ID', 'abc123')
    document.documentElement.dataset.native = '1'
    initClarity()
    expect(document.getElementById('clarity-script')).toBeNull()
    expect(isClarityActive()).toBe(false)
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

    expect(w.clarity.q).toEqual([['event', 'testEvent']])
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
