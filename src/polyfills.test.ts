import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUIDFallback } from '@/polyfills'

/**
 * `crypto.randomUUID` 폴리필 — **손으로 짠 구현이라 테스트한다.**
 * (core-js 로 채운 나머지는 라이브러리 자체 test262 커버리지가 있어 대상이 아니다.)
 *
 * Safari 15.4 미만에 randomUUID 가 없어 토스트 시스템이 통째로 죽었다 (CHWIPPO-FRONT-9).
 *
 * 케이스:
 *  1. UUID v4 형식 — 8-4-4-4-12 소문자 hex
 *  2. version nibble = '4'
 *  3. variant nibble ∈ [89ab]
 *  4. 1,000회 호출 전부 상이 (id 충돌 없음 — 토스트 key 로 쓰인다)
 *  5. 비트 마스킹 결정적 검증 · 상한 — 난수가 전부 0xff 여도 version·variant 는 고정
 *  6. 비트 마스킹 결정적 검증 · 하한 — 난수가 전부 0x00 이어도 version·variant 는 고정
 *
 * ⚠️ **설치 분기(`crypto.randomUUID` 가 없을 때만 할당)는 여기서 테스트할 수 없다.**
 * jsdom(Node 22)은 네이티브 `randomUUID` 를 이미 갖고 있어 분기가 항상 거짓이고,
 * 전역 `crypto` 를 지웠다 되돌리는 건 다른 spec 까지 오염시킨다.
 * 그래서 구현 함수를 export 해 **함수만** 직접 검증한다.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** getRandomValues 를 고정 바이트로 대체 — 비트 연산을 결정적으로 확인하기 위함 */
function stubRandomBytes(fill: number) {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(
    <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint8Array) array.fill(fill)
      return array
    },
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('randomUUIDFallback', () => {
  it('1. UUID v4 형식 (8-4-4-4-12 소문자 hex)', () => {
    expect(randomUUIDFallback()).toMatch(UUID_V4)
  })

  it('2·3. version nibble = 4 · variant nibble ∈ [89ab]', () => {
    for (let i = 0; i < 100; i++) {
      const uuid = randomUUIDFallback()
      expect(uuid[14]).toBe('4')
      expect('89ab').toContain(uuid[19])
    }
  })

  it('4. 1,000회 호출 전부 상이', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(randomUUIDFallback())
    expect(seen.size).toBe(1000)
  })

  it('5. 난수가 전부 0xff 여도 version·variant 비트는 고정 (상한)', () => {
    stubRandomBytes(0xff)
    // 7번째 바이트 0xff → 0x4f · 9번째 바이트 0xff → 0xbf, 나머지는 그대로 보존
    expect(randomUUIDFallback()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('6. 난수가 전부 0x00 이어도 version·variant 비트는 고정 (하한)', () => {
    stubRandomBytes(0x00)
    // 7번째 바이트 0x00 → 0x40 · 9번째 바이트 0x00 → 0x80
    expect(randomUUIDFallback()).toBe('00000000-0000-4000-8000-000000000000')
  })
})
