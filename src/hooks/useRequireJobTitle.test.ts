/**
 * 직무 게이트 규칙 spec.
 *
 * 🔴 백엔드 `chwippo-back/src/applications/job-text.ts` 의 `resolveJobText` 와
 * **같은 결과**여야 한다. 갈리면 "화면엔 직무가 보이는데 서버가 400" 또는 그 반대가 된다.
 * 백엔드 쪽 회귀는 `job-text.spec.ts` 가 같은 표로 덮는다.
 */
import { describe, expect, it } from 'vitest'
import { resolveJobText } from './useRequireJobTitle'

type Job = { jobTitle: string | null; jobCategory: string | null }

describe('resolveJobText — jobTitle 이 1순위', () => {
  it.each<[Job, string | null]>([
    // dev DB 실제 조합 — 사용자들이 jobCategory 를 **업종**으로 쓴다.
    // `금융` 을 우선하면 백엔드 지원자가 재무 직무로 잡힌다.
    [{ jobTitle: '백엔드 개발자', jobCategory: '금융' }, '백엔드 개발자'],
    [{ jobTitle: '백엔드 개발자', jobCategory: '금융,영업' }, '백엔드 개발자'],
    [{ jobTitle: 'IOS 개발자', jobCategory: '기획·PM,IT개발' }, 'IOS 개발자'],
    [{ jobTitle: '백엔드 개발자', jobCategory: null }, '백엔드 개발자'],
    // jobTitle 이 없거나 공백이면 직군 태그로 내려간다
    [{ jobTitle: null, jobCategory: 'IT개발' }, 'IT개발'],
    [{ jobTitle: '   ', jobCategory: 'IT개발' }, 'IT개발'],
    // 둘 다 없으면 게이트가 뜬다
    [{ jobTitle: null, jobCategory: null }, null],
    [{ jobTitle: '  ', jobCategory: '  ' }, null],
  ])('%o → %s', (app, expected) => {
    expect(resolveJobText(app)).toBe(expected)
  })

  it('카드가 아직 로드되지 않았으면(null·undefined) 직무 없음으로 본다', () => {
    expect(resolveJobText(null)).toBeNull()
    expect(resolveJobText(undefined)).toBeNull()
  })
})
