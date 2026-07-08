import { describe, expect, it } from 'vitest'
import { countFillPlaceholders } from './coverletterPlaceholder'

describe('countFillPlaceholders', () => {
  it('빈 문자열 → 0곳', () => {
    expect(countFillPlaceholders('')).toBe(0)
  })

  it('placeholder 없음 → 0곳', () => {
    expect(countFillPlaceholders('저는 협업을 통해 성장했습니다.')).toBe(0)
  })

  it('placeholder 1곳', () => {
    expect(
      countFillPlaceholders('저는 [본인 경험 채우기: 구체적 사례] 경험이 있습니다.'),
    ).toBe(1)
  })

  it('placeholder 2곳', () => {
    expect(
      countFillPlaceholders(
        '[본인 경험 채우기: 도전] 그리고 [본인 경험 채우기: 결과] 를 얻었습니다.',
      ),
    ).toBe(2)
  })

  it('유사하지만 다른 대괄호(예: [소제목])는 미매칭', () => {
    expect(countFillPlaceholders('[소제목] 협업 경험 [강조]')).toBe(0)
  })
})
