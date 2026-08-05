import { apiClient } from '@/api/client'
import type { PlatformUsage } from '@/components/admin/PlatformBadges'

/**
 * 도달 현황 — `GET /admin/reach`.
 *
 * `ActivationSection` 과 **다른 질문**에 답한다: 그쪽은 *"가입 직후 제대로 시작했나"*(시간 한정),
 * 여기는 *"지금까지 어디까지 갔나"*(누적). 두 화면 숫자가 다른 건 정상이며 화면에 그 이유를 적는다.
 */

export const REACH_STAGES = [
  'signup',
  'card',
  'activity',
  'coverletter_question',
  'coverletter_answer',
  'coverletter_ai',
] as const

export type ReachStage = (typeof REACH_STAGES)[number]

export const STAGE_LABEL: Record<ReachStage, string> = {
  signup: '가입만',
  card: '카드',
  activity: '활동일지',
  coverletter_question: '자소서 문항',
  coverletter_answer: '자소서 답변',
  coverletter_ai: '자소서 AI',
}

export interface ReachRow {
  userId: string
  nickname: string
  signupDate: string
  lastActiveAt: string | null
  platform: PlatformUsage
  /** `null` = **미확인** (스탬프 도입 전 가입 · 백필 근거 없음). "모바일" 이 아니다 */
  desktopSeenAt: string | null
  cards: number
  sampleCards: number
  activityLogs: number
  coverletterQuestions: number
  coverletterAnswers: number
  aiAttempts: number
  aiSuccesses: number
  stage: ReachStage
}

export interface ReachData {
  rows: ReachRow[]
  truncated: boolean
  totalUsers: number
  excludedAdmins: number
  stageCounts: Record<ReachStage, number>
  desktopAxis: {
    confirmed: number
    coverletterAnswer: number
    coverletterAi: number
  }
  generatedAt: string
}

/**
 * 🔴 백엔드는 모든 응답을 `{ data, message }` 로 감싼다 (`ResponseTransformInterceptor`).
 * `r.data` 만 쓰면 **봉투 자체**를 돌려주게 되어 화면에서 `undefined.toLocaleString()` 로 터진다.
 * 형제 API(`api/admin.ts`·`api/adminUsers.ts`)와 같은 `unwrap` 을 쓴다.
 */
const unwrap = <T>(res: { data: { data: T } }) => res.data.data

/**
 * 🔴 서버 응답을 신뢰하지 않는다 — 배포 창(프론트 Vercel 이 백엔드 Railway 보다 먼저 뜨는 구간)에
 * 필드가 없을 수 있다. 같은 계열 사고가 이미 있었다 (`visitStats` — 페이지 전체 TypeError).
 *
 * **다만 빠진 값을 0 으로 채우지 않는다.** `?? 0` 은 *"모른다"* 를 *"0명이다"* 라는
 * **거짓 주장**으로 바꾼다. 형태가 깨졌으면 **에러로 올려** 화면이 "불러오지 못했어요" 를 띄우게 한다.
 */
function assertReachData(raw: unknown): ReachData {
  const d = raw as Partial<ReachData> | null
  if (
    !d ||
    typeof d.totalUsers !== 'number' ||
    !Array.isArray(d.rows) ||
    !d.stageCounts ||
    !d.desktopAxis
  ) {
    throw new Error('도달 현황 응답 형태가 올바르지 않습니다')
  }
  return d as ReachData
}

export const getAdminReach = () =>
  apiClient.get('/admin/reach').then(unwrap<ReachData>).then(assertReachData)
