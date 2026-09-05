import { describe, it, expect } from 'vitest'
import { computeCoreSet, computeMyinfoSections, computeProgress, isExcludedFromGauge } from './myinfoProgress'
import type { ActivityItem, CoreItemId, CoreSetInput, OptionalItemId } from './myinfoProgress'
import type { UserProfile, LanguageCert, Cert, Award, MyDocument, CoverletterData, Education } from '@/api/myinfo'
import type { ExamSchedule } from '@/types/exam-schedule'

// ── 헬퍼: 기본 빈 입력 ─────────────────────────────────────
function makeInput(overrides: {
  profile?: UserProfile
  educations?: Education[]
  langCerts?: LanguageCert[]
  certs?: Cert[]
  examSchedules?: ExamSchedule[]
  awards?: Award[]
  /** 경력·경험이 한 목록으로 들어온다 — `type` 이 갈래를 정한다 */
  experiences?: ActivityItem[]
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
    expect(isExcludedFromGauge('career')).toBe(false)
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
      coverletter: { coverletter: { personality: '   ', background: '', challenge: '  ' }, custom: [] },
    }))
    expect(sections.find((s) => s.id === 'coverletter')!.filled).toBe(false)
  })

  it('통합된 personality(성격 장단점) 필드만 채워도 filled', () => {
    const sections = computeMyinfoSections(makeInput({
      coverletter: { coverletter: { personality: '성실하고 꼼꼼함, 단점은 ...' }, custom: [] },
    }))
    expect(sections.find((s) => s.id === 'coverletter')!.filled).toBe(true)
  })

  it('신규 필드 collaboration(협업 경험)만 채워도 filled', () => {
    const sections = computeMyinfoSections(makeInput({
      coverletter: { coverletter: { collaboration: '팀 갈등을 조율한 경험' }, custom: [] },
    }))
    expect(sections.find((s) => s.id === 'coverletter')!.filled).toBe(true)
  })

  it('신규 필드 challenge(도전·실패 경험)만 채워도 filled', () => {
    const sections = computeMyinfoSections(makeInput({
      coverletter: { coverletter: { challenge: '실패에서 배운 점' }, custom: [] },
    }))
    expect(sections.find((s) => s.id === 'coverletter')!.filled).toBe(true)
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

  it('🔴 활동은 type 으로 경력·경험 두 섹션에 나뉜다 (저장소는 하나)', () => {
    const sections = computeMyinfoSections(makeInput({
      experiences: [
        { id: 'x1', type: 'intern' },
        { id: 'x2', type: 'fulltime' },
        { id: 'x3', type: 'club' },
        // 유형을 모르는 활동은 경력이 아니다 — 경험 쪽에 남는다
        { id: 'x4', type: null },
      ],
    }))
    const career = sections.find((s) => s.id === 'career')!
    const experiences = sections.find((s) => s.id === 'experiences')!
    expect(career.count).toBe(2)
    expect(career.filled).toBe(true)
    expect(experiences.count).toBe(2)
    expect(experiences.filled).toBe(true)
  })

  it('경력만 있으면 경험 섹션은 비어 있다 (그 반대도)', () => {
    const onlyCareer = computeMyinfoSections(makeInput({ experiences: [{ id: 'x1', type: 'parttime' }] }))
    expect(onlyCareer.find((s) => s.id === 'career')!.filled).toBe(true)
    expect(onlyCareer.find((s) => s.id === 'experiences')!.filled).toBe(false)

    const onlyExperience = computeMyinfoSections(makeInput({ experiences: [{ id: 'x1', type: 'volunteer' }] }))
    expect(onlyExperience.find((s) => s.id === 'career')!.filled).toBe(false)
    expect(onlyExperience.find((s) => s.id === 'experiences')!.filled).toBe(true)
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
  it('아무것도 안 채우면 percent=0 (남성 기준 9개 활성, 모두 미채움)', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile({ gender: 'MALE' }) }))
    const { percent, filled, total } = computeProgress(sections)
    expect(percent).toBe(0)
    expect(filled).toBe(0)
    // profile, education, military, coverletter, career, experiences, awards, language-certs, certs
    expect(total).toBe(9)
  })

  it('여성은 military 빠져 8개 활성', () => {
    const sections = computeMyinfoSections(makeInput({ profile: makeProfile({ gender: 'FEMALE' }) }))
    const { total } = computeProgress(sections)
    expect(total).toBe(8)
  })

  it('exam-schedules·goals·files는 채워도 게이지 카운트 영향 없음', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ gender: 'FEMALE', goal_other: '목표' }),
      examSchedules: [{ id: 'x1' } as any],
      documents: [{ id: 'd1' } as any],
    }))
    const { filled, total } = computeProgress(sections)
    expect(filled).toBe(0)  // 카운트 대상 섹션은 모두 미채움
    expect(total).toBe(8)
  })

  it('모든 활성 섹션 채우면 percent=100, firstEmptyId=null', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ gender: 'MALE', name: '홍길동', military_branch: '육군' }),
      educations: [{ id: 'e1', school_name: '서울대' }],
      coverletter: { coverletter: { background: '배경' }, custom: [] },
      // 경력·경험은 이제 다른 섹션이라 둘 다 있어야 100% 다
      experiences: [{ id: 'x1', type: 'intern' }, { id: 'x2', type: 'club' }],
      awards: [{ id: 'a1' } as any],
      langCerts: [{ id: 'l1' } as any],
      certs: [{ id: 'c1' } as any],
    }))
    const { percent, filled, total, firstEmptyId } = computeProgress(sections)
    expect(filled).toBe(9)
    expect(total).toBe(9)
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

  it('절반 채우면 percent = 50', () => {
    const sections = computeMyinfoSections(makeInput({
      profile: makeProfile({ gender: 'FEMALE', name: '홍길동' }),  // 8개 활성
      coverletter: { coverletter: { background: '배경' }, custom: [] },
      experiences: [{ id: 'x1', type: 'club' }, { id: 'x2', type: 'intern' }],
    }))
    const { filled, total, percent } = computeProgress(sections)
    expect(filled).toBe(4)   // profile · coverletter · career · experiences
    expect(total).toBe(8)
    expect(percent).toBe(50)
  })
})

