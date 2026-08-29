import { describe, it, expect } from 'vitest'
import {
  JOB_CATEGORIES,
  JOB_CATEGORY_ICON,
  JOB_CATEGORY_COLOR,
  parseTags,
  serializeTags,
  getAvatarColor,
} from './tags'
import { JOB_SERIES } from './jobRole'

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

  describe('JOB_CATEGORY_ICON / COLOR', () => {
    it('모든 JOB_CATEGORIES에 대한 lucide 아이콘 정의 (기능 아이콘 정책)', () => {
      JOB_CATEGORIES.forEach((cat) => {
        expect(JOB_CATEGORY_ICON[cat]).toBeDefined()
        // 이모지 문자열이 아니라 lucide 컴포넌트여야 함 (아이콘 정책 회귀 방지)
        expect(typeof JOB_CATEGORY_ICON[cat]).not.toBe('string')
        expect(JOB_CATEGORY_ICON[cat]).toHaveProperty('render')
      })
    })

    it('모든 JOB_CATEGORIES에 대한 컬러 클래스 정의', () => {
      JOB_CATEGORIES.forEach((cat) => {
        expect(JOB_CATEGORY_COLOR[cat]).toBeDefined()
      })
    })

    /**
     * 🔴 **드리프트 가드** — 카드의 `jobCategory` 는 이제 계열 라벨(`JOB_SERIES[].label`)이다.
     * 여기 키가 없으면 그 태그는 조용히 「기타」 회색으로 렌더된다 (에러도 경고도 없다).
     * 계열 라벨을 바꾸면 이 spec 이 먼저 깨진다.
     */
    it('🔴 14계열 라벨도 전부 아이콘·컬러가 있다 (없으면 「기타」로 조용히 떨어진다)', () => {
      expect(JOB_SERIES).toHaveLength(14)
      JOB_SERIES.forEach((s) => {
        expect(JOB_CATEGORY_ICON[s.label]).toBeDefined()
        expect(typeof JOB_CATEGORY_ICON[s.label]).not.toBe('string')
        expect(JOB_CATEGORY_COLOR[s.label]).toBeDefined()
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

    it('공백만 있는 문자열 → 빈 배열', () => {
      expect(parseTags('   ')).toEqual([])
    })

    it('공백으로만 이루어진 항목은 필터링', () => {
      expect(parseTags('IT개발, ,디자인')).toEqual(['IT개발', '디자인'])
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
      // W2 — bg-xxx-600/700 text-white 형식 (다크/라이트 모두 식별 강함)
      expect(result).toMatch(/^bg-[a-z]+-(600|700) text-white$/)
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
