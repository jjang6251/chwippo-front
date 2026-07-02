import { describe, it, expect } from 'vitest'
import { resolvePostLoginDestination, parseNeedsTerms } from './authRouting'

// ── resolvePostLoginDestination ──────────────────────────────────────────────

describe('resolvePostLoginDestination', () => {
  describe('→ /terms-agreement (약관 미동의)', () => {
    it('termsAgreedAt = null → /terms-agreement', () => {
      expect(resolvePostLoginDestination(null)).toBe('/terms-agreement')
    })

    it('termsAgreedAt = undefined → /terms-agreement', () => {
      expect(resolvePostLoginDestination(undefined)).toBe('/terms-agreement')
    })

    it('termsAgreedAt = 빈 문자열 → /terms-agreement (falsy 처리)', () => {
      expect(resolvePostLoginDestination('')).toBe('/terms-agreement')
    })
  })

  describe('→ /calendar (약관 동의 완료)', () => {
    it('termsAgreedAt = ISO 날짜 문자열 → /calendar', () => {
      expect(resolvePostLoginDestination('2025-05-14T10:00:00.000Z')).toBe('/calendar')
    })

    it('termsAgreedAt = 임의 non-empty 문자열 → /calendar', () => {
      expect(resolvePostLoginDestination('some-date')).toBe('/calendar')
    })
  })

  describe('반환 타입 보장', () => {
    it('null 입력 → 정확히 "/terms-agreement" 문자열', () => {
      const result = resolvePostLoginDestination(null)
      expect(result).toStrictEqual('/terms-agreement')
    })

    it('날짜 입력 → 정확히 "/calendar" 문자열', () => {
      const result = resolvePostLoginDestination('2025-01-01T00:00:00.000Z')
      expect(result).toStrictEqual('/calendar')
    })
  })
})

// ── parseNeedsTerms ──────────────────────────────────────────────────────────

describe('parseNeedsTerms', () => {
  describe('약관 동의 필요 (true 반환)', () => {
    it('"true" → true (신규 가입 / termsAgreedAt=null)', () => {
      expect(parseNeedsTerms('true')).toBe(true)
    })
  })

  describe('약관 동의 불필요 (false 반환)', () => {
    it('"false" → false (기존 동의 완료 유저)', () => {
      expect(parseNeedsTerms('false')).toBe(false)
    })

    it('null → false (파라미터 누락)', () => {
      expect(parseNeedsTerms(null)).toBe(false)
    })

    it('빈 문자열 → false', () => {
      expect(parseNeedsTerms('')).toBe(false)
    })

    it('"TRUE" (대문자) → false (대소문자 구분)', () => {
      // 백엔드는 String(boolean)으로 소문자 "true"/"false" 직렬화
      expect(parseNeedsTerms('TRUE')).toBe(false)
    })

    it('"1" → false (숫자 문자열은 인식 안 함)', () => {
      expect(parseNeedsTerms('1')).toBe(false)
    })
  })

  describe('백엔드 직렬화 왕복 검증', () => {
    it('termsAgreedAt=null → needs_terms="true" → parseNeedsTerms=true', () => {
      const termsAgreedAt: string | null = null
      const param = String(!termsAgreedAt)          // 백엔드: String(!null) = "true"
      expect(parseNeedsTerms(param)).toBe(true)
    })

    it('termsAgreedAt=날짜 → needs_terms="false" → parseNeedsTerms=false', () => {
      const termsAgreedAt = '2025-05-14T10:00:00.000Z'
      const param = String(!termsAgreedAt)           // 백엔드: String(!string) = "false"
      expect(parseNeedsTerms(param)).toBe(false)
    })
  })

  describe('parseNeedsTerms + resolvePostLoginDestination 통합 시나리오', () => {
    it('신규 가입 → needs_terms=true → resolvePostLoginDestination(null) = /terms-agreement', () => {
      // LoginCallback: needs_terms=true 이면 termsAgreedAt=null로 user 셋팅 안 됨
      expect(parseNeedsTerms('true')).toBe(true)
      expect(resolvePostLoginDestination(null)).toBe('/terms-agreement')
    })

    it('기존 유저 → needs_terms=false → resolvePostLoginDestination(date) = /calendar', () => {
      const termsAgreedAt = '2025-05-14T10:00:00.000Z'
      expect(parseNeedsTerms('false')).toBe(false)
      expect(resolvePostLoginDestination(termsAgreedAt)).toBe('/calendar')
    })

    it('약관 거부 후 재로그인 → needs_terms=true → /terms-agreement 재표시', () => {
      // 유저가 약관 거부 → logout (계정 유지, termsAgreedAt=null) → 재로그인
      // 백엔드: !user.termsAgreedAt = true → needs_terms="true"
      const param = 'true'
      expect(parseNeedsTerms(param)).toBe(true)
      expect(resolvePostLoginDestination(null)).toBe('/terms-agreement')
    })

    it('Landing refresh: termsAgreedAt 있는 유저 → /calendar', () => {
      const userFromRefresh = { termsAgreedAt: '2025-05-14T10:00:00.000Z' }
      expect(resolvePostLoginDestination(userFromRefresh.termsAgreedAt)).toBe('/calendar')
    })

    it('Landing refresh: termsAgreedAt=null 유저 → /terms-agreement', () => {
      const userFromRefresh = { termsAgreedAt: null as string | null }
      expect(resolvePostLoginDestination(userFromRefresh.termsAgreedAt)).toBe('/terms-agreement')
    })
  })
})
