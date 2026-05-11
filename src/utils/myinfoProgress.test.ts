import { describe, it, expect } from 'vitest'
import { computeMyinfoSections, computeProgress, isExcludedFromGauge } from './myinfoProgress'
import type { UserProfile, LanguageCert, Cert, Award, Experience, MyDocument, CoverletterData, Education } from '@/api/myinfo'
import type { ExamSchedule } from '@/types/exam-schedule'

// ── 헬퍼: 기본 빈 입력 ─────────────────────────────────────
function makeInput(overrides: {
  profile?: UserProfile
  educations?: Education[]
  langCerts?: LanguageCert[]
  certs?: Cert[]
  examSchedules?: ExamSchedule[]
  awards?: Award[]
  experiences?: Experience[]
  documents?: MyDocument[]
  coverletter?: CoverletterData
} = {}) {
  return {
    profile: overrides.profile,
    educations: overrides.educations ?? [],
    langCerts: overrides.langCerts ?? [],
    certs: overrides.certs ?? [],
    examSchedules: overrides.examSchedules ?? [],
    awards: overrides.awards ?? [],
    experiences: overrides.experiences ?? [],
    documents: overrides.documents ?? [],
    coverletter: overrides.coverletter,
  }
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return { user_id: 'u1', ...overrides }
}

describe('isExcludedFromGauge', () => {
  it('exam-schedules·goals·files는 게이지 제외', () => {
    expect(isExcludedFromGauge('exam-schedules')).toBe(true)
    expect(isExcludedFromGauge('goals')).toBe(true)
    expect(isExcludedFromGauge('files')).toBe(true)
  })

  it('나머지 섹션은 게이지 포함', () => {
    expect(isExcludedFromGauge('profile')).toBe(false)
    expect(isExcludedFromGauge('education')).toBe(false)
    expect(isExcludedFromGauge('military')).toBe(false)
    expect(isExcludedFromGauge('coverletter')).toBe(false)
    expect(isExcludedFromGauge('experiences')).toBe(false)
    expect(isExcludedFromGauge('awards')).toBe(false)
    expect(isExcludedFromGauge('language-certs')).toBe(false)
    expect(isExcludedFromGauge('certs')).toBe(false)
  })
})

describe('computeMyinfoSections — profile/military 단일', () => {
  it('profile — name 채우면 filled', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile({ name: '홍길동' }) }))
    const profile = sections.find((s) => s.id === 'profile')!
    expect(profile.filled).toBe(true)
    expect(profile.count).toBe(1)
  })

  it('profile — 모든 핵심 필드 비면 unfilled', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile() }))
    const profile = sections.find((s) => s.id === 'profile')!
    expect(profile.filled).toBe(false)
    expect(profile.count).toBe(0)
  })

  it('military — gender=MALE이면 active', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile({ gender: 'MALE' }) }))
    expect(sections.find((s) => s.id === 'military')!.active).toBe(true)
  })

  it('military — gender=FEMALE이면 inactive', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile({ gender: 'FEMALE' }) }))
    expect(sections.find((s) => s.id === 'military')!.active).toBe(false)
  })

  it('military — gender 미설정이면 inactive', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile() }))
    expect(sections.find((s) => s.id === 'military')!.active).toBe(false)
  })

  it('military — gender=MALE + military_branch 채움 → filled', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ gender: 'MALE', military_branch: '육군' }),
    }))
    expect(sections.find((s) => s.id === 'military')!.filled).toBe(true)
  })
})

describe('computeMyinfoSections — 학력 (빈 row 제외)', () => {
  it('school_name이 채워진 row만 카운트', () => {
    const sections = computeMyinfoSections(makeInput({
      educations: [
        { id: 'e1', school_name: '서울대학교' },
        { id: 'e2', school_name: '' },           // 빈 row
        { id: 'e3', school_name: '   ' },        // 공백만
      ],
    }))
    const ed = sections.find((s) => s.id === 'education')!
    expect(ed.filled).toBe(true)
    expect(ed.count).toBe(1)
  })

  it('모든 row가 빈 school_name이면 filled=false', () => {
    const sections = computeMyinfoSections(makeInput({
      educations: [
        { id: 'e1', school_name: '' },
        { id: 'e2', school_name: '   ' },
      ],
    }))
    const ed = sections.find((s) => s.id === 'education')!
    expect(ed.filled).toBe(false)
    expect(ed.count).toBe(0)
  })
})

