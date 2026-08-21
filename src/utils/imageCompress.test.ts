/**
 * study-note-media PR-A — 클라 압축 판정 spec (plan §4 「압축」 줄).
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *   크기  1  긴 변이 상한 이하면 원본 그대로 (확대하지 않는다)
 *         2  상한 정확히 = 원본 그대로 (경계)
 *         3  가로가 긴 사진 → 긴 변 1600, 비율 유지
 *         4  세로가 긴 사진 → 긴 변 1600, 비율 유지
 *         5  🔴 극단 비율에서도 0px 이 안 나온다 (toBlob 이 null 을 주는 조건)
 *   알파  6  RGBA(colorType 6)·회색+알파(4) = 알파 있음
 *         7  팔레트(3) = 보수적으로 알파 있음 (tRNS 로 투명해질 수 있다)
 *         8  RGB(2)·회색(0) = 알파 없음
 *         9  PNG 시그니처가 아니면 알파 없음 (jpeg 를 png 로 오독하지 않는다)
 *        10  헤더가 잘린 파일도 던지지 않고 false
 *   포맷 11  🔴 알파가 있으면 원본 타입과 무관하게 png (jpeg 는 투명을 검게 칠한다)
 *        12  webp 는 webp 유지
 *        13  jpeg·HEIC·타입 미상은 jpeg 로 수렴
 *   상한 14  10MB 상수가 서버 계약과 같다
 */
import { describe, expect, it } from 'vitest'
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  fitWithin,
  outputTypeFor,
  pngHasAlpha,
} from './imageCompress'

/** colorType 한 바이트만 다른 최소 PNG 헤더 (26바이트 = IHDR colorType 까지) */
function pngHeader(colorType: number): Uint8Array {
  const bytes = new Uint8Array(26)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes[25] = colorType
  return bytes
}

describe('fitWithin — 긴 변 상한', () => {
  it('1 상한 이하는 원본 그대로 (확대 없음)', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('2 상한 정확히도 원본 그대로 (경계)', () => {
    expect(fitWithin(MAX_IMAGE_EDGE, 900)).toEqual({ width: MAX_IMAGE_EDGE, height: 900 })
  })

  it('3 가로가 긴 사진 — 긴 변이 상한, 비율 유지', () => {
    // 4000×3000 (4:3) → 1600×1200
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })

  it('4 세로가 긴 사진 — 세로를 기준으로 줄인다', () => {
    // 3000×4000 → 1200×1600
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('5 🔴 극단 비율에서도 0px 이 안 나온다', () => {
    // 4000×1 은 비율대로면 높이 0.4 → 반올림 0. 캔버스 0px 은 toBlob 이 null 을 준다
    expect(fitWithin(4000, 1)).toEqual({ width: 1600, height: 1 })
  })
})

describe('pngHasAlpha — 바이트 시그니처 판정', () => {
  it('6 RGBA(6)·회색+알파(4) = 알파 있음', () => {
    expect(pngHasAlpha(pngHeader(6))).toBe(true)
    expect(pngHasAlpha(pngHeader(4))).toBe(true)
  })

  it('7 팔레트(3) = 보수적으로 알파 있음 (tRNS)', () => {
    expect(pngHasAlpha(pngHeader(3))).toBe(true)
  })

  it('8 RGB(2)·회색(0) = 알파 없음', () => {
    expect(pngHasAlpha(pngHeader(2))).toBe(false)
    expect(pngHasAlpha(pngHeader(0))).toBe(false)
  })

  it('9 PNG 시그니처가 아니면 알파 없음', () => {
    // jpeg 시작 바이트(FF D8 FF) — 25번째 바이트가 우연히 6이어도 png 로 읽으면 안 된다
    const jpeg = new Uint8Array(26)
    jpeg.set([0xff, 0xd8, 0xff, 0xe0], 0)
    jpeg[25] = 6
    expect(pngHasAlpha(jpeg)).toBe(false)
  })

  it('10 헤더가 잘려도 던지지 않는다', () => {
    expect(pngHasAlpha(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
    expect(pngHasAlpha(new Uint8Array())).toBe(false)
  })
})

describe('outputTypeFor — 저장 포맷', () => {
  it('11 🔴 알파가 있으면 언제나 png (jpeg 는 투명을 검게 칠한다)', () => {
    expect(outputTypeFor('image/png', true)).toBe('image/png')
    // file.type 이 빈 문자열로 오는 드롭 경로에서도 바이트 판정이 이긴다
    expect(outputTypeFor('', true)).toBe('image/png')
  })

  it('12 webp 는 webp 유지', () => {
    expect(outputTypeFor('image/webp', false)).toBe('image/webp')
  })

  it('13 jpeg·HEIC·타입 미상은 jpeg 로 수렴', () => {
    expect(outputTypeFor('image/jpeg', false)).toBe('image/jpeg')
    expect(outputTypeFor('image/heic', false)).toBe('image/jpeg')
    expect(outputTypeFor('', false)).toBe('image/jpeg')
    // 알파 없는 png 는 jpeg 로 줄인다 (스크린샷이 이 경로다)
    expect(outputTypeFor('image/png', false)).toBe('image/jpeg')
  })
})

describe('상한 상수', () => {
  it('14 10MB — 서버 presigned 발급 상한과 같은 값', () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024)
  })
})
