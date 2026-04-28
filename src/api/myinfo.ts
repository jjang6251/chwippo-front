import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

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
  file_url?: string
}

export interface Cert {
  id: string
  name: string
  issuer?: string
  cert_number?: string
  acquired_at?: string
  file_url?: string
}

export interface Award {
  id: string
  contest_name: string
  award_name?: string
  org?: string
  awarded_at?: string
  content?: string
  file_url?: string
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
  personality_strength?: string
  personality_weakness?: string
  background?: string
  job_competency?: string
  aspiration?: string
  own_strength?: string
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
  created_at: string
}

export const getDocuments = () => apiClient.get('/myinfo/documents').then(unwrap<MyDocument[]>)
export const createDocument = (dto: { title: string; category?: string; file_url: string }) =>
  apiClient.post('/myinfo/documents', dto).then(unwrap<MyDocument>)
export const deleteDocument = (id: string) =>
  apiClient.delete(`/myinfo/documents/${id}`).then(unwrap<void>)
