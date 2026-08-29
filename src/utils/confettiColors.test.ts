/**
 * 컨페티 색 — **canvas-confetti 가 읽을 수 있는 형식**인지가 전부다.
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 토큰 채널(`130 187 153`) → hex(`#82bb99`)
 *  2. 🔴 `rgb(...)` 문자열을 내보내지 않는다 — 라이브러리 파서가 hex 전용이라
 *     `rgb(130 187 153)` 이 벽돌색(rgb 177,48,24)으로 뭉개진다 (2026-08-29 실발견)
 *  3. 쉼표 구분(`130, 187, 153`)도 받는다
 *  4. 토큰이 비었거나 값이 모자라면 fallback hex
 *  5. 범위 밖 채널은 0~255 로 접는다 (렌더 중 호출이라 던지지 않는다)
 *  6. 다섯 색을 늘 같은 순서로 준다
 */
import { afterEach, describe, expect, it } from 'vitest'
import { confettiColors } from './confettiColors'

const TOKENS = [
  '--brand',
  '--accent',
  '--success',
  '--warning',
  '--text-primary',
] as const

function setTokens(values: Partial<Record<(typeof TOKENS)[number], string>>) {
  for (const [name, value] of Object.entries(values)) {
    document.documentElement.style.setProperty(name, value)
  }
}

afterEach(() => {
  for (const name of TOKENS) document.documentElement.style.removeProperty(name)
})

describe('confettiColors', () => {
  it('1) 토큰 채널을 hex 로 바꾼다', () => {
    setTokens({
      '--brand': '130 187 153',
      '--accent': '247 148 118',
      '--success': '132 187 154',
      '--warning': '212 176 69',
      '--text-primary': '235 233 227',
    })
    expect(confettiColors()).toEqual([
      '#82bb99',
      '#f79476',
      '#84bb9a',
      '#d4b045',
      '#ebe9e3',
    ])
  })

  it('2) 🔴 rgb(...) 문자열을 내보내지 않는다 (라이브러리 파서가 hex 전용)', () => {
    setTokens({ '--brand': '130 187 153' })
    for (const c of confettiColors()) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('3) 쉼표 구분 채널도 받는다', () => {
    setTokens({ '--brand': '54, 102, 78' })
    expect(confettiColors()[0]).toBe('#36664e')
  })

  it('4) 토큰이 없거나 모자라면 fallback (다크 기본값)', () => {
    expect(confettiColors()[0]).toBe('#82bb99')
    setTokens({ '--brand': '130 187' })
    expect(confettiColors()[0]).toBe('#82bb99')
  })

  it('5) 범위 밖 채널은 0~255 로 접는다', () => {
    setTokens({ '--brand': '-20 300 12.6' })
    expect(confettiColors()[0]).toBe('#00ff0d')
  })

  it('6) 다섯 색을 같은 순서로 준다', () => {
    expect(confettiColors()).toHaveLength(5)
  })
})
