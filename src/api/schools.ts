import { apiClient } from './client'

export type SchoolKind = 'high' | 'univ'

export interface SchoolSuggestion {
  name: string
  region: string
  address?: string
  /** univ 의 경우 '4년제'|'전문대'|'교육대'|'사이버'|'특수' */
  meta?: string
}

export interface CertSuggestion {
  name: string
  issuer: string
  hasNumber: boolean
  numberExample?: string
  validYears: number | null
  category: string
  popularity: number
}

export interface LangCertSuggestion {
  name: string
  language: string
  issuer: string
  scoreType: 'number' | 'grade'
  /** number 형 만점 (TOEIC=990) */
  scoreMax?: number
  /** grade 형 자격증의 선택 가능 등급 배열 (JLPT: N1~N5) */
  grades?: string[]
  scoreExample: string
  validYears: number | null
  category: string
  popularity: number
}

// 전역 ResponseTransformInterceptor 로 응답이 { data, message } 로 wrap 됨
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const autocompleteSchools = (q: string, kind: SchoolKind, limit = 10) =>
  apiClient
    .get('/schools/autocomplete', { params: { q, kind, limit } })
    .then(unwrap<SchoolSuggestion[]>)

export const autocompleteMajors = (q: string, limit = 10) =>
  apiClient
    .get('/schools/majors/autocomplete', { params: { q, limit } })
    .then(unwrap<string[]>)

export const autocompleteCerts = (q: string, limit = 10) =>
  apiClient
    .get('/schools/certs/autocomplete', { params: { q, limit } })
    .then(unwrap<CertSuggestion[]>)

export const autocompleteLangCerts = (q: string, limit = 10) =>
  apiClient
    .get('/schools/lang-certs/autocomplete', { params: { q, limit } })
    .then(unwrap<LangCertSuggestion[]>)