// ────────────────────────────────────────────────────────────
/**
 * 「지원서 기본 세트 N/7」 — 화면이 사용자에게 하는 **약속**이라 여기가 곧 계약이다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  ── 기본 세트 7
 *   1. 빈 프로필 → 0/7 · percent 0
 *   2. 이름 — 값이 있으면 완료, 공백만이면 미완료
 *   3. 연락처 · 생년월일 — 값 존재로 판정
 *   4. 🔴 주소 — 우편번호 **와** 기본주소가 둘 다 있어야 완료
 *   5. 🔴 최종 학력 — `highest_degree` + **그 단계의 학교 1건** (학교만 있거나 단계만 골랐으면 미완료)
 *   5-a. 단계 ↔ 학교 `degree` 대응 5쌍 (high→고등학교 … doctor→대학원 (박사))
 *   6. 🔴 병역 ① 성별 미저장 → 미완료 + 안내 문구 + 이동은 profile 로
 *   7. 🔴 병역 ② MALE — military_status 저장 시에만 완료 · 이동은 military 로
 *   8. 🔴 병역 ③ FEMALE(=MALE 아닌 저장값) → 자동 완료
 *   9. 보훈 — 「비대상(false)」 저장도 완료, undefined 면 미완료
 *  10. 7/7 → percent 100 · firstEmptyId null
 *  11. firstEmptyId 는 **첫 미완료 항목의 섹션**
 *  ── 「있으면 자동으로 채워져요」 12
 *  12. 항목 12개 · 순서 고정 (🔴 경력·경험이 따로 센다 — 지원서가 다른 칸으로 묻는다)
 *  13. 영문 이름 — 성/이름 중 하나만 있어도 완료
 *  14. 목록형(어학·자격증·수상·경력·경험) — 1건 이상이면 완료
 *  14-a. 🔴 경력만 있으면 「경험」은 미완료 (그 반대도) · 유형 없는 활동은 경험 쪽
 *  14-b. 경력·경험 칩은 각자의 섹션으로 간다 (`career` / `experiences`)
 *  15. 추가 정보 — extra_fields 키 1개 이상
 *  16. 🔴 지원 서류 — **슬롯이 있는** 문서만 센다 (기타 파일은 자동 채움 대상이 아니다)
 *  16-a. 🔴 지원 서류 — 슬롯이 0이어도 **항목 첨부**(어학·학력 2종·자격증·수상) 1개면 완료
 *  16-b. 파일 없는 항목만 있으면 미완료
 *  17. 🔴 장애 — 동의 없으면 consentRequired(「선택」) · done 은 false
 *  18. 장애 — 동의 + 값 저장이면 완료
 */
