import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

// ── Storage Usage ─────────────────────────────────────────

/**
 * 100MB 한 통을 무엇이 채우고 있나. 불변식: `usedBytes === myinfoBytes + noteImageBytes`.
 */
export interface StorageBreakdown {
  /** 내 정보 창고 증빙 파일 */
  myinfoBytes: number
  /** 공부 노트 본문 이미지 */
  noteImageBytes: number
}

export interface StorageUsage {
  usedBytes: number
  limitBytes: number
  usedMB: number
  limitMB: number
  percentage: number
  /**
   * 🔴 optional — 프론트가 백엔드보다 먼저 나가는 창이 열려 있다. 없는 동안에는 분해 줄을
   * 접고 경고 문구도 「어느 쪽」을 단정하지 않는다 (없는 값으로 한쪽을 고르면 거짓말이 된다).
   */
  breakdown?: StorageBreakdown
}
export const getStorageUsage = () =>
  apiClient.get('/myinfo/storage-usage').then(unwrap<StorageUsage>)

// ── Types ─────────────────────────────────────────────────

/**
 * 병역 상태 9종 — 지원서 폼 11곳 합집합(현대차 9 · 현대카드 6 · 우리은행 4).
 * 기본값은 `not_applicable`(비대상) — 대부분의 사용자는 여기서 손을 대지 않는다.
 */
export type MilitaryStatus =
  | 'not_applicable'
  | 'completed'
  | 'not_completed'
  | 'exempted'
  | 'serving'
  | 'discharge_expected'
  | 'alt_service_serving'
  | 'alt_service_completed'
  | 'medical_discharge'

/** 제대 구분 */
export type MilitaryDischarge =
  | 'honorable'
  | 'medical'
  | 'dishonorable'
  | 'release_from_call'
  | 'wounded'
  | 'other'

/** 보훈 대상과의 관계 */
export type PatriotRelation = 'self' | 'family' | 'bereaved'

/** 장애 정도 (심한 / 심하지 않은) */
export type DisabilityGrade = 'severe' | 'mild'

/**
 * 최종 학력 — 학력 섹션이 **필요한 학교 칸만** 보여주기 위한 기준값.
 * 항목(`Education`)이 아니라 프로필에 두는 이유: 「내 최종 학력」은 학교 한 건의 속성이
 * 아니라 사람의 속성이고, 편입·복수 학교가 있어도 답은 하나여야 한다.
 */
export type HighestDegree = 'high' | 'associate' | 'bachelor' | 'master' | 'doctor'

/** 고등학교 계열 — 지원서가 인문/자연/예체능/특성화로 묻는다 */
export type EducationTrack = 'humanities' | 'natural' | 'arts' | 'vocational' | 'other'

export interface UserProfile {
  user_id: string
  name?: string
  name_hanja?: string
  /** 영문 이름 (성) — 지원서 8/11 이 성/이름을 분리 입력받는다 */
  name_en_last?: string
  /** 영문 이름 (이름) */
  name_en_first?: string
  gender?: 'MALE' | 'FEMALE'
  birthdate?: string
  phone?: string
  email_personal?: string

  // ── 주소 (지원서 8/11) ──
  address_zip?: string
  address_base?: string
  address_detail?: string
  /**
   * 17 시/도 — **짧은 이름**(「서울」·「경기」·「강원」). 백엔드 `ADDRESS_REGIONS` 가
   * 완전 일치만 받고 그 외에는 400 이다. 반드시 `@/utils/koreaRegions` 의
   * `normalizeRegion` 을 거친 값만 넣는다 (정식 표기를 그대로 보내면 저장이 막힌다).
   */
  address_region?: string

  // ── 국적 · 비상연락처 ──
  nationality?: string
  nationality_2?: string
  emergency_phone?: string
  emergency_relation?: string

  // ── 보훈 (지원서 9/11) ──
  patriot_yn?: boolean
  patriot_number?: string
  patriot_relation?: PatriotRelation
  /** 가점 비율 0 · 5 · 10 */
  patriot_rate?: number

  /**
   * ── 장애 (민감정보) ──
   * 🔴 PATCH 시 **`sensitive_consent: true` 를 함께** 보내야 저장된다.
   * 동의 없이 보내면 백엔드가 400 「민감정보 동의가 필요해요」로 거절한다.
   */
  disability_yn?: boolean
  disability_grade?: DisabilityGrade
  disability_type?: string
  disability_number?: string
  /** 민감정보 별도 동의 시각 — 서버가 기록. 이 값이 있으면 장애 칸을 연다 */
  sensitive_consent_at?: string

