/**
 * 말하기 시간 추정 규칙.
 *
 * 🔴 추정식은 **조용히 틀린다** — 숫자가 그럴듯하게 나와서 화면만 보면 알 수 없다.
 * 특히 공백 처리를 빼먹으면 줄바꿈 많은 메모가 실제보다 길게 나온다.
 */
import { describe, expect, it } from 'vitest'
import {
  ANSWER_LONG_SECONDS,
  CHARS_PER_MINUTE,
  estimateSpeakingSeconds,
  formatSpeakingTime,
} from './speakingTime'

describe('estimateSpeakingSeconds', () => {
  it('기준 속도대로 계산한다 — 350자 = 60초', () => {
    expect(estimateSpeakingSeconds('가'.repeat(CHARS_PER_MINUTE))).toBe(60)
  })

  it('빈 값·공백만이면 0 (표시하지 않는다)', () => {
    expect(estimateSpeakingSeconds('')).toBe(0)
    expect(estimateSpeakingSeconds('   \n\n  ')).toBe(0)
  })

  /**
   * 🔴 2026-08-07 회귀 — 공백을 빼고 350 으로 나눠 **25% 짧게** 나오고 있었다.
   *    기준 CPM 이 공백 포함으로 센 값인데 공백을 뺀 것이 원인이다.
   *    자기소개 답변 6건이 실제 78~90초인데 58~68초로 표시돼, "1분 안쪽" 으로 보였다 —
   *    **길이 경고가 정반대로 작동**했다.
   */
  it('🔴 공백을 센다 — 빼면 25% 짧게 나온다', () => {
    const withSpaces = '가 나 다 라 마 바 사 아 자 차' // 19자 (공백 9)
    expect(estimateSpeakingSeconds(withSpaces)).toBe(
      Math.round((19 / CHARS_PER_MINUTE) * 60),
    )
  })

  it('🔴 "1분 자기소개 원고 350자" 관용과 정확히 맞는다', () => {
    // 이 교차검증이 기준값의 유일한 앵커다
    expect(estimateSpeakingSeconds('가'.repeat(350))).toBe(60)
  })

  it('연속 공백·줄바꿈은 1자로 접는다 — 줄바꿈 많은 메모가 부풀지 않게', () => {
    expect(estimateSpeakingSeconds('가\n\n\n나')).toBe(
      estimateSpeakingSeconds('가 나'),
    )
  })

  it('1분 자기소개 분량(약 300자)은 45~55초 구간', () => {
    const sec = estimateSpeakingSeconds('가'.repeat(300))
    expect(sec).toBeGreaterThanOrEqual(45)
    expect(sec).toBeLessThanOrEqual(55)
  })

  it('🔴 실측 답변으로 검증 — 440자 자기소개는 1분을 넘는다', () => {
    // 감사에서 나온 실제 답변 길이. 이전 계산은 58초라 경고가 안 떴다.
    expect(estimateSpeakingSeconds('가'.repeat(440))).toBeGreaterThan(60)
  })

  it('🔴 800자는 "여유로워 보이지만" 2분이 넘는다 — 이 기능의 존재 이유', () => {
    expect(estimateSpeakingSeconds('가'.repeat(800))).toBeGreaterThan(120)
  })

  it('경고 기준(90초)은 약 525자 — 면접 답변 상한으로 상식적이다', () => {
    expect(estimateSpeakingSeconds('가'.repeat(520))).toBeLessThanOrEqual(
      ANSWER_LONG_SECONDS,
    )
    expect(estimateSpeakingSeconds('가'.repeat(530))).toBeGreaterThan(
      ANSWER_LONG_SECONDS,
    )
  })

  it('길이 경고 기준(90초)을 넘는 지점이 상식적이다', () => {
    // 90초 ≈ 525자. 그 아래는 경고 없음, 위는 경고
    expect(estimateSpeakingSeconds('가'.repeat(500))).toBeLessThanOrEqual(
      ANSWER_LONG_SECONDS,
    )
    expect(estimateSpeakingSeconds('가'.repeat(600))).toBeGreaterThan(
      ANSWER_LONG_SECONDS,
    )
  })
})

describe('formatSpeakingTime', () => {
  it.each([
    [0, ''],
    [-5, ''],
    [48, '48초'],
    [59, '59초'],
    [60, '1분'],
    [72, '1분 12초'],
    [120, '2분'],
    [125, '2분 5초'],
  ])('%i초 → "%s"', (sec, expected) => {
    expect(formatSpeakingTime(sec)).toBe(expected)
  })
})
