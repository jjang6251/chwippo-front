/**
 * requireEnvs 단위 테스트
 *
 * 시나리오:
 * - 모든 키 채워짐(단일·복수) → no throw
 * - 단일 키 undefined → throw, 메시지에 키 이름
 * - 단일 키 빈 문자열 → throw
 * - 단일 키 공백만 → throw
 * - 복수 키 누락 → 메시지에 모든 키 포함
 * - 빈 keys 배열 → no-op pass
 * - 추가 env 변수 → 무시
 * - 에러 메시지에 ".env 파일을 확인하세요" 포함
 */
import { describe, it, expect } from 'vitest'
import { requireEnvs } from './requireEnvs'

describe('requireEnvs', () => {
  describe('통과', () => {
    it('단일 키, 값 있음 → no throw', () => {
      expect(() =>
        requireEnvs(['VITE_API_URL'], { VITE_API_URL: 'http://localhost:3000' }),
      ).not.toThrow()
    })

    it('복수 키, 모두 값 있음 → no throw', () => {
      expect(() =>
        requireEnvs(['A', 'B', 'C'], { A: '1', B: '2', C: '3' }),
      ).not.toThrow()
    })

    it('빈 keys 배열 → no-op pass', () => {
      expect(() => requireEnvs([], {})).not.toThrow()
    })

    it('keys에 없는 추가 env 변수는 무시', () => {
      expect(() =>
        requireEnvs(['A'], { A: '1', UNRELATED: 'x', EXTRA: 'y' }),
      ).not.toThrow()
    })
  })

  describe('실패', () => {
    it('단일 키 undefined → throw, 메시지에 키 이름 포함', () => {
      expect(() => requireEnvs(['VITE_API_URL'], {})).toThrow(/VITE_API_URL/)
    })

    it('단일 키 빈 문자열 → throw', () => {
      expect(() =>
        requireEnvs(['VITE_API_URL'], { VITE_API_URL: '' }),
      ).toThrow(/VITE_API_URL/)
    })

    it('단일 키 공백만 → throw (trim 처리)', () => {
      expect(() =>
        requireEnvs(['VITE_API_URL'], { VITE_API_URL: '   ' }),
      ).toThrow(/VITE_API_URL/)
    })

    it('복수 키 누락 → 메시지에 모든 누락 키 포함', () => {
      try {
        requireEnvs(['A', 'B', 'C'], { B: '2' })
        throw new Error('expected throw')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        expect(msg).toContain('A')
        expect(msg).toContain('C')
        expect(msg).not.toContain('B,')
      }
    })

    it('에러 메시지에 ".env 파일을 확인하세요" 안내 포함', () => {
      expect(() => requireEnvs(['VITE_API_URL'], {})).toThrow(
        /\.env 파일을 확인하세요/,
      )
    })

    it('일부만 누락 → 누락된 것만 메시지에 포함', () => {
      try {
        requireEnvs(['A', 'B'], { A: 'ok', B: '' })
        throw new Error('expected throw')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        expect(msg).toContain('B')
        expect(msg).not.toContain('A,')
        expect(msg).not.toContain('A.')
      }
    })
  })
})
