/**
 * 투어 내용 사전 (`plans/app-tour.md` v2).
 *
 * 🔴 이 사전이 비거나 토큰이 안 풀리면 **화면에 그대로 나온다** — 「{company}에 지원한」이
 * 사용자 눈에 보이는 결함이다. 그런데 계열이 14벌 + 오버라이드라 눈으로는 절대 못 본다.
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *  1. 14계열이 전부 있고 키가 하나도 안 빠졌다
 *  2. 배열 길이가 계약대로다 (초안 3·2 · 점검 3 · 답변 2 · 피드백 2 · 체크리스트 4)
 *  3. 🔴 빈 문자열·공백만인 항목이 없다
 *  4. 세밀 오버라이드(`sales-travel`)가 계열을 이긴다
 *  5. 직무가 다른 계열이면 오버라이드하지 않는다
 *  6. `{company}`·`{job}`·`{step}` 이 전부 치환된다 — **남은 중괄호가 0**
 *  7. `{job}` 이 비면 계열 대표 직무로 떨어진다 (빈칸을 남기지 않는다)
 *  8. 모르는 계열 → 폴백 (던지지 않는다)
 */
import { describe, expect, it } from 'vitest'
import {
  FINE_TOUR_COPY,
  TOUR_COPY,
  fillTourCopy,
  fillTourCopyAll,
  getTourCopy,
  type TourCopy,
} from './tourCopy'
import { JOB_SERIES } from '@/utils/jobRole'

const ALL: [string, TourCopy][] = [
  ...Object.entries(TOUR_COPY),
  ...Object.entries(FINE_TOUR_COPY),
]

/** 사전 한 벌이 화면에 내보내는 **모든 문장** — 빈칸 검사의 대상 */
function allStrings(c: TourCopy): string[] {
  return [
    c.job,
    c.coverletter.q1,
    ...c.coverletter.draft1,
    ...c.coverletter.checks,
    c.coverletter.summary1,
    c.coverletter.q2,
    ...c.coverletter.draft2,
    c.interview.q1,
    ...c.interview.answer1,
    c.interview.q2,
    ...c.interview.feedback,
    c.note.title,
    ...c.note.checklist,
    c.note.imageLabel,
  ]
}

describe('tourCopy', () => {
  it('1) 🔴 14계열이 전부 있다 (JOB_SERIES 와 정확히 일치)', () => {
    const seriesIds = JOB_SERIES.map((s) => s.id).sort()
    expect(Object.keys(TOUR_COPY).sort()).toEqual(seriesIds)
  })

  it.each(ALL)('2) %s — 배열 길이가 계약대로다', (_id, copy) => {
    expect(copy.coverletter.draft1).toHaveLength(3)
    expect(copy.coverletter.draft2).toHaveLength(2)
    expect(copy.coverletter.checks).toHaveLength(3)
    expect(copy.interview.answer1).toHaveLength(2)
    expect(copy.interview.feedback).toHaveLength(2)
    expect(copy.note.checklist).toHaveLength(4)
  })

  it.each(ALL)('3) 🔴 %s — 빈 문자열이 하나도 없다', (_id, copy) => {
    for (const s of allStrings(copy)) {
      expect(s.trim().length).toBeGreaterThan(0)
    }
  })

  /**
   * 🔴 문장이 너무 짧으면 「예시」로 읽힌다. v1 이 정확히 그랬다 (「지원 동기를 말해 주세요」).
   * 초안·답변은 실제로 쓸 법한 길이여야 한다.
   */
  it.each(ALL)('3-b) %s — 초안·답변이 한 줄 이상의 밀도를 갖는다', (_id, copy) => {
    for (const line of [...copy.coverletter.draft1, ...copy.interview.answer1]) {
      expect(line.length).toBeGreaterThanOrEqual(20)
    }
  })

  it('4) 🔴 세밀 오버라이드가 계열을 이긴다 (승무원 → sales-travel)', () => {
    const copy = getTourCopy('sales', '승무원')
    expect(copy).toBe(FINE_TOUR_COPY['sales-travel'])
    expect(copy.job).toBe('승무원')
  })

  it('4-b) 직무가 없으면 계열 사전', () => {
    expect(getTourCopy('sales', null)).toBe(TOUR_COPY.sales)
  })

  it('5) 직무의 계열과 고른 계열이 다르면 오버라이드하지 않는다', () => {
    // 「승무원」을 쳤지만 계열을 IT 로 바꿨다 — 화면이 IT 라면 사전도 IT 여야 한다
    expect(getTourCopy('it', '승무원')).toBe(TOUR_COPY.it)
  })

  it('6) 🔴 치환 후 남은 중괄호가 없다 (전 계열 · 전 문장)', () => {
    for (const [, copy] of ALL) {
      const filled = fillTourCopyAll(allStrings(copy), { company: '대한항공' }, copy)
      for (const s of filled) {
        expect(s).not.toMatch(/[{}]/)
      }
    }
  })

  it('6-b) 토큰 3종이 실제 값으로 바뀐다', () => {
    const copy = TOUR_COPY.it
    const out = fillTourCopy('{company} {job} {step}', {
      company: '카카오',
      job: '백엔드',
      step: '1차 기술면접',
    }, copy)
    expect(out).toBe('카카오 백엔드 1차 기술면접')
  })

  it('7) 🔴 job 이 비면 계열 대표 직무로 떨어진다 (빈칸을 남기지 않는다)', () => {
    const copy = TOUR_COPY.health
    expect(fillTourCopy('{job}', { company: 'x', job: '   ' }, copy)).toBe('간호사')
    expect(fillTourCopy('{job}', { company: 'x' }, copy)).toBe('간호사')
  })

  it('7-b) step 이 비면 1차 면접으로 떨어진다', () => {
    expect(fillTourCopy('{step}', { company: 'x' }, TOUR_COPY.it)).toBe('1차 면접')
  })

  it('8) 모르는 계열 → 폴백 (던지지 않는다)', () => {
    expect(getTourCopy('nope', null)).toBe(TOUR_COPY.it)
    expect(getTourCopy(null, null)).toBe(TOUR_COPY.it)
    expect(getTourCopy(undefined, undefined)).toBe(TOUR_COPY.it)
  })

  // 프로토타입 오염 — 서버·URL 이 아니라 사용자 프로필에서 오는 값이라 도달은 어렵지만
  // 한 줄로 막을 수 있는 것을 신뢰에 맡기지 않는다 (`OpsReach.stageStyle` 과 같은 이유)
  it('8-b) `constructor` 같은 계열 id 도 폴백으로 간다', () => {
    expect(getTourCopy('constructor', null)).toBe(TOUR_COPY.it)
    expect(getTourCopy('__proto__', null)).toBe(TOUR_COPY.it)
  })
})
