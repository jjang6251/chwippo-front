import { describe, expect, it } from 'vitest'
import { cleanupCoverletter } from './coverletterCleanup'

const keys = (text: string, limit: number | null = null) =>
  cleanupCoverletter(text, limit).issues.map((i) => i.key).sort()

describe('cleanupCoverletter', () => {
  it('깨끗한 텍스트는 변경·이슈 없음', () => {
    const text = '저는 협업을 중요하게 생각합니다.\n팀에서 갈등을 조율한 경험이 있습니다.'
    const r = cleanupCoverletter(text)
    expect(r.cleaned).toBe(text)
    expect(r.issues).toHaveLength(0)
    expect(r.ranges).toHaveLength(0)
  })

  it('빈 줄 1개(문단 구분)는 그대로 둠', () => {
    const r = cleanupCoverletter('a\n\nb')
    expect(r.cleaned).toBe('a\n\nb')
    expect(r.issues).toHaveLength(0)
  })

  it('과도한 빈 줄(2개 이상)은 1개로 축약', () => {
    const r = cleanupCoverletter('a\n\n\n\nb')
    expect(r.cleaned).toBe('a\n\nb')
    expect(r.issues.map((i) => i.key)).toContain('newlines')
  })

  it('전각 문장부호는 반각으로 변환', () => {
    const r = cleanupCoverletter('（주）테스트！')
    expect(r.cleaned).toBe('(주)테스트!')
    expect(r.issues.map((i) => i.key)).toContain('fullwidthPunct')
  })

  it('㈜ 기호는 (주)로 변환', () => {
    const r = cleanupCoverletter('㈜치뽀')
    expect(r.cleaned).toBe('(주)치뽀')
    expect(r.issues.map((i) => i.key)).toContain('fullwidthPunct')
  })

  it('NBSP는 일반 공백으로 정규화', () => {
    const r = cleanupCoverletter('a b')
    expect(r.cleaned).toBe('a b')
    expect(r.issues.map((i) => i.key)).toContain('fullwidth')
  })

  it('반복된 문장부호는 1개로 축약', () => {
    const r = cleanupCoverletter('정말요??')
    expect(r.cleaned).toBe('정말요?')
    expect(r.issues.map((i) => i.key)).toContain('dupPunct')
  })

  it('줄 끝 쉼표 뒤 줄바꿈은 한 문장으로 합침', () => {
    const r = cleanupCoverletter('팀에서 갈등을 조율했고,\n데이터로 검증하는 과정을 좋아합니다.')
    expect(r.cleaned).toBe('팀에서 갈등을 조율했고, 데이터로 검증하는 과정을 좋아합니다.')
    expect(r.issues.map((i) => i.key)).toContain('commaBreak')
  })

  it('마침표로 끝난 줄의 줄바꿈은 그대로 둠', () => {
    const text = '첫 문장입니다.\n둘째 문장입니다.'
    const r = cleanupCoverletter(text)
    expect(r.cleaned).toBe(text)
    expect(r.issues).toHaveLength(0)
  })

  it('연속 공백 → 1개', () => {
    const r = cleanupCoverletter('나는    열심히   했다')
    expect(r.cleaned).toBe('나는 열심히 했다')
    expect(keys('나는    열심히   했다')).toContain('spaces')
  })

  it('줄 앞뒤 공백 제거', () => {
    const r = cleanupCoverletter('첫 줄   \n   둘째 줄')
    expect(r.cleaned).toBe('첫 줄\n둘째 줄')
    expect(r.issues.map((i) => i.key)).toContain('trailing')
  })

  it('탭 → 공백', () => {
    const r = cleanupCoverletter('이름:\t홍길동')
    expect(r.cleaned).toBe('이름: 홍길동')
    expect(r.issues.map((i) => i.key)).toContain('tabs')
  })

  it('한글 자모 단독 사용 제거(ㅋㅋ, ㅎㅎ)', () => {
    const r = cleanupCoverletter('정말 좋았어요ㅋㅋ 다시 하고 싶어요ㅎㅎ')
    expect(r.cleaned).toBe('정말 좋았어요 다시 하고 싶어요')
    const jamo = r.issues.find((i) => i.key === 'jamo')
    expect(jamo?.count).toBe(2)
  })

  it('이모지 제거', () => {
    const r = cleanupCoverletter('안녕하세요 😀 반갑습니다🎉')
    expect(r.cleaned).toBe('안녕하세요 반갑습니다')
    const emoji = r.issues.find((i) => i.key === 'emoji')
    expect(emoji?.count).toBe(2)
  })

  it('전각 공백 → 일반 공백', () => {
    const r = cleanupCoverletter('홍길동　드림')
    expect(r.cleaned).toBe('홍길동 드림')
    expect(r.issues.map((i) => i.key)).toContain('fullwidth')
  })

  it('둥근 따옴표 → 직선 따옴표', () => {
    const r = cleanupCoverletter('그는 “안녕”이라고 ‘인사’했다')
    expect(r.cleaned).toBe('그는 "안녕"이라고 \'인사\'했다')
    const sq = r.issues.find((i) => i.key === 'smartquotes')
    expect(sq?.count).toBe(4)
  })

  it('문장부호 외 특수문자 제거 (=, |)', () => {
    const r = cleanupCoverletter('목표=달성|완료')
    expect(r.cleaned).toBe('목표달성완료')
    const special = r.issues.find((i) => i.key === 'special')
    expect(special?.count).toBe(2)
  })

  it('그림문자(★) 제거', () => {
    const r = cleanupCoverletter('수상★ 경력')
    expect(r.cleaned).toBe('수상 경력')
    expect(r.issues.some((i) => i.key === 'emoji' || i.key === 'special')).toBe(true)
  })

  it('허용 문장부호(%, &, +, 괄호 등)는 유지', () => {
    const text = '매출 30% 증가 (R&D 협업) C++ 활용, 약 3~5년 경험.'
    const r = cleanupCoverletter(text)
    expect(r.cleaned).toBe(text)
    expect(r.issues).toHaveLength(0)
  })

  it('글자수 제한 초과를 이슈로 보고', () => {
    const r = cleanupCoverletter('가나다라마', 3)
    expect(r.cleaned).toBe('가나다라마')
    const over = r.issues.find((i) => i.key === 'overLimit')
    expect(over?.count).toBe(2)
  })

  it('하이라이트 구간은 코드유닛 기준 (이모지 서로게이트 페어 포함)', () => {
    const r = cleanupCoverletter('a😀b')
    expect(r.ranges).toEqual([[1, 3]])
  })

  it('정리 결과는 멱등 (다시 돌려도 그대로, 이슈 없음)', () => {
    const messy = '  첫 문단ㅋㅋ★  \n\n\n\n（주）둘째　문단😀\t셋째!! 끝??   '
    const once = cleanupCoverletter(messy)
    const twice = cleanupCoverletter(once.cleaned)
    expect(twice.cleaned).toBe(once.cleaned)
    expect(twice.issues).toHaveLength(0)
  })
})