describe('computeMyinfoSections — coverletter (6필드 중 1개)', () => {
  it('1개라도 trim 후 내용 있으면 filled', () => {
    const sections = computeMyinfoSections(makeInput({
      coverletter: { coverletter: { background: '성장 배경 내용' }, custom: [] },
    }))
    expect(sections.find((s) => s.id === 'coverletter')!.filled).toBe(true)
  })

  it('모든 필드 공백만이면 unfilled', () => {
    const sections = computeMyinfoSections(makeInput({
      coverletter: { coverletter: { personality_strength: '   ', background: '' }, custom: [] },
    }))
    expect(sections.find((s) => s.id === 'coverletter')!.filled).toBe(false)
  })

  it('coverletter 데이터 자체가 없으면 unfilled', () => {
    const sections = computeMyinfoSections(makeInput())
    expect(sections.find((s) => s.id === 'coverletter')!.filled).toBe(false)
  })
})

describe('computeMyinfoSections — 다중 섹션', () => {
  it('langCerts/certs/awards/experiences는 length > 0이면 filled', () => {
    const sections = computeMyinfoSections(makeInput({
      langCerts: [{ id: 'l1', cert_type: 'TOEIC' }],
      certs: [{ id: 'c1', name: '정보처리기사' }, { id: 'c2', name: 'SQLD' }],
    }))
    expect(sections.find((s) => s.id === 'language-certs')!.count).toBe(1)
    expect(sections.find((s) => s.id === 'certs')!.count).toBe(2)
  })

  it('multi 섹션 0개면 filled=false, count=0', () => {
    const sections = computeMyinfoSections(makeInput())
    expect(sections.find((s) => s.id === 'awards')!.filled).toBe(false)
    expect(sections.find((s) => s.id === 'awards')!.count).toBe(0)
  })
})

describe('computeMyinfoSections — goals (profile 안 필드 기반)', () => {
  it('goal_other가 채워지면 filled', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ goal_other: '취업 목표' }),
    }))
    expect(sections.find((s) => s.id === 'goals')!.filled).toBe(true)
  })

  it('goal_toeic 점수만 있어도 filled', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ goal_toeic: 900 }),
    }))
    expect(sections.find((s) => s.id === 'goals')!.filled).toBe(true)
  })

  it('모든 goal 필드 비면 unfilled', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile() }))
    expect(sections.find((s) => s.id === 'goals')!.filled).toBe(false)
  })
})

describe('computeProgress — 진척도 계산', () => {
  it('아무것도 안 채우면 percent=0 (남성 기준 8개 활성, 모두 미채움)', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile({ gender: 'MALE' }) }))
    const { percent, filled, total } = computeProgress(sections)
    expect(percent).toBe(0)
    expect(filled).toBe(0)
    expect(total).toBe(8)   // profile, education, military, coverletter, experiences, awards, language-certs, certs
  })

  it('여성은 military 빠져 7개 활성', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile({ gender: 'FEMALE' }) }))
    const { total } = computeProgress(sections)
    expect(total).toBe(7)
  })

  it('exam-schedules·goals·files는 채워도 게이지 카운트 영향 없음', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ gender: 'FEMALE', goal_other: '목표' }),
      examSchedules: [{ id: 'x1' } as any],
      documents: [{ id: 'd1' } as any],
    }))
    const { filled, total } = computeProgress(sections)
    expect(filled).toBe(0)  // 카운트 대상 섹션은 모두 미채움
    expect(total).toBe(7)
  })

  it('모든 활성 섹션 채우면 percent=100, firstEmptyId=null', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ gender: 'MALE', name: '홍길동', military_branch: '육군' }),
      educations: [{ id: 'e1', school_name: '서울대' }],
      coverletter: { coverletter: { background: '배경' }, custom: [] },
      experiences: [{ id: 'x1' } as any],
      awards: [{ id: 'a1' } as any],
      langCerts: [{ id: 'l1' } as any],
      certs: [{ id: 'c1' } as any],
    }))
    const { percent, filled, total, firstEmptyId } = computeProgress(sections)
    expect(filled).toBe(8)
    expect(total).toBe(8)
    expect(percent).toBe(100)
    expect(firstEmptyId).toBeNull()
  })

  it('firstEmptyId는 사이드바 순서대로 결정 (profile 채우고 다음은 education)', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ name: '홍길동' }),    // profile만 채움
    }))
    const { firstEmptyId } = computeProgress(sections)
    expect(firstEmptyId).toBe('education')
  })

  it('빈 학력 row만 있을 때 firstEmptyId=education (빈 row 무시)', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ name: '홍길동' }),
      educations: [{ id: 'e1', school_name: '' }, { id: 'e2', school_name: '   ' }],
    }))
    const { firstEmptyId } = computeProgress(sections)
    expect(firstEmptyId).toBe('education')
  })

  it('절반 채우면 percent ≈ 50 (반올림)', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ gender: 'FEMALE', name: '홍길동' }),  // 7개 활성
      coverletter: { coverletter: { background: '배경' }, custom: [] },
      experiences: [{ id: 'x1' } as any],
    }))
    const { filled, total, percent } = computeProgress(sections)
    expect(filled).toBe(3)
    expect(total).toBe(7)
    expect(percent).toBe(Math.round((3 / 7) * 100))  // 43
  })
})
