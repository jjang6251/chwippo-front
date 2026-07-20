/**
 * card-detail-remodel — 데모 카드 자소서 세트 검증.
 * 11개 카드 전부 자소서 존재 · 문항 수 · 글자수 제한 준수 · [대괄호] 소제목 관례 · 복붙 금지 · 상태 다양성.
 */
import { describe, it, expect } from 'vitest'
import { DEMO_APPLICATIONS, DEMO_COVERLETTERS, getDemoCoverletters } from './sampleData'
import { COVERLETTER_CATEGORIES } from '@/types/coverletter'

const CATEGORIES = COVERLETTER_CATEGORIES as readonly string[]

describe('sampleData — 데모 카드 자소서', () => {
  it('모든 데모 지원 카드(11)에 자소서 세트 존재 + 카드당 2~4 문항', () => {
    expect(DEMO_APPLICATIONS.length).toBe(11)
    for (const app of DEMO_APPLICATIONS) {
      const cls = getDemoCoverletters(app.id)
      expect(cls.length, `${app.companyName} 문항 수`).toBeGreaterThanOrEqual(2)
      expect(cls.length, `${app.companyName} 문항 수`).toBeLessThanOrEqual(4)
    }
  })

  it('각 문항 형상 유효 (question 비어있지 않음 · category 유효 · orderIndex 연속)', () => {
    for (const app of DEMO_APPLICATIONS) {
      getDemoCoverletters(app.id).forEach((c, i) => {
        expect(c.question.trim().length).toBeGreaterThan(0)
        expect(c.category === null || CATEGORIES.includes(c.category)).toBe(true)
        expect(c.orderIndex).toBe(i)
        expect(c.applicationId).toBe(app.id)
      })
    }
  })

  it('글자수 제한에 거의 맞춤 — 0.9×limit ≤ length ≤ limit (합격작 관행 · CEO 강화)', () => {
    for (const list of Object.values(DEMO_COVERLETTERS)) {
      for (const c of list) {
        if (c.answer && c.charLimit) {
          expect(c.answer.length, `${c.id} ≤ limit`).toBeLessThanOrEqual(c.charLimit)
          expect(c.answer.length, `${c.id} ≥ 90%`).toBeGreaterThanOrEqual(0.9 * c.charLimit)
        }
      }
    }
  })

  it('소제목 = 정확히 1개, 답변 맨 앞 [대괄호] 요약 헤드라인 (2개 이상이면 실패)', () => {
    for (const list of Object.values(DEMO_COVERLETTERS)) {
      for (const c of list) {
        if (c.answer) {
          expect(c.answer.startsWith('['), `${c.id} 맨 앞 소제목`).toBe(true)
          // 대괄호 쌍이 정확히 1개 — 본문에 추가 [소제목] 없음
          expect((c.answer.match(/\[/g) ?? []).length, `${c.id} [ 개수`).toBe(1)
          expect((c.answer.match(/\]/g) ?? []).length, `${c.id} ] 개수`).toBe(1)
          // 소제목 뒤 본문이 개행으로 이어짐 (헤드라인만 있는 게 아님)
          expect(c.answer.indexOf('\n'), `${c.id} 본문 존재`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('전 답변 복붙 금지 (작성된 답변 모두 유일)', () => {
    const answers = Object.values(DEMO_COVERLETTERS)
      .flat()
      .map((c) => c.answer)
      .filter((a): a is string => !!a)
    expect(answers.length).toBeGreaterThanOrEqual(20)
    expect(new Set(answers).size).toBe(answers.length)
  })

  it('상태 다양성 — 완성(100%) 카드와 진행 중(일부 미작성) 카드가 공존 (2~3 진행 중)', () => {
    const completion = DEMO_APPLICATIONS.map((app) => {
      const cls = getDemoCoverletters(app.id)
      const done = cls.filter((c) => (c.answer ?? '').trim()).length
      return { id: app.id, done, total: cls.length }
    })
    const complete = completion.filter((c) => c.done === c.total)
    const partial = completion.filter((c) => c.done < c.total)
    expect(complete.length).toBeGreaterThan(0)
    expect(partial.length).toBeGreaterThanOrEqual(2)
    expect(partial.length).toBeLessThanOrEqual(4)
  })
})
