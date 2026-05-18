import type { UserProfile, LanguageCert, Cert, Award, Experience, MyDocument, Coverletter, CoverletterData, Education } from '@/api/myinfo'
import type { ExamSchedule } from '@/types/exam-schedule'

export type SectionId =
  | 'profile'
  | 'education'
  | 'military'
  | 'coverletter'
  | 'experiences'
  | 'awards'
  | 'language-certs'
  | 'certs'
  | 'exam-schedules'
  | 'goals'
  | 'files'

export type SectionKind = 'single' | 'multi'

export interface SectionStatus {
  id: SectionId
  kind: SectionKind
  filled: boolean
  count: number
  active: boolean
}

interface Inputs {
  profile?: UserProfile
  educations: Education[]
  langCerts: LanguageCert[]
  certs: Cert[]
  examSchedules: ExamSchedule[]
  awards: Award[]
  experiences: Experience[]
  documents: MyDocument[]
  coverletter?: CoverletterData
}

function profileFilled(p?: UserProfile): boolean {
  if (!p) return false
  return !!(p.name || p.birthdate || p.phone || p.email_personal)
}

function militaryFilled(p?: UserProfile): boolean {
  if (!p) return false
  return !!(p.military_branch || p.military_type || p.military_start || p.military_end || p.military_unit)
}

function goalsFilled(p?: UserProfile): boolean {
  if (!p) return false
  return !!((p.goal_other && p.goal_other.trim()) || p.goal_toeic || (p.goal_certs && p.goal_certs.trim()))
}

function coverletterFilled(cl?: Coverletter): boolean {
  if (!cl) return false
  return !!((cl.personality && cl.personality.trim())
    || (cl.background && cl.background.trim())
    || (cl.job_competency && cl.job_competency.trim())
    || (cl.own_strength && cl.own_strength.trim())
    || (cl.collaboration && cl.collaboration.trim())
    || (cl.challenge && cl.challenge.trim()))
}

export function computeMyinfoSections(input: Inputs): SectionStatus[] {
  const isMale = input.profile?.gender === 'MALE'

  // 학력 — school_name이 채워진 row만 카운트 (빈 row는 자동 생성될 수 있으므로 제외)
  const filledEducations = input.educations.filter((e) => e.school_name && e.school_name.trim())

  // 사이드바 표시 순서 = 사용자 입력 흐름 순서
  const list: SectionStatus[] = [
    { id: 'profile',        kind: 'single', filled: profileFilled(input.profile),                  count: profileFilled(input.profile) ? 1 : 0,         active: true },
    { id: 'education',      kind: 'multi',  filled: filledEducations.length > 0,                   count: filledEducations.length,                      active: true },
    { id: 'military',       kind: 'single', filled: militaryFilled(input.profile),                 count: militaryFilled(input.profile) ? 1 : 0,        active: isMale },
    { id: 'coverletter',    kind: 'single', filled: coverletterFilled(input.coverletter?.coverletter), count: coverletterFilled(input.coverletter?.coverletter) ? 1 : 0, active: true },
    { id: 'experiences',    kind: 'multi',  filled: input.experiences.length > 0,                  count: input.experiences.length,                     active: true },
    { id: 'awards',         kind: 'multi',  filled: input.awards.length > 0,                       count: input.awards.length,                          active: true },
    { id: 'language-certs', kind: 'multi',  filled: input.langCerts.length > 0,                    count: input.langCerts.length,                       active: true },
    { id: 'certs',          kind: 'multi',  filled: input.certs.length > 0,                        count: input.certs.length,                           active: true },
    // ─── 게이지 미포함 그룹 ───
    { id: 'exam-schedules', kind: 'multi',  filled: input.examSchedules.length > 0,                count: input.examSchedules.length,                   active: true },
    { id: 'goals',          kind: 'single', filled: goalsFilled(input.profile),                    count: goalsFilled(input.profile) ? 1 : 0,           active: true },
    { id: 'files',          kind: 'multi',  filled: input.documents.length > 0,                    count: input.documents.length,                       active: true },
  ]

  return list
}

// 게이지 진척도 계산에서 제외할 섹션 — 핵심 이력 데이터가 아니라 미래/계획성·부가 영역
const EXCLUDED_FROM_GAUGE: SectionId[] = ['exam-schedules', 'goals', 'files']

export function computeProgress(sections: SectionStatus[]): { filled: number; total: number; percent: number; firstEmptyId: SectionId | null } {
  const gaugeSections = sections.filter((s) => s.active && !EXCLUDED_FROM_GAUGE.includes(s.id))
  const filled = gaugeSections.filter((s) => s.filled).length
  const total = gaugeSections.length
  const percent = total === 0 ? 0 : Math.round((filled / total) * 100)
  const firstEmpty = gaugeSections.find((s) => !s.filled)?.id ?? null
  return { filled, total, percent, firstEmptyId: firstEmpty }
}

export function isExcludedFromGauge(id: SectionId): boolean {
  return EXCLUDED_FROM_GAUGE.includes(id)
}
