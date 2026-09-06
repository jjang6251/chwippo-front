import type { UserProfile, LanguageCert, Cert, Award, MyDocument, Coverletter, CoverletterData, Education, HighestDegree } from '@/api/myinfo'
import type { ExamSchedule } from '@/types/exam-schedule'
import { isCareerType } from '@/types/activity'
import type { ActivityType } from '@/types/activity'
import { GRAD_DEGREES, THESIS_FIELD_KEYS } from '@/utils/thesisFields'

/**
 * 최종 학력 ↔ 그 단계의 학력 항목 `degree` 문자열.
 *
 * 🔴 게이지가 「최종 학력」을 세는 기준이 여기다 — 학사라고 골라 놓고 고등학교만 넣은
 * 사용자는 **아직 채운 게 아니다** (지원서의 최종 학력 칸이 안 채워진다).
 */
export const HIGHEST_DEGREE_TO_EDU: Record<HighestDegree, string> = {
  high: '고등학교',
  associate: '전문대',
  bachelor: '대학교 (학사)',
  master: '대학원 (석사)',
  doctor: '대학원 (박사)',
}

export type SectionId =
  | 'profile'
  | 'education'
  | 'thesis'
  | 'military'
  | 'coverletter'
  | 'career'
  | 'experiences'
  | 'awards'
  | 'language-certs'
  | 'certs'
  | 'extras'
  | 'exam-schedules'
  | 'goals'
  | 'files'

export type SectionKind = 'single' | 'multi'

/**
 * 창고가 활동에서 읽는 최소한 — 개수(`id`)와 경력/경험 갈래(`type`)뿐이다.
 * (spec 이 `Activity` 전체 픽스처를 지어내지 않아도 되게 하려는 의도다)
 */
export interface ActivityItem {
  id: string
  type?: ActivityType | null
}

/** 경력 = `CAREER_TYPES` 유형의 활동, 경험 = 그 나머지 (CEO 2026-09-06) */
const splitActivities = (items: ActivityItem[]) => ({
  career: items.filter((a) => isCareerType(a.type)),
  experience: items.filter((a) => !isCareerType(a.type)),
})

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
  /**
   * 경력·경험 항목 — 이제 **활동(`Activity`) 목록**이다 (계획 A′로 저장소가 하나가 됐다).
   * 개수와 **경력/경험 판정**만 필요하므로 id·type 만 요구한다 — 옛 `myinfo experiences` 는
   * 더 안 읽는다.
   */
  experiences: ActivityItem[]
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

/**
 * 우대·기타 — 보훈·장애 중 하나라도 손을 댔는가.
 *
 * 「비대상」을 저장한 것도 **채운 것**이다(지원서에 그대로 채워진다). 그래서 값의 참/거짓이
 * 아니라 **존재 여부**(`!= null`)로 본다. 게이지 분모에는 안 들어가지만 사이드바 ✓ 는 뜬다.
 *
 * 🔴 `extra_fields` 는 더 이상 여기서 세지 않는다 — 옛 「추가 정보」 블록이 없어지고 그 자리는
 * 대학원 4키(논문 섹션)가 쓴다. 논문만 채운 사용자에게 우대·기타 ✓ 가 뜨면 거짓말이 된다.
 */
function extrasFilled(p?: UserProfile): boolean {
  if (!p) return false
  return (
    p.patriot_yn != null ||
    p.disability_yn != null ||
    !!p.sensitive_consent_at
  )
}

/**
 * 논문 — 대학원 4키 중 하나라도 채웠는가. 사이드바 ✓ 용이다.
 * (게이지 분모에는 안 들어간다 — `EXCLUDED_FROM_GAUGE`. 석·박사에게만 있는 칸이라
 *  분모에 넣으면 학사 지원자의 진척도가 채울 수 없는 칸 때문에 깎인다.)
 */
