import { apiClient } from './client'

export interface AdminUser {
  id: string
  nickname: string
  email: string | null
  role: string
  createdAt: string
  lastActiveAt: string | null
  suspendedAt: string | null
  /** W1 — signup 1 질문 답변. NULL=미답변 / []=skip / [...]=직군 array */
  signupJobCategories: string[] | null
  /** W1 — "기타" 자유 입력 직무명 */
  signupOtherText: string | null
  /**
   * 사용 환경 — 웹/앱 로그인 이력 기반 (서버 `user-platform.ts` 판정).
   *
   * 🔴 **옵셔널이다.** 백엔드가 프론트보다 늦게 뜨는 배포 창에서는 이 필드가 없다
   * (2026-07-31 실사고: 새 필드를 필수로 타이핑하고 바로 읽어 페이지 전체가 죽었다).
   */
  platform?: PlatformUsage
}

export interface PlatformUsage {
  app: boolean
  web: boolean
  /** 푸시 토큰 보유 = 알림이 실제로 닿는다 */
  pushCapable: boolean
}

/** 사용 환경 분포 — 4분류는 서로 배타적이라 합계 = total */
export interface PlatformDistribution {
  total: number
  both: number
  appOnly: number
  webOnly: number
  none: number
  /** 앱 사용자 (appOnly + both) */
  appUsers: number
  /** 그중 푸시가 닿는 인원 */
  pushCapable: number
}

export interface AdminUserStorageStats {
  usedBytes: number
  limitBytes: number
  usedMB: number
  limitMB: number
  percentage: number
}

export interface AdminUserMyinfoCount {
  cert: number
  award: number
  languageCert: number
  experience: number
  coverletterCustom: number
  document: number
  education: number
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const getAdminUsers = (params: {
  page?: number
  limit?: number
  search?: string
  role?: string
  suspended?: boolean
}) =>
  apiClient
    .get<{ data: { data: AdminUser[]; total: number } }>('/admin/users', { params })
    .then(unwrap)

/**
 * 개인정보처리방침 §7 "개인정보 이동 요청" 이행 — 회원 전체 데이터.
 * 응답 envelope(`{data,message}`)를 벗겨 순수 데이터만 돌려준다 — 사용자에게 전달할
 * 파일에 우리 API 형식이 섞이면 안 되기 때문. 서버에서 admin_audit_logs 에 기록된다.
 */
export const exportAdminUser = (id: string) =>
  apiClient
    .post<{ data: AdminUserExportData }>(`/admin/users/${id}/export`, {})
    .then(unwrap)

export interface AdminUserExportData {
  user: Record<string, unknown>
  applications: {
    id: string
    companyName: string
    jobTitle: string | null
    status: string
    currentStepIndex: number
    createdAt: string
  }[]
  inquiries: {
    id: string
    title: string
    status: string
    created_at: string
  }[]
  myinfo: {
    profile: Record<string, unknown> | null
    educations: Record<string, unknown>[]
    experiences: Record<string, unknown>[]
    certs: Record<string, unknown>[]
    languageCerts: Record<string, unknown>[]
    awards: Record<string, unknown>[]
    documents: Record<string, unknown>[]
    coverletters: Record<string, unknown>[]
  }
}
