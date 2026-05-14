import { describe, it, expect } from 'vitest'
import { getInquiryTemplate, TEMPLATED_CATEGORIES } from './inquiryTemplates'

const ALL_CATEGORIES = ['버그 신고', '기능 추가 요청', '기능 개선', '알림 문의', '계정·개인정보', '사용 방법 문의', '기타']

describe('getInquiryTemplate', () => {
  describe('템플릿 있는 카테고리 (4종)', () => {
    it('버그 신고 → 골격 문자열 반환', () => {
      const result = getInquiryTemplate('버그 신고')
      expect(typeof result).toBe('string')
      expect(result!.length).toBeGreaterThan(0)
    })

    it('기능 추가 요청 → 골격 문자열 반환', () => {
      const result = getInquiryTemplate('기능 추가 요청')
      expect(typeof result).toBe('string')
      expect(result!.length).toBeGreaterThan(0)
    })

    it('기능 개선 → 골격 문자열 반환', () => {
      const result = getInquiryTemplate('기능 개선')
      expect(typeof result).toBe('string')
      expect(result!.length).toBeGreaterThan(0)
    })

    it('계정·개인정보 → 골격 문자열 반환', () => {
      const result = getInquiryTemplate('계정·개인정보')
      expect(typeof result).toBe('string')
      expect(result!.length).toBeGreaterThan(0)
    })
  })

  describe('템플릿 없는 카테고리 (3종)', () => {
    it('알림 문의 → null 반환', () => {
      expect(getInquiryTemplate('알림 문의')).toBeNull()
    })

    it('사용 방법 문의 → null 반환', () => {
      expect(getInquiryTemplate('사용 방법 문의')).toBeNull()
    })

    it('기타 → null 반환', () => {
      expect(getInquiryTemplate('기타')).toBeNull()
    })
  })

  describe('빈 값 / 미선택', () => {
    it('빈 문자열 → null 반환', () => {
      expect(getInquiryTemplate('')).toBeNull()
    })
  })

  describe('골격 내용 검증', () => {
    it('버그 신고 골격에 발생 화면 항목 포함', () => {
      expect(getInquiryTemplate('버그 신고')).toContain('발생 화면')
    })

    it('버그 신고 골격에 재현 절차 항목 포함', () => {
      expect(getInquiryTemplate('버그 신고')).toContain('재현 절차')
    })

    it('계정·개인정보 골격에 카카오 이메일 항목 없음', () => {
      const template = getInquiryTemplate('계정·개인정보')
      expect(template).not.toContain('카카오 이메일')
      expect(template).not.toContain('이메일')
    })

    it('기능 추가 요청 골격에 원하는 기능 항목 포함', () => {
      expect(getInquiryTemplate('기능 추가 요청')).toContain('원하는 기능')
    })
  })

  describe('TEMPLATED_CATEGORIES 상수', () => {
    it('4개 카테고리 포함', () => {
      expect(TEMPLATED_CATEGORIES).toHaveLength(4)
    })

    it('버그 신고 포함', () => {
      expect(TEMPLATED_CATEGORIES).toContain('버그 신고')
    })

    it('알림 문의 미포함', () => {
      expect(TEMPLATED_CATEGORIES).not.toContain('알림 문의')
    })

    it('모든 TEMPLATED_CATEGORIES 항목이 getInquiryTemplate에서 null 아닌 값 반환', () => {
      TEMPLATED_CATEGORIES.forEach((cat) => {
        expect(getInquiryTemplate(cat)).not.toBeNull()
      })
    })

    it('TEMPLATED_CATEGORIES 외 카테고리는 모두 null 반환', () => {
      ALL_CATEGORIES
        .filter((cat) => !TEMPLATED_CATEGORIES.includes(cat))
        .forEach((cat) => {
          expect(getInquiryTemplate(cat)).toBeNull()
        })
    })
  })
})