function thesisFilled(p?: UserProfile): boolean {
  const extra = p?.extra_fields ?? {}
  return THESIS_FIELD_KEYS.some((k) => !!extra[k]?.trim())
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
  const degree = input.profile?.highest_degree
  const isGrad = !!degree && (GRAD_DEGREES as readonly string[]).includes(degree)

  // 학력 — school_name이 채워진 row만 카운트 (빈 row는 자동 생성될 수 있으므로 제외)
  const filledEducations = input.educations.filter((e) => e.school_name && e.school_name.trim())

  const activities = splitActivities(input.experiences)

  // 사이드바 표시 순서 = 사용자 입력 흐름 순서
  const list: SectionStatus[] = [
    { id: 'profile',        kind: 'single', filled: profileFilled(input.profile),                  count: profileFilled(input.profile) ? 1 : 0,         active: true },
    { id: 'education',      kind: 'multi',  filled: filledEducations.length > 0,                   count: filledEducations.length,                      active: true },
    // 논문 — 석·박사에게만 (사이드바 ✓ 전용, 게이지 분모에는 안 들어간다)
    { id: 'thesis',         kind: 'single', filled: thesisFilled(input.profile),                   count: thesisFilled(input.profile) ? 1 : 0,          active: isGrad },
    { id: 'military',       kind: 'single', filled: militaryFilled(input.profile),                 count: militaryFilled(input.profile) ? 1 : 0,        active: isMale },
    { id: 'coverletter',    kind: 'single', filled: coverletterFilled(input.coverletter?.coverletter), count: coverletterFilled(input.coverletter?.coverletter) ? 1 : 0, active: true },
    { id: 'career',         kind: 'multi',  filled: activities.career.length > 0,                  count: activities.career.length,                     active: true },
    { id: 'experiences',    kind: 'multi',  filled: activities.experience.length > 0,              count: activities.experience.length,                 active: true },
    { id: 'awards',         kind: 'multi',  filled: input.awards.length > 0,                       count: input.awards.length,                          active: true },
    { id: 'language-certs', kind: 'multi',  filled: input.langCerts.length > 0,                    count: input.langCerts.length,                       active: true },
    { id: 'certs',          kind: 'multi',  filled: input.certs.length > 0,                        count: input.certs.length,                           active: true },
    // ─── 게이지 미포함 그룹 ───
    { id: 'extras',         kind: 'single', filled: extrasFilled(input.profile),                   count: extrasFilled(input.profile) ? 1 : 0,          active: true },
    { id: 'exam-schedules', kind: 'multi',  filled: input.examSchedules.length > 0,                count: input.examSchedules.length,                   active: true },
    { id: 'goals',          kind: 'single', filled: goalsFilled(input.profile),                    count: goalsFilled(input.profile) ? 1 : 0,           active: true },
    { id: 'files',          kind: 'multi',  filled: input.documents.length > 0,                    count: input.documents.length,                       active: true },
  ]

  return list
}

// 게이지 진척도 계산에서 제외할 섹션 — 핵심 이력 데이터가 아니라 미래/계획성·부가 영역.
// 🔴 'extras'(우대·기타)도 여기 있다 — 보훈·장애는 **대부분 비대상**이라 분모에 넣으면
//    채워질 일 없는 칸이 진척도를 영원히 깎는다. 분모는 이 추가로 **바뀌지 않는다**.
// 🔴 'thesis'(논문)도 같은 이유 — 석·박사에게만 있는 칸이라 분모에 넣으면 사람마다 분모가
//    달라진다. 사이드바 ✓ 만 쓴다.
const EXCLUDED_FROM_GAUGE: SectionId[] = ['thesis', 'extras', 'exam-schedules', 'goals', 'files']

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

// ── 지원서 기본 세트 ──────────────────────────────────────
/**
 * 「확장을 쓰려면 이걸 다 채워야 하나」에 **화면으로 답한다** — 기본 7개면 된다.
 *
 * 근거: `company/01_product/autofill-census-2026-09.md` 최종 매트릭스(11곳 실측).
 * 이름 10 · 휴대폰 10 · 보훈 9 · 병역 9 · 주소 8 · 학력 8 — 폼 절반 이상이 묻는 칸만
 * 분모에 넣는다. 「N/8 섹션」은 섹션 수를 세던 것이라 **자소서 소재·시험 일정처럼
 * 지원서와 무관한 것**까지 진척도로 읽혔다.
 */
export type CoreItemId =
  | 'name' | 'phone' | 'birthdate' | 'address' | 'education' | 'military' | 'patriot'

/**
 * 칩을 눌렀을 때 섹션이 해야 할 일.
 *
 * 🔴 왜 「스크롤」로 안 끝나나: 칩은 「이 칸이 비었어요」라고 말하는데, 눌러서 도착한 곳이
 * **보기 모드의 빈 줄**이면 사용자는 [편집] 을 한 번 더 찾아야 한다. 칩이 데려간 자리는
 * 바로 **쓸 수 있는 칸**이어야 한다.
 */