function coreInput(over: Partial<CoreSetInput> = {}): CoreSetInput {
  return {
    profile: over.profile,
    educations: over.educations ?? [],
    langCerts: over.langCerts ?? [],
    certs: over.certs ?? [],
    awards: over.awards ?? [],
    experiences: over.experiences ?? [],
    documents: over.documents ?? [],
  }
}

const core = (over: Partial<CoreSetInput> = {}) => computeCoreSet(coreInput(over))
const item = (set: ReturnType<typeof core>, id: CoreItemId) => set.items.find((i) => i.id === id)!
const opt = (set: ReturnType<typeof core>, id: OptionalItemId) => set.optional.find((o) => o.id === id)!

describe('computeCoreSet — 기본 세트 7', () => {
  it('빈 프로필이면 0/7 · percent 0', () => {
    const set = core()
    expect(set.total).toBe(7)
    expect(set.done).toBe(0)
    expect(set.percent).toBe(0)
  })

  it('이름 — 값이 있으면 완료, 공백만이면 미완료', () => {
    expect(item(core({ profile: makeProfile({ name: '홍길동' }) }), 'name').done).toBe(true)
    expect(item(core({ profile: makeProfile({ name: '   ' }) }), 'name').done).toBe(false)
  })

  it('연락처 · 생년월일 — 값 존재로 판정', () => {
    const set = core({ profile: makeProfile({ phone: '010-0000-0000', birthdate: '2000-01-01' }) })
    expect(item(set, 'phone').done).toBe(true)
    expect(item(set, 'birthdate').done).toBe(true)
  })

  it('🔴 주소 — 우편번호와 기본주소가 둘 다 있어야 완료', () => {
    expect(item(core({ profile: makeProfile({ address_zip: '06236' }) }), 'address').done).toBe(false)
    expect(item(core({ profile: makeProfile({ address_base: '서울 강남구 테헤란로 1' }) }), 'address').done).toBe(false)
    expect(item(core({
      profile: makeProfile({ address_zip: '06236', address_base: '서울 강남구 테헤란로 1' }),
    }), 'address').done).toBe(true)
  })

  it('🔴 최종 학력 — highest_degree 와 그 단계의 학교가 둘 다 있어야 완료', () => {
    const univ = { school_name: 'OO대학교', degree: '대학교 (학사)' }
    // 학교만 있고 단계를 안 골랐으면 지원서의 최종 학력 칸을 못 채운다
    expect(item(core({ educations: [univ] }), 'education').done).toBe(false)
    // 단계만 고르고 그 단계의 학교가 없어도 미완료 (학사라면서 고등학교만)
    expect(item(core({
      profile: makeProfile({ highest_degree: 'bachelor' }),
      educations: [{ school_name: 'OO고등학교', degree: '고등학교' }],
    }), 'education').done).toBe(false)
    expect(item(core({ profile: makeProfile({ highest_degree: 'bachelor' }), educations: [univ] }), 'education').done).toBe(true)
    // 빈 school_name 은 없는 것과 같다
    expect(item(core({
      profile: makeProfile({ highest_degree: 'bachelor' }),
      educations: [{ school_name: '   ', degree: '대학교 (학사)' }],
    }), 'education').done).toBe(false)
  })

  it.each([
    ['high', '고등학교'],
    ['associate', '전문대'],
    ['bachelor', '대학교 (학사)'],
    ['master', '대학원 (석사)'],
    ['doctor', '대학원 (박사)'],
  ] as const)('최종 학력 %s ↔ 학교 단계 「%s」', (highest, degree) => {
    const profile = makeProfile({ highest_degree: highest })
    expect(item(core({ profile, educations: [{ school_name: 'S', degree }] }), 'education').done).toBe(true)
    // 다른 단계의 학교로는 안 된다
    expect(item(core({ profile, educations: [{ school_name: 'S', degree: '기타' }] }), 'education').done).toBe(false)
  })

  it('🔴 병역 ① 성별 미저장 → 미완료 + 안내 문구 + 이동은 profile 로', () => {
    const military = item(core({ profile: makeProfile() }), 'military')
    expect(military.done).toBe(false)
    expect(military.hint).toBe('성별을 고르면 병역 칸은 알아서 처리해요')
    expect(military.sectionId).toBe('profile')
  })

  it('🔴 병역 ② MALE — military_status 저장 시에만 완료 · 이동은 military 로', () => {
    const empty = item(core({ profile: makeProfile({ gender: 'MALE' }) }), 'military')
    expect(empty.done).toBe(false)
    expect(empty.hint).toBeUndefined()
    expect(empty.sectionId).toBe('military')

    const saved = item(core({
      profile: makeProfile({ gender: 'MALE', military_status: 'not_applicable' }),
    }), 'military')
    expect(saved.done).toBe(true)
  })

  it('🔴 병역 ③ FEMALE 이면 상태 없이도 자동 완료', () => {
    const military = item(core({ profile: makeProfile({ gender: 'FEMALE' }) }), 'military')
    expect(military.done).toBe(true)
    expect(military.hint).toBeUndefined()
  })

  it('보훈 — 「비대상(false)」 저장도 완료, 미저장이면 미완료', () => {
    expect(item(core({ profile: makeProfile({ patriot_yn: false }) }), 'patriot').done).toBe(true)
    expect(item(core({ profile: makeProfile({ patriot_yn: true }) }), 'patriot').done).toBe(true)
    expect(item(core({ profile: makeProfile() }), 'patriot').done).toBe(false)
  })

  it('7/7 → percent 100 · firstEmptyId null', () => {
    const set = core({
      profile: makeProfile({
        name: '홍길동', phone: '010-0000-0000', birthdate: '2000-01-01',
        address_zip: '06236', address_base: '서울 강남구 테헤란로 1',
        gender: 'FEMALE', patriot_yn: false, highest_degree: 'bachelor',
      }),
      educations: [{ school_name: 'OO대학교', degree: '대학교 (학사)' }],
    })
    expect(set.done).toBe(7)
    expect(set.percent).toBe(100)
    expect(set.firstEmptyId).toBeNull()
  })

  it('firstEmptyId 는 첫 미완료 항목의 섹션 (이름·연락처·생년월일 채우면 주소 → profile)', () => {
    const set = core({
      profile: makeProfile({ name: '홍길동', phone: '010', birthdate: '2000-01-01' }),
    })
    expect(set.firstEmptyId).toBe('profile')

    const afterProfile = core({
      profile: makeProfile({
        name: '홍길동', phone: '010', birthdate: '2000-01-01',
        address_zip: '06236', address_base: '서울',
      }),
    })
    expect(afterProfile.firstEmptyId).toBe('education')
  })
})

