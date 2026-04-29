import { describe, it, expect } from 'vitest'
import {
  JOB_CATEGORIES,
  JOB_CATEGORY_EMOJI,
  JOB_CATEGORY_COLOR,
  parseTags,
  serializeTags,
  getAvatarColor,
} from './tags'

describe('tags utils', () => {
  describe('JOB_CATEGORIES', () => {
    it('8개 카테고리 정의', () => {
      expect(JOB_CATEGORIES).toHaveLength(8)
    })

    it('"기타" 포함', () => {
      expect(JOB_CATEGORIES).toContain('기타')
    })

    it('"IT개발" 포함', () => {
      expect(JOB_CATEGORIES).toContain('IT개발')
    })
  })

  describe('JOB_CATEGORY_EMOJI / COLOR', () => {
    it('모든 JOB_CATEGORIES에 대한 이모지 정의', () => {
      JOB_CATEGORIES.forEach((cat) => {
        expect(JOB_CATEGORY_EMOJI[cat]).toBeDefined()
      })
    })

    it('모든 JOB_CATEGORIES에 대한 컬러 클래스 정의', () => {
      JOB_CATEGORIES.forEach((cat) => {
        expect(JOB_CATEGORY_COLOR[cat]).toBeDefined()
      })
    })
  })

  describe('parseTags', () => {
    it('null → 빈 배열', () => {
      expect(parseTags(null)).toEqual([])
    })

    it('빈 문자열 → 빈 배열', () => {
      expect(parseTags('')).toEqual([])
    })

    it('단일 태그 → 배열 1개', () => {
      expect(parseTags('IT개발')).toEqual(['IT개발'])
    })

    it('콤마 구분 → 배열로 분리', () => {
      expect(parseTags('IT개발,디자인')).toEqual(['IT개발', '디자인'])
    })

    it('앞뒤 공백 trim', () => {
      expect(parseTags(' IT개발 , 디자인 ')).toEqual(['IT개발', '디자인'])
    })

    it('빈 항목 제거', () => {
      expect(parseTags('IT개발,,디자인')).toEqual(['IT개발', '디자인'])
    })
  })

  describe('serializeTags', () => {
    it('배열 → 콤마 구분 문자열', () => {
      expect(serializeTags(['IT개발', '디자인'])).toBe('IT개발,디자인')
    })

    it('빈 배열 → 빈 문자열', () => {
      expect(serializeTags([])).toBe('')
    })

    it('단일 항목 → 그대로', () => {
      expect(serializeTags(['IT개발'])).toBe('IT개발')
    })

    it('parseTags(serializeTags([...])) 왕복 변환 일치', () => {
      const tags = ['IT개발', '마케팅', '기타']
      expect(parseTags(serializeTags(tags))).toEqual(tags)
    })
  })

  describe('getAvatarColor', () => {
    it('문자열 입력 → AVATAR_COLORS 중 하나 반환', () => {
      const result = getAvatarColor('카카오')
      // bg-xxx-500/15 text-xxx-400 형식
      expect(result).toMatch(/^bg-.+\/15 text-.+$/)
    })

    it('같은 회사명 → 항상 같은 컬러 반환 (결정론적)', () => {
      expect(getAvatarColor('네이버')).toBe(getAvatarColor('네이버'))
      expect(getAvatarColor('카카오')).toBe(getAvatarColor('카카오'))
    })

    it('다른 회사명 → 다를 수 있음 (해시 분산)', () => {
      // 모든 케이스가 다르다는 보장은 없지만 여러 값이 분포되어야 함
      const results = new Set(['카카오', '네이버', '토스', '라인', '당근', '배민', '쿠팡', '직방', '야놀자', '무신사'].map(getAvatarColor))
      expect(results.size).toBeGreaterThan(1)
    })

    it('빈 문자열도 오류 없이 처리', () => {
      expect(() => getAvatarColor('')).not.toThrow()
    })
  })
})
