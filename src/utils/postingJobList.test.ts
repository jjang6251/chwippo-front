/**
 * 직무 후보 목록 만들기.
 *
 * ## 케이스 목록
 *
 * **묶음**
 *  1. 같은 접두어 2개 이상 → 소제목 + 들여쓴 줄(괄호 안만)
 *  2. 🔴 접두어가 1개뿐이면 묶지 않는다 (줄 하나짜리 소제목은 정보가 0이다)
 *  3. 괄호가 없는 후보는 원문 그대로 한 줄
 *  4. 묶음은 **첫 멤버가 나온 자리**에 선다 (원래 순서 보존)
 *  5. 「(」 로 시작하거나 괄호가 비면 묶음 후보가 아니다
 *
 * **위생**
 *  6. 빈 문자열·공백·중복 제거
 *  7. 후보가 0개면 빈 목록
 *
 * **가까운 직무 배지**
 *  8. 내 희망 직무와 **같은 계열이 정확히 하나**면 배지
 *  9. 🔴 둘 이상 걸리면 아무에게도 안 붙인다 (고른 것처럼 보이면 안 된다)
 * 10. 희망 직무가 없거나 분류에 실패하면 배지 없음
 * 11. 배지가 든 블록이 맨 위로 온다 — 묶음이면 **소제목째** 올라간다
 *
 * **인라인/시트 분기**
 * 12. ≤3 은 카드 안, ≥4 는 시트
 */
import { describe, expect, it } from 'vitest'
import {
  buildJobCandidateList,
  findCloseMatch,
  shouldPickInSheet,
  type JobCandidateEntry,
  type JobCandidateRow,
} from './postingJobList'

const rows = (entries: JobCandidateEntry[]): JobCandidateRow[] =>
  entries.filter((e): e is JobCandidateRow => e.kind === 'item')
const shape = (entries: JobCandidateEntry[]) =>
  entries.map((e) => (e.kind === 'group' ? `# ${e.label}` : `${e.indented ? '  ' : ''}${e.label}`))

describe('묶음', () => {
  it('1) 같은 접두어 2개 이상 → 소제목 + 괄호 안만', () => {
    const out = buildJobCandidateList(['사무영업(일반)', '사무영업(IT)'])
    expect(shape(out)).toEqual(['# 사무영업', '  일반', '  IT'])
    // 저장되는 값은 언제나 공고 표기 원문이다
    expect(rows(out).map((r) => r.value)).toEqual(['사무영업(일반)', '사무영업(IT)'])
  })

  it('2) 🔴 접두어가 하나뿐이면 묶지 않는다', () => {
    const out = buildJobCandidateList(['열차승무(일반)', '운전(전동차)'])
    expect(shape(out)).toEqual(['열차승무(일반)', '운전(전동차)'])
  })

  it('3) 괄호 없는 후보는 원문 그대로', () => {
    const out = buildJobCandidateList(['브랜드 마케터', 'MD'])
    expect(shape(out)).toEqual(['브랜드 마케터', 'MD'])
  })

  it('4) 묶음은 첫 멤버 자리에 서고 나머지 순서는 그대로다', () => {
    const out = buildJobCandidateList([
      '사무영업(일반)',
      '열차승무(일반)',
      '사무영업(IT)',
      '차량(기계)',
      '차량(전기)',
    ])
    expect(shape(out)).toEqual([
      '# 사무영업',
      '  일반',
      '  IT',
      '열차승무(일반)',
      '# 차량',
      '  기계',
      '  전기',
    ])
  })

  it('5) 괄호가 앞에 있거나 비어 있으면 묶음 후보가 아니다', () => {
    const out = buildJobCandidateList(['(신입)', '(경력)', '사무()', '사무(IT)'])
    expect(out.every((e) => e.kind === 'item')).toBe(true)
  })
})

describe('위생', () => {
  it('6) 빈 문자열·공백·중복은 버린다', () => {
    const out = buildJobCandidateList(['  ', 'MD', 'MD', ' MD ', ''])
    expect(shape(out)).toEqual(['MD'])
  })

  it('7) 후보가 없으면 빈 목록', () => {
    expect(buildJobCandidateList([])).toEqual([])
  })
})

describe('가까운 직무 배지', () => {
  it('8) 같은 계열이 정확히 하나면 배지', () => {
    expect(findCloseMatch(['간호사', '브랜드 마케터'], '간호사')).toBe('간호사')
  })

  it('9) 🔴 둘 이상이 같은 계열이면 아무에게도 안 붙인다', () => {
    expect(findCloseMatch(['간호사', '간호조무사'], '간호사')).toBeNull()
  })

  it('10) 희망 직무가 없거나 분류에 실패하면 배지 없음', () => {
    expect(findCloseMatch(['간호사'], null)).toBeNull()
    expect(findCloseMatch(['간호사'], '   ')).toBeNull()
    expect(findCloseMatch(['간호사'], 'zzzz알수없는말')).toBeNull()
  })

  it('11) 배지가 든 블록이 맨 위로 — 묶음이면 소제목째 올라간다', () => {
    const out = buildJobCandidateList(
      ['브랜드 마케터', '채용(간호사)', '채용(회계사)'],
      '간호사',
    )
    // 묶음 안 후보 하나만 계열이 맞았다 → 「채용」 소제목째 맨 위로 (라벨 맥락 보존)
    expect(shape(out)).toEqual(['# 채용', '  간호사', '  회계사', '브랜드 마케터'])
    expect(rows(out).find((r) => r.closeMatch)?.value).toBe('채용(간호사)')
  })

  it('11-b) 묶이지 않은 후보면 그 줄만 맨 위로', () => {
    const out = buildJobCandidateList(['브랜드 마케터', 'MD', '간호사'], '간호사')
    expect(shape(out)[0]).toBe('간호사')
    expect(rows(out)[0].closeMatch).toBe(true)
  })
})

describe('인라인 / 시트 분기', () => {
  it('12) 3개 이하는 카드 안, 4개부터 시트', () => {
    expect(shouldPickInSheet(['a', 'b', 'c'])).toBe(false)
    expect(shouldPickInSheet(['a', 'b', 'c', 'd'])).toBe(true)
  })
})