describe('computeCoreSet — 「있으면 자동으로 채워져요」 12', () => {
  it('항목 12개 · 순서 고정', () => {
    expect(core().optional.map((o) => o.id)).toEqual([
      'name-en', 'email', 'nationality', 'emergency',
      'language-certs', 'certs', 'awards', 'career', 'experiences',
      'extra-fields', 'documents', 'disability',
    ])
    expect(core().optionalTotal).toBe(12)
  })

  it('영문 이름 — 성/이름 중 하나만 있어도 완료', () => {
    expect(opt(core({ profile: makeProfile({ name_en_last: 'HONG' }) }), 'name-en').done).toBe(true)
    expect(opt(core({ profile: makeProfile({ name_en_first: 'GILDONG' }) }), 'name-en').done).toBe(true)
    expect(opt(core({ profile: makeProfile() }), 'name-en').done).toBe(false)
  })

  it('이메일 · 국적 · 비상 연락처 — 값 존재로 판정', () => {
    const set = core({
      profile: makeProfile({ email_personal: 'a@b.com', nationality: '대한민국', emergency_phone: '010' }),
    })
    expect(opt(set, 'email').done).toBe(true)
    expect(opt(set, 'nationality').done).toBe(true)
    expect(opt(set, 'emergency').done).toBe(true)
  })

  it('목록형(어학·자격증·수상·경력·경험) — 1건 이상이면 완료', () => {
    const set = core({
      langCerts: [{ id: 'l1' }],
      certs: [{ id: 'c1' }],
      awards: [{ id: 'a1' }],
      experiences: [{ id: 'x1', type: 'intern' }, { id: 'x2', type: 'club' }],
    })
    expect(opt(set, 'language-certs').done).toBe(true)
    expect(opt(set, 'certs').done).toBe(true)
    expect(opt(set, 'awards').done).toBe(true)
    expect(opt(set, 'career').done).toBe(true)
    expect(opt(set, 'experiences').done).toBe(true)

    const empty = core()
    expect(opt(empty, 'language-certs').done).toBe(false)
    expect(opt(empty, 'career').done).toBe(false)
    expect(opt(empty, 'experiences').done).toBe(false)
  })

  it('🔴 경력만 있으면 「경험」은 미완료 (그 반대도) · 유형 없는 활동은 경험 쪽', () => {
    const onlyCareer = core({ experiences: [{ id: 'x1', type: 'fulltime' }] })
    expect(opt(onlyCareer, 'career').done).toBe(true)
    expect(opt(onlyCareer, 'experiences').done).toBe(false)

    const onlyExperience = core({ experiences: [{ id: 'x1', type: 'contest' }] })
    expect(opt(onlyExperience, 'career').done).toBe(false)
    expect(opt(onlyExperience, 'experiences').done).toBe(true)

    const untyped = core({ experiences: [{ id: 'x1' }, { id: 'x2', type: null }] })
    expect(opt(untyped, 'career').done).toBe(false)
    expect(opt(untyped, 'experiences').done).toBe(true)
  })

  it('경력·경험 칩은 각자의 섹션으로 간다', () => {
    expect(opt(core(), 'career').sectionId).toBe('career')
    expect(opt(core(), 'experiences').sectionId).toBe('experiences')
  })

  it('추가 정보 — extra_fields 키 1개 이상', () => {
    expect(opt(core({ profile: makeProfile({ extra_fields: {} }) }), 'extra-fields').done).toBe(false)
    expect(opt(core({ profile: makeProfile({ extra_fields: { hobby: '등산' } }) }), 'extra-fields').done).toBe(true)
  })

  it('🔴 지원 서류 — 슬롯이 있는 문서만 센다 (기타 파일은 자동 채움 대상이 아니다)', () => {
    expect(opt(core({ documents: [{ slot: null }] }), 'documents').done).toBe(false)
    expect(opt(core({ documents: [{ slot: 'resume' }] }), 'documents').done).toBe(true)
  })

  /**
   * 🔴 항목이 있는 서류는 슬롯이 아니라 항목에 붙는다 (CEO 2026-09-05) — 슬롯만 세면
   * 성적증명서를 학력에 붙인 사용자가 영원히 미완료로 남는다.
   */
  it('🔴 지원 서류 — 항목 첨부 1개만 있어도 완료 (슬롯 0)', () => {
    expect(opt(core({ educations: [{ school_name: 'OO대', transcript_file_url: 'https://f/t.pdf' }] }), 'documents').done).toBe(true)
    expect(opt(core({ educations: [{ school_name: 'OO대', graduation_file_url: 'https://f/g.pdf' }] }), 'documents').done).toBe(true)
    // 옛 「기타 증빙」도 첨부는 첨부다
    expect(opt(core({ educations: [{ school_name: 'OO대', file_url: 'https://f/old.pdf' }] }), 'documents').done).toBe(true)
    expect(opt(core({ langCerts: [{ id: 'lc1', file_url: 'https://f/toeic.pdf' }] }), 'documents').done).toBe(true)
    expect(opt(core({ certs: [{ id: 'c1', file_url: 'https://f/cert.pdf' }] }), 'documents').done).toBe(true)
    expect(opt(core({ awards: [{ id: 'a1', file_url: 'https://f/award.pdf' }] }), 'documents').done).toBe(true)
  })

  it('지원 서류 — 파일 없는 항목만 있으면 미완료', () => {
    expect(opt(core({
      educations: [{ school_name: 'OO대' }],
      langCerts: [{ id: 'lc1' }],
      certs: [{ id: 'c1' }],
      awards: [{ id: 'a1' }],
    }), 'documents').done).toBe(false)
  })

  it('🔴 장애 — 동의가 없으면 「선택」 표시이고 완료로 세지 않는다', () => {
    const noConsent = opt(core({ profile: makeProfile({ disability_yn: true }) }), 'disability')
    expect(noConsent.consentRequired).toBe(true)
    expect(noConsent.done).toBe(false)
  })

  it('장애 — 동의 + 값 저장이면 완료 (「비대상」도 저장)', () => {
    const set = core({
      profile: makeProfile({ sensitive_consent_at: '2026-09-05T00:00:00Z', disability_yn: false }),
    })
    expect(opt(set, 'disability').consentRequired).toBeFalsy()
    expect(opt(set, 'disability').done).toBe(true)
  })

  it('optionalDone 은 완료 개수와 같다', () => {
    const set = core({
      profile: makeProfile({ email_personal: 'a@b.com', nationality: '대한민국' }),
      certs: [{ id: 'c1' }],
    })
    expect(set.optionalDone).toBe(3)
  })
})
