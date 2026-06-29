/**
 * inputStyles 상수 검증 — 표준 토큰 포함 + 다크 전제 패턴 0건.
 */
import { describe, expect, it } from 'vitest'
import {
  INPUT_BASE,
  INPUT_BASE_SM,
  SELECT_BASE,
  SELECT_BASE_SM,
  TEXTAREA_BASE,
} from './inputStyles'

const STANDARD_TOKENS = [
  'bg-input', // 컨테이너보다 다크는 밝게·라이트는 어둡게 (CSS 변수 자동 대응)
  'border-line',
  'focus:border-brand/50',
  'focus:ring-1',
  'focus:ring-brand/20',
  'text-text-primary',
  'placeholder:text-text-tertiary',
  'transition-all',
] as const

const BANNED_DARK_ONLY_PATTERNS = [
  /\btext-white\b/,
  /\bbg-white\b/,
  /\bborder-white\b/,
  /\bdivide-white\b/,
]

describe('inputStyles', () => {
  describe.each([
    ['INPUT_BASE', INPUT_BASE],
    ['INPUT_BASE_SM', INPUT_BASE_SM],
    ['TEXTAREA_BASE', TEXTAREA_BASE],
    ['SELECT_BASE', SELECT_BASE],
    ['SELECT_BASE_SM', SELECT_BASE_SM],
  ])('%s', (_name, cls) => {
    it.each(STANDARD_TOKENS)('표준 토큰 포함: %s', (token) => {
      expect(cls).toContain(token)
    })

    it('다크 전제 패턴 (text-white·bg-white 등) 0건', () => {
      for (const pattern of BANNED_DARK_ONLY_PATTERNS) {
        expect(cls).not.toMatch(pattern)
      }
    })
  })

  it('SELECT_BASE — appearance-none + pr-9 (커스텀 chevron 공간)', () => {
    expect(SELECT_BASE).toContain('appearance-none')
    expect(SELECT_BASE).toContain('pr-9')
  })

  it('TEXTAREA_BASE — resize-y (수직 resize 만)', () => {
    expect(TEXTAREA_BASE).toContain('resize-y')
  })

  it('SM 변종 — text-xs (작은 사이즈)', () => {
    expect(INPUT_BASE_SM).toContain('text-xs')
    expect(SELECT_BASE_SM).toContain('text-xs')
  })
})