export interface JumpOptions {
  /** 보기 모드 대신 편집 폼으로 연다 (인적사항·병역) / 학력은 추가 모달을 연다 */
  edit?: boolean
  /** 도착하자마자 포커스·스크롤할 칸 — 섹션이 아는 키 (`name` 속성) */
  focus?: string
}

export interface CoreItem {
  id: CoreItemId
  label: string
  done: boolean
  /** 칩을 눌렀을 때 이동할 섹션 */
  sectionId: SectionId
  /** 도착한 섹션이 할 일 — 없으면 펴고 스크롤만 */
  jump?: JumpOptions
  /** 못 채운 이유가 다른 칸에 있을 때 (병역 ← 성별) */
  hint?: string
}

/**
 * 🔴 옛 `'extra-fields'`(추가 정보)는 뺐다 — 취미·특기 같은 칸을 없앴으므로 셀 것이 없다.
 * 대학원 4키는 조건부(석·박사)라 「있으면 좋아요」 목록에 넣지 않는다: 학사 지원자에게
 * 영원히 안 채워지는 항목이 하나 늘 뿐이다.
 */
export type OptionalItemId =
  | 'name-en' | 'email' | 'nationality' | 'emergency'
  | 'language-certs' | 'certs' | 'awards' | 'career' | 'experiences'
  | 'documents' | 'disability'

export interface OptionalItem {
  id: OptionalItemId
  label: string
  done: boolean
  sectionId: SectionId
  /** 기본 세트 칩과 같은 규칙 — 눌러 간 자리가 바로 쓸 수 있는 칸이어야 한다 */
  jump?: JumpOptions
  /** 동의 없이는 채울 자리 자체가 없다 — 빈 원 대신 「선택」 */
  consentRequired?: boolean
}

export interface CoreSet {
  items: CoreItem[]
  done: number
  total: number
  percent: number
  /** 첫 미완료 항목의 섹션 — 게이지 카드의 이동 대상 */
  firstEmptyId: SectionId | null
  optional: OptionalItem[]
  optionalDone: number
  optionalTotal: number
}

/**
 * 구조적 최소 입력 — 목록은 **개수만** 쓰므로 `id` 하나면 충분하다 (활동만 경력/경험
 * 갈래 때문에 `type` 을 함께 본다).
 * (spec 이 전체 픽스처를 지어내지 않아도 되게 하려는 의도다)
 */
export interface CoreSetInput {
  profile?: UserProfile
  /** 학력은 증명서 2칸 + 옛 「기타 증빙」 1칸을 가진다 */
  educations: {
    school_name?: string
    /** 최종 학력 판정에 쓴다 — 고른 단계의 학교가 실제로 있는가 */
    degree?: string
    file_url?: string | null
    transcript_file_url?: string | null
    graduation_file_url?: string | null
  }[]
  langCerts: { id: string; file_url?: string | null }[]
  certs: { id: string; file_url?: string | null }[]
  awards: { id: string; file_url?: string | null }[]
  /** 경력·경험이 한 목록으로 들어와 `type` 으로 갈린다 (저장소는 `activities` 하나) */
  experiences: ActivityItem[]
  documents: { slot?: string | null }[]
}

const has = (v?: string | null): boolean => !!(v && v.trim())

/**
 * 「지원 서류」를 채웠는가 — 슬롯 1개 **또는** 항목 첨부 1개.
 *
 * 🔴 항목이 있는 서류(어학 성적표·성적/졸업증명서)는 슬롯이 아니라 항목에 붙는다
 * (CEO 2026-09-05). 슬롯만 세면 성적증명서를 학력에 붙인 사용자가 영원히 미완료로 남는다.
 */
function documentsFilled(input: CoreSetInput): boolean {
  if (input.documents.some((d) => !!d.slot)) return true
  if (input.educations.some((e) => has(e.transcript_file_url) || has(e.graduation_file_url) || has(e.file_url))) return true
  return [...input.langCerts, ...input.certs, ...input.awards].some((i) => has(i.file_url))
}