  // ── 병역 ──
  military_status?: MilitaryStatus
  military_branch?: string
  military_rank?: string
  /** 병과 — 옛 `military_unit` 를 이 칸으로 옮겨 왔다 (둘 다 저장해 하위 호환 유지) */
  military_specialty?: string
  military_discharge?: MilitaryDischarge
  military_exempt_reason?: string
  /** @deprecated `military_discharge` 로 대체 — 하위 호환 위해 같이 쓴다 */
  military_type?: string
  military_start?: string
  military_end?: string
  /** @deprecated `military_specialty` 로 대체 — 하위 호환 위해 같이 쓴다 */
  military_unit?: string

  /** 최종 학력 — 학력 섹션이 이걸로 필요한 학교 칸만 편다 */
  highest_degree?: HighestDegree

  /** 필드 사전의 `storage: 'extra'` 항목 — 중첩 없는 문자열 맵 */
  extra_fields?: Record<string, string>

  goal_toeic?: number
  goal_certs?: string
  goal_other?: string
}

/**
 * 프로필 PATCH body — 민감정보(장애 4필드)를 담을 때만 `sensitive_consent: true` 를 얹는다.
 * 동의 플래그는 프로필 필드가 아니라 **요청 단위 신호**라서 `UserProfile` 밖에 둔다.
 */
export type UpdateProfileDto = {
  // `null` = 그 칸을 비운다 (빈 문자열이 아니라 null 을 보내는 게 이 API 의 관례)
  [K in keyof Omit<UserProfile, 'user_id'>]?: UserProfile[K] | null
} & {
  sensitive_consent?: boolean
}

export interface LanguageCert {
  id: string
  cert_type: string
  score_grade?: string
  issuer?: string
  cert_number?: string
  acquired_at?: string
  expires_at?: string
  file_url?: string
  file_size_bytes?: number | null
  /** 응답 전용 — 지원서에 넣을 때 붙일 이름 (`홍길동_TOEIC_성적표.pdf`). 서버가 짓는다 */
  suggested_file_name?: string | null
}

export interface Cert {
  id: string
  name: string
  /** 등급 — 「기사」·「1급」처럼 자격증명과 별개로 묻는 폼이 있다 (≤40) */
  grade?: string
  issuer?: string
  cert_number?: string
  acquired_at?: string
  expires_at?: string
  file_url?: string
  file_size_bytes?: number | null
  /** 응답 전용 — 지원서에 넣을 때 붙일 이름 (`홍길동_정보처리기사.pdf`). 서버가 짓는다 */
  suggested_file_name?: string | null
}

export interface Award {
  id: string
  contest_name: string
  award_name?: string
  org?: string
  awarded_at?: string
  content?: string
  file_url?: string
  file_size_bytes?: number | null
  /** 응답 전용 — 지원서에 넣을 때 붙일 이름 (`홍길동_대학생광고공모전_상장.jpg`). 서버가 짓는다 */
  suggested_file_name?: string | null
}

export interface Experience {
  id: string
  activity_name: string
  org?: string
  start_at?: string
  end_at?: string
  content?: string
}

export interface CoverletterCustom {
  id: string
  label: string
  content?: string
  order_index: number
}

export interface Coverletter {
  personality?: string       // 성격 장단점
  background?: string        // 성장 배경
  job_competency?: string    // 직무 역량·핵심 경험
  own_strength?: string      // 나만의 강점
  collaboration?: string     // 갈등 해결·협업 경험
  challenge?: string         // 도전·실패 경험
}

export interface CoverletterData {
  coverletter: Coverletter
  custom: CoverletterCustom[]
}

// ── Profile ───────────────────────────────────────────────
export const getProfile = () => apiClient.get('/myinfo/profile').then(unwrap<UserProfile>)
export const updateProfile = (dto: UpdateProfileDto) =>
  apiClient.patch('/myinfo/profile', dto).then(unwrap<UserProfile>)

// ── 필드 사전 · 추가 정보 슬롯 ────────────────────────────
/**
 * 「예상 못 한 칸」 대응(컨셉 §14). 서버 사전이 **단일 진실**이고 내 정보 「추가 정보」는
 * 그걸 읽어 동적으로 그린다 — 새 항목이 늘어도 프론트 배포가 필요 없다.
 *
 * 🔴 `sensitive`·`forbidden` 항목은 **슬롯에 저장하지 않는다** (민감정보는 정식 컬럼 +
 * 별도 동의, 주민번호류는 아예 자리가 없다). 프론트도 렌더에서 걸러 준다.
 */
export interface FieldDictionaryEntry {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'bool'
  options?: string[]
  maxLength?: number
  sensitive?: boolean
  forbidden?: boolean
  storage: 'column' | 'extra'
}

export interface FieldDictionary {
  version: string
  fields: FieldDictionaryEntry[]
}

export const getFieldDictionary = () =>
  apiClient.get('/myinfo/field-dictionary').then(unwrap<FieldDictionary>)

