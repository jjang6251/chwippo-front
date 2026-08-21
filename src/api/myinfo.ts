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
export interface UserProfile {
  user_id: string
  name?: string
  name_hanja?: string
  gender?: 'MALE' | 'FEMALE'
  birthdate?: string
  phone?: string
  email_personal?: string
  military_branch?: string
  military_type?: string
  military_start?: string
  military_end?: string
  military_unit?: string
  goal_toeic?: number
  goal_certs?: string
  goal_other?: string
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
}

export interface Cert {
  id: string
  name: string
  issuer?: string
  cert_number?: string
  acquired_at?: string
  expires_at?: string
  file_url?: string
  file_size_bytes?: number | null
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
export const updateProfile = (dto: Partial<UserProfile>) =>
  apiClient.patch('/myinfo/profile', dto).then(unwrap<UserProfile>)

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
  file_url?: string
  file_size_bytes?: number | null
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
export interface MyDocument {
  id: string
  title: string
  category?: string
  file_url: string
  file_size_bytes?: number | null
  created_at: string
}

export const getDocuments = () => apiClient.get('/myinfo/documents').then(unwrap<MyDocument[]>)
export const createDocument = (dto: {
  title: string
  category?: string
  file_url: string
  file_size_bytes?: number
}) => apiClient.post('/myinfo/documents', dto).then(unwrap<MyDocument>)
export const deleteDocument = (id: string) =>
  apiClient.delete(`/myinfo/documents/${id}`).then(unwrap<void>)