export function computeCoreSet(input: CoreSetInput): CoreSet {
  const p = input.profile
  /** 성별을 아직 저장하지 않았으면 병역 칸의 운명이 정해지지 않는다 */
  const genderSaved = !!p?.gender
  const isMale = p?.gender === 'MALE'

  /**
   * 「최종 학력」 = 고른 단계(`highest_degree`) + **그 단계의 학교 1건 이상**.
   * 학교만 있고 단계를 안 골랐으면 지원서의 최종 학력 칸을 채울 수 없으므로 미완료다.
   */
  const highest = p?.highest_degree
  const educationDone = !!highest && input.educations.some(
    (e) => has(e.school_name) && e.degree === HIGHEST_DEGREE_TO_EDU[highest],
  )
  /**
   * 병역 3분기 — 남성은 상태 저장이 필요하고, 그 외 성별은 **자동 완료**(폼의 병역 칸이
   * 「해당 없음」으로 채워진다). 성별 자체가 없으면 판정을 못 해 미완료다.
   */
  const militaryDone = !genderSaved ? false : isMale ? p?.military_status != null : true

  /** 인적사항 칩은 전부 「편집 모드 + 그 칸 포커스」로 간다 */
  const toProfile = (focus: string): JumpOptions => ({ edit: true, focus })

  const items: CoreItem[] = [
    { id: 'name',      label: '이름',      done: has(p?.name),                          sectionId: 'profile', jump: toProfile('name') },
    { id: 'phone',     label: '연락처',    done: has(p?.phone),                         sectionId: 'profile', jump: toProfile('phone') },
    { id: 'birthdate', label: '생년월일',  done: has(p?.birthdate),                     sectionId: 'profile', jump: toProfile('birthdate') },
    // 주소는 우편번호부터 — 검색 버튼이 그 칸 옆에 있다
    { id: 'address',   label: '주소',      done: has(p?.address_zip) && has(p?.address_base), sectionId: 'profile', jump: toProfile('address_zip') },
    // 학력은 「편집」이 곧 추가 모달이다 (고른 최종 학력 단계가 미리 들어간다)
    { id: 'education', label: '최종 학력', done: educationDone,                         sectionId: 'education', jump: { edit: true } },
    {
      id: 'military',
      label: '병역',
      done: militaryDone,
      // 성별이 없으면 병역 섹션이 아니라 **성별을 고르는 자리**로 보낸다
      sectionId: genderSaved ? 'military' : 'profile',
      jump: genderSaved ? { edit: true } : toProfile('gender'),
      hint: genderSaved ? undefined : '성별을 고르면 병역 칸은 알아서 처리해요',
    },
    // 「비대상」 저장도 채운 것이다 — 값의 참/거짓이 아니라 존재 여부로 본다
    { id: 'patriot',   label: '보훈 여부', done: p?.patriot_yn != null,                 sectionId: 'extras', jump: { focus: 'patriot' } },
  ]

  const consented = !!p?.sensitive_consent_at
  /** 지원서는 「경력사항」과 「대외활동」을 다른 칸으로 묻는다 — 목록도 둘로 센다 */
  const activities = splitActivities(input.experiences)
  const optional: OptionalItem[] = [
    { id: 'name-en',        label: '영문 이름',   done: has(p?.name_en_last) || has(p?.name_en_first), sectionId: 'profile', jump: toProfile('name_en_last') },
    { id: 'email',          label: '이메일',      done: has(p?.email_personal),          sectionId: 'profile', jump: toProfile('email_personal') },
    { id: 'nationality',    label: '국적',        done: has(p?.nationality),             sectionId: 'profile', jump: toProfile('nationality') },
    { id: 'emergency',      label: '비상 연락처', done: has(p?.emergency_phone),         sectionId: 'profile', jump: toProfile('emergency_phone') },
    { id: 'language-certs', label: '어학',        done: input.langCerts.length > 0,      sectionId: 'language-certs' },
    { id: 'certs',          label: '자격증',      done: input.certs.length > 0,          sectionId: 'certs' },
    { id: 'awards',         label: '수상',        done: input.awards.length > 0,         sectionId: 'awards' },
    { id: 'career',         label: '경력',        done: activities.career.length > 0,    sectionId: 'career' },
    { id: 'experiences',    label: '경험',        done: activities.experience.length > 0, sectionId: 'experiences' },
    { id: 'documents',      label: '지원 서류',   done: documentsFilled(input),          sectionId: 'files' },
    {
      id: 'disability',
      label: '장애 정보',
      done: consented && p?.disability_yn != null,
      sectionId: 'extras',
      jump: { focus: 'disability' },
      consentRequired: !consented,
    },
  ]

  const done = items.filter((i) => i.done).length
  const total = items.length
  return {
    items,
    done,
    total,
    percent: Math.round((done / total) * 100),
    firstEmptyId: items.find((i) => !i.done)?.sectionId ?? null,
    optional,
    optionalDone: optional.filter((o) => o.done).length,
    optionalTotal: optional.length,
  }
}