/** 값에 `null` 을 넣으면 그 키를 지운다 */
export const updateExtraFields = (dto: Record<string, string | null>) =>
  apiClient.patch('/myinfo/extra-fields', dto).then(unwrap<Record<string, string>>)

// ── Language Certs ────────────────────────────────────────
export const getLangCerts = () => apiClient.get('/myinfo/language-certs').then(unwrap<LanguageCert[]>)
export const createLangCert = (dto: Omit<LanguageCert, 'id'>) =>
  apiClient.post('/myinfo/language-certs', dto).then(unwrap<LanguageCert>)
export const updateLangCert = (id: string, dto: Partial<LanguageCert>) =>
  apiClient.patch(`/myinfo/language-certs/${id}`, dto).then(unwrap<LanguageCert>)
export const deleteLangCert = (id: string) =>
  apiClient.delete(`/myinfo/language-certs/${id}`).then(unwrap<void>)

// ── Certs ─────────────────────────────────────────────────
export const getCerts = () => apiClient.get('/myinfo/certs').then(unwrap<Cert[]>)
export const createCert = (dto: Omit<Cert, 'id'>) =>
  apiClient.post('/myinfo/certs', dto).then(unwrap<Cert>)
export const updateCert = (id: string, dto: Partial<Cert>) =>
  apiClient.patch(`/myinfo/certs/${id}`, dto).then(unwrap<Cert>)
export const deleteCert = (id: string) =>
  apiClient.delete(`/myinfo/certs/${id}`).then(unwrap<void>)

// ── Awards ────────────────────────────────────────────────
export const getAwards = () => apiClient.get('/myinfo/awards').then(unwrap<Award[]>)
export const createAward = (dto: Omit<Award, 'id'>) =>
  apiClient.post('/myinfo/awards', dto).then(unwrap<Award>)
export const updateAward = (id: string, dto: Partial<Award>) =>
  apiClient.patch(`/myinfo/awards/${id}`, dto).then(unwrap<Award>)
export const deleteAward = (id: string) =>
  apiClient.delete(`/myinfo/awards/${id}`).then(unwrap<void>)

// ── Experiences ───────────────────────────────────────────
/**
 * ⚠️ **호출처 0** — 내 정보 「경험」은 계획 A′로 활동(`Activity`)만 쓴다(2026-09-05).
 * 백엔드 라우트·테이블은 아직 살아 있고(2단계 릴리즈), 제거는 tasks `F5-M5` 의 몫이다.
 * 새 코드에서 쓰지 말 것.
 */
export const getExperiences = () => apiClient.get('/myinfo/experiences').then(unwrap<Experience[]>)
export const createExperience = (dto: Omit<Experience, 'id'>) =>
  apiClient.post('/myinfo/experiences', dto).then(unwrap<Experience>)
export const updateExperience = (id: string, dto: Partial<Experience>) =>
  apiClient.patch(`/myinfo/experiences/${id}`, dto).then(unwrap<Experience>)
export const deleteExperience = (id: string) =>
  apiClient.delete(`/myinfo/experiences/${id}`).then(unwrap<void>)

// ── Educations ────────────────────────────────────────────
export interface EducationMinor {
  type: string    // 복수전공/부전공/이중전공/연계전공/심화전공
  name: string
  gpa?: string
  gpa_max?: string
}
/** 본교 / 분교 */
export type CampusType = 'main' | 'branch'
/** 주간 / 야간 */
export type DayNight = 'day' | 'night'
/** 입학 / 편입 / 타교 편입 */
export type AdmissionType = 'regular' | 'transfer' | 'transfer_other'

export interface Education {
  id: string
  school_name: string
  major?: string
  minor?: string          // deprecated — minors로 대체
  minors?: EducationMinor[] | null
  degree?: string         // 고등학교/전문대/대학교 (학사)/대학원 (석사)/대학원 (박사)/기타
  gpa?: string
  gpa_max?: string
  start_at?: string
  end_at?: string
  status?: string         // 재학중/졸업/졸업예정/휴학/수료/편입/중퇴
  location?: string
  /**
   * 옛 「기타 증빙」 — 구분 없이 한 칸이던 시절의 데이터.
   * 🔴 **새로 올리는 자리가 아니다** (읽기 + 삭제만). 새 첨부는 아래 두 칸으로 간다.
   */
  file_url?: string
  file_size_bytes?: number | null
  // ── 항목에 붙는 서류 2칸 (슬롯과 이중 저장을 막는다 — 원본은 여기가 유일) ──
  transcript_file_url?: string | null
  transcript_file_size_bytes?: number | null
  graduation_file_url?: string | null
  graduation_file_size_bytes?: number | null
  /** 응답 전용 — 지원서에 넣을 때 붙일 이름. 서버가 짓는다 */
  transcript_suggested_file_name?: string | null
  graduation_suggested_file_name?: string | null
  // ── 지원서 폼 실측으로 추가된 칸 (8/11 출현) ──
  campus_type?: CampusType
  day_night?: DayNight
  admission_type?: AdmissionType
  /** 총 이수 학점 */
  total_credits?: number
  /** 검정고시 — 고등학교에서만 의미 있다 */
  is_ged?: boolean
  /** 계열 — 고등학교에서만 의미 있다 (인문·자연·예체능·특성화·기타) */
  track?: EducationTrack
  /** 해외 학교의 국가 (≤60). 비어 있으면 국내 */
  country?: string
}
export const getEducations = () => apiClient.get('/myinfo/educations').then(unwrap<Education[]>)
export const createEducation = (dto: Omit<Education, 'id'>) =>
  apiClient.post('/myinfo/educations', dto).then(unwrap<Education>)
