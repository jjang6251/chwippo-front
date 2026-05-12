import { describe, expect, it } from 'vitest'
import {
  APPLICATION_TEMPLATES,
  getApplicationTemplate,
  recommendTemplate,
} from './stepTemplates'

describe('APPLICATION_TEMPLATES', () => {
  it('모든 템플릿은 "서류 제출" 시작 / "최종 합격" 끝', () => {
    for (const t of APPLICATION_TEMPLATES) {
      expect(t.steps.length).toBeGreaterThanOrEqual(3)
      expect(t.steps[0]).toBe('서류 제출')
      expect(t.steps[t.steps.length - 1]).toBe('최종 합격')
    }
  })

  it('custom 은 general 과 동일한 스텝', () => {
    const custom = APPLICATION_TEMPLATES.find((t) => t.id === 'custom')!
    const general = APPLICATION_TEMPLATES.find((t) => t.id === 'general')!
    expect(custom.steps).toEqual(general.steps)
  })

  it('getApplicationTemplate — 미존재·null·undefined 는 general', () => {
    expect(getApplicationTemplate('finance').id).toBe('finance')
    expect(getApplicationTemplate(null).id).toBe('general')
    expect(getApplicationTemplate(undefined).id).toBe('general')
    expect(getApplicationTemplate('nope').id).toBe('general')
  })
})

describe('recommendTemplate', () => {
  it('빈 입력 → general', () => {
    expect(recommendTemplate({})).toBe('general')
  })

  it('rawInput에 "인턴" → internship (최우선)', () => {
    expect(recommendTemplate({ rawInput: '삼성전자 하계 인턴' })).toBe('internship')
    expect(recommendTemplate({ rawInput: '네이버 인턴', jobCategories: ['IT개발'] })).toBe('internship')
  })

  it('jobCategories에 IT개발 → it_dev', () => {
    expect(recommendTemplate({ jobCategories: ['IT개발'] })).toBe('it_dev')
    expect(recommendTemplate({ jobCategories: ['디자인', 'IT개발'] })).toBe('it_dev')
  })

  it('회사명 패턴 — 금융권', () => {
    expect(recommendTemplate({ companyName: '신한은행' })).toBe('finance')
    expect(recommendTemplate({ companyName: 'KB증권' })).toBe('finance')
    expect(recommendTemplate({ companyName: '삼성카드' })).toBe('finance')
  })

  it('회사명 패턴 — 공기업·공공 (청은 끝에 올 때만)', () => {
    expect(recommendTemplate({ companyName: '한국토지주택공사' })).toBe('public')
    expect(recommendTemplate({ companyName: '한국산업인력공단' })).toBe('public')
    expect(recommendTemplate({ companyName: '기상청' })).toBe('public')
    // "청"으로 시작하는 사기업은 오인하지 않음
    expect(recommendTemplate({ companyName: '청호나이스' })).toBe('general')
  })

  it('회사명 패턴 — 방송·언론', () => {
    expect(recommendTemplate({ companyName: 'MBC' })).toBe('media')
    expect(recommendTemplate({ companyName: '한겨레신문' })).toBe('media')
    expect(recommendTemplate({ companyName: 'JTBC' })).toBe('media')
  })

  it('스타트업은 자동 추천 룰 없음 → general (사용자가 직접 선택)', () => {
    expect(recommendTemplate({ companyName: '토스' })).toBe('general')
    expect(recommendTemplate({ companyName: '당근마켓', jobCategories: ['마케팅'] })).toBe('general')
  })
})
