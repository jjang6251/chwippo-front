import { describe, expect, it } from 'vitest'
import {
  APPLICATION_TEMPLATES,
  getApplicationTemplate,
  getStepType,
  recommendTemplate,
  STEP_TYPE_CONFIG,
  CHECKLIST_PRESETS,
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

describe('STEP_TYPE_CONFIG — 시맨틱 토큰 (U32 → 카드 상세 개편에서 warning 통일)', () => {
  it('document 는 warning 계열로 통일 (스트라이프·라벨·보더 — 캘린더 정합, 파랑 라벨+노랑 스트라이프 모순 방지)', () => {
    expect(STEP_TYPE_CONFIG.document.colorCls).toBe('text-warning')
    expect(STEP_TYPE_CONFIG.document.borderCls).toBe('border-warning/30')
    expect(STEP_TYPE_CONFIG.document.bgCls).toBe('bg-warning/5')
    expect(STEP_TYPE_CONFIG.document.accentBorderCls).toBe('border-l-warning')
  })

  it('전 유형 클래스 필드에 raw 팔레트(blue- 등) 없음 — 의미 토큰만', () => {
    for (const cfg of Object.values(STEP_TYPE_CONFIG)) {
      for (const cls of [cfg.colorCls, cfg.borderCls, cfg.bgCls, cfg.accentBorderCls]) {
        expect(cls).not.toMatch(/blue-|red-|green-|yellow-|indigo-|sky-/)
      }
    }
  })

  it('전 유형 Icon 은 lucide 컴포넌트 — 기능 아이콘 정책 (이모지 문자열 아님)', () => {
    for (const cfg of Object.values(STEP_TYPE_CONFIG)) {
      expect(cfg.Icon).toBeDefined()
      // lucide 아이콘 = forwardRef(object). 과거 icon: string(이모지) 로의 회귀 방지.
      expect(typeof cfg.Icon).not.toBe('string')
      expect(cfg.Icon).toHaveProperty('render')
    }
  })

  it('구 icon(이모지)·hex 필드 제거 — 아이콘 정책 전환 + 위생 ⑪ (죽은 hex 삭제)', () => {
    for (const cfg of Object.values(STEP_TYPE_CONFIG) as Record<string, unknown>[]) {
      expect('icon' in cfg).toBe(false)
      expect('hex' in cfg).toBe(false)
    }
  })
})

describe('getStepType — 분류 키워드 확장 + exam 신설 (판정 순서 = 본질 우선순위)', () => {
  it('interview — 면접·인터뷰 + 면접형 전형(PT·토론·컬처핏·커피챗)', () => {
    for (const name of ['1차 면접', '임원면접', '화상 인터뷰', '2차 PT·토론', 'PT 발표', '2차 컬처핏', '컬쳐핏 면접', '커피챗']) {
      expect(getStepType(name)).toBe('interview')
    }
  })

  it('interview 우선 — AI면접은 면접(면접 우선), PT 발표는 result 아닌 interview', () => {
    expect(getStepType('AI면접')).toBe('interview')
    expect(getStepType('PT 발표')).toBe('interview') // 발표(result 키워드) 보다 interview 먼저
  })

  it('exam(신설) — 코테·과제·필기·인적성·시험·평가·검사·역검류', () => {
    for (const name of ['코딩테스트·과제', '코테', '온라인 테스트', '필기(NCS)', '인적성', '인성검사', '적성평가', '논술', '작문 시험', '실기', 'AI역량검사', '역검', '실무 평가', '과제 전형']) {
      expect(getStepType(name)).toBe('exam')
    }
  })

  it('exam — 영문 시험명 대소문자 무관 (\\b 단어경계)', () => {
    for (const name of ['GSAT', 'gsat', '온라인 GSAT', 'HMAT', '인적성(HMAT)', 'SKCT', 'PSAT', 'DCAT', '필기(NCS)']) {
      expect(getStepType(name)).toBe('exam')
    }
  })

  it('exam 영문 \\b — 단어 내부 CAT/PAT 오탐 방지 (application·communication 등은 exam 아님)', () => {
    expect(getStepType('communication 워크샵')).toBe('wait')
    expect(getStepType('Application 접수 안내')).toBe('wait')
  })

  it('순서 충돌 — 과제 제출은 document 보다 exam 먼저 (과제가 본질)', () => {
    expect(getStepType('과제 제출')).toBe('exam')
  })

  it('document — 서류·제출 (exam 키워드 없을 때)', () => {
    expect(getStepType('서류 제출')).toBe('document')
    expect(getStepType('지원서 제출')).toBe('document')
  })

  it('result — 합격·최종·발표 (발표 신규 — "결과 발표"도 발표로 커버)', () => {
    for (const name of ['최종 합격', '합격 발표', '결과 발표', '최종 결과']) {
      expect(getStepType(name)).toBe('result')
    }
  })

  it('wait — "결과 대기"는 대기 (단독 결과 키워드 제외 → 발표만 result). 미매칭은 대기', () => {
    expect(getStepType('결과 대기 중')).toBe('wait')
    expect(getStepType('온보딩')).toBe('wait')
    expect(getStepType('')).toBe('wait')
  })

  it('기본 템플릿 전 스텝명 회귀 — 회색 대기로 새던 핵심 전형이 올바른 유형으로', () => {
    const expected: Record<string, string> = {
      '서류 제출': 'document',
      '코딩테스트·과제': 'exam',
      '1차 기술면접': 'interview',
      '2차 컬처핏': 'interview',
      '최종 합격': 'result',
      '필기(NCS)': 'exam',
      '인적성': 'exam',
      '1차 실무면접': 'interview',
      '2차 PT·토론': 'interview',
      '임원면접': 'interview',
      '과제 전형': 'exam',
      '대표 면접': 'interview',
      '필기': 'exam',
      '실무 평가': 'exam',
      '면접': 'interview',
    }
    for (const [name, type] of Object.entries(expected)) {
      expect(getStepType(name)).toBe(type)
    }
    // APPLICATION_TEMPLATES 안의 스텝명이 wait 로 떨어지지 않는지 (마지막 '최종 합격'=result 등 전부 분류됨)
    for (const t of APPLICATION_TEMPLATES) {
      for (const step of t.steps) {
        expect(getStepType(step)).not.toBe('wait')
      }
    }
  })

  it('exam 은 STEP_TYPE_CONFIG·CHECKLIST_PRESETS 를 모두 보유', () => {
    expect(STEP_TYPE_CONFIG.exam.label).toBe('시험·평가')
    expect(STEP_TYPE_CONFIG.exam.colorCls).toBe('text-violet')
    expect(CHECKLIST_PRESETS.exam).toHaveLength(4)
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