export const updateEducation = (id: string, dto: Partial<Education>) =>
  apiClient.patch(`/myinfo/educations/${id}`, dto).then(unwrap<Education>)
export const deleteEducation = (id: string) =>
  apiClient.delete(`/myinfo/educations/${id}`).then(unwrap<void>)

// ── Coverletter ───────────────────────────────────────────
export const getCoverletter = () => apiClient.get('/myinfo/coverletter').then(unwrap<CoverletterData>)
export const updateCoverletter = (dto: Partial<Coverletter>) =>
  apiClient.patch('/myinfo/coverletter', dto).then(unwrap<Coverletter>)
export const createCustomItem = (label: string, order_index: number) =>
  apiClient.post('/myinfo/coverletter/custom', { label, order_index }).then(unwrap<CoverletterCustom>)
export const updateCustomItem = (id: string, dto: Partial<CoverletterCustom>) =>
  apiClient.patch(`/myinfo/coverletter/custom/${id}`, dto).then(unwrap<CoverletterCustom>)
export const deleteCustomItem = (id: string) =>
  apiClient.delete(`/myinfo/coverletter/custom/${id}`).then(unwrap<void>)

// ── Documents ─────────────────────────────────────────────
/**
 * 지원서에 그대로 첨부되는 **고정 슬롯 4종**. 실측 11곳 중 5곳이 파일 첨부를 요구하고
 * (`autofill-census-2026-09.md`), 요구하는 종류가 사이트 간 거의 같다 — 그래서 자유
 * 업로드가 아니라 자리를 미리 만들어 둔다. `null` 이면 옛 「기타 파일」(자유 업로드).
 *
 * 🔴 **항목이 있는 서류는 슬롯이 아니라 항목에 붙인다** (CEO 2026-09-05). 어학 성적표는
 * 어학 항목, 성적·졸업증명서는 학력 항목이 원본이다 — 슬롯을 같이 두면 같은 서류가 두 군데
 * 저장돼 어느 쪽이 최신인지 알 수 없다. 지운 슬롯(`transcript`·`graduation`·`language_score`)
 * 으로 PUT 하면 서버가 400 을 준다.
 */
export type DocumentSlot =
  | 'photo'
  | 'resume'
  | 'portfolio'
  | 'career_statement'

export interface MyDocument {
  id: string
  title: string
  category?: string
  /** 🔴 링크만 등록한 포트폴리오에는 파일이 없다 */
  file_url?: string | null
  file_size_bytes?: number | null
  created_at: string
  slot?: DocumentSlot | null
  /** 포트폴리오 전용 — 파일 **또는** 링크 */
  link_url?: string | null
  /** 사용자가 올린 원본 파일명 (R2 키가 아니라 사람이 읽는 이름) */
  original_name?: string | null
  mime?: string | null
  /** 지원서에 넣을 때 붙일 이름 — 서버가 짓는다 (`홍길동_이력서.pdf`) */
  suggested_file_name?: string | null
}

/** 슬롯 업서트 body — 서버가 camelCase 로 받고 snake_case 로 돌려준다 */
export interface PutDocumentSlotDto {
  fileUrl?: string
  fileSize?: number
  originalName?: string
  mime?: string
  linkUrl?: string
}

export const putDocumentSlot = (slot: DocumentSlot, dto: PutDocumentSlotDto) =>
  apiClient.put(`/myinfo/documents/slot/${slot}`, dto).then(unwrap<MyDocument>)

export const getDocuments = () => apiClient.get('/myinfo/documents').then(unwrap<MyDocument[]>)
export const createDocument = (dto: {
  title: string
  category?: string
  file_url: string
  file_size_bytes?: number
}) => apiClient.post('/myinfo/documents', dto).then(unwrap<MyDocument>)
export const deleteDocument = (id: string) =>
  apiClient.delete(`/myinfo/documents/${id}`).then(unwrap<void>)
