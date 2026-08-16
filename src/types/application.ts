import type { JobPosting } from '@/api/jobPosting'

export type ApplicationStatus = 'PLANNED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED'

export interface ApplicationStep {
  id: string
  applicationId: string
  orderIndex: number
  name: string
  scheduledDate: string | null
  location: string | null
  notes: string | null
  pinnedContent: string | null
}

/**
 * 면접 유도 모달 판정 — 서버가 **단계 이동 응답에 실어 준다.**
 *
 * 🔴 `show` 는 「띄워도 되는 상태인가」만 뜻한다 (노출 이력·영구차단·이 스텝 세션).
 * **「이 스텝이 면접인가」는 서버가 모른다** — 프론트가 `isInterviewLikeForNudge` 로 합친다.
 */
export interface InterviewNudge {
  show: boolean
  variant: 'first' | 'again' | 'noCoverletter'
}

/** PR_B1c — 자소서 생성 (회사조사 trigger) 상태 */
export type CoverletterGenerationStatus =
  | 'idle'
  | 'in_progress'
  | 'completed'
  | 'failed'

export interface Application {
  id: string
  userId: string
  companyName: string
  jobTitle: string | null
  jobCategory: string | null
  status: ApplicationStatus
  jobUrl: string | null
  memo: string | null
  currentStepIndex: number
  needsDetail: boolean
  isStarred: boolean
  /** W1 — 가상 회사 샘플 카드 (signup 직군 답변 기반 자동 생성) 여부 */
  isSample?: boolean
  /** A9 — 탈락 회고 한 줄 ("이번 지원에서 얻은 것") */
  failedTakeaway?: string | null
  /** A9 — 회고 입력·수정 시각 (성장 페이지 정렬) */
  failedTakeawayAt?: string | null
  /** W2 — 회사 도메인 (favicon 로딩 용). backend 가 companies.json lookup 후 inject. 매칭 X 시 undefined */
  domain?: string
  steps: ApplicationStep[]
  /** PR_B1c — 자소서 생성 상태 (회사조사 trigger atomic) */
  coverletterGenerationStatus?: CoverletterGenerationStatus
  coverletterGenerationStartedAt?: string | null
  /** PR_B1c Phase A — 회사명/직무 변경 시 NOW() 저장 (outdated banner 노출) */
  coverletterResearchOutdatedAt?: string | null
  /** 공고 요건 파싱 결과 (자소서 페이지 배너 · GET /applications/:id whitelist). 미입력 시 null */
  jobPosting?: JobPosting | null
  /**
   * 공고 요건 파싱 진행 lock. 'parsing' = 정리 중 (배너가 CTA 대신 진행 상태 표시).
   * null = idle. 서버가 started_at 2분 초과 시 stale 로 간주해 null 로 내려줌 (읽기 시점 판정).
   */
  jobPostingStatus?: 'parsing' | null
  createdAt: string
  updatedAt: string
}

/** PR_B1c — POST /applications/:id/generate-coverletter 응답 */
export interface GenerateCoverletterResult {
  status:
    | 'completed'
    | 'already_in_progress'
    | 'already_completed'
    | 'coin_insufficient'
  reason?: string
}

export interface CreateApplicationDto {
  companyName: string
  jobTitle?: string
  jobCategory?: string
  status?: 'PLANNED' | 'IN_PROGRESS'
  /** 서류 마감일 — 백엔드에서 첫 step.scheduled_date에 저장 (호환 입력 채널) */
  deadline?: string
  jobUrl?: string
  needsDetail?: boolean
  /** 전형 템플릿 id — IN_PROGRESS 생성 시 초기 스텝 결정 (미지정 시 'general') */
  templateId?: string
}

export interface UpdateApplicationDto {
  companyName?: string
  jobTitle?: string
  jobCategory?: string
  status?: ApplicationStatus
  /** 서류 마감일 — 백엔드에서 첫 step.scheduled_date에 저장 (호환 입력 채널) */
  deadline?: string
  jobUrl?: string
  memo?: string
  currentStepIndex?: number
  needsDetail?: boolean
  isStarred?: boolean
  /** A9 — 탈락 회고 한 줄. 빈 문자열 = 삭제 */
  failedTakeaway?: string
}

export interface UpdateStepsDto {
  steps: Array<{
    orderIndex: number
    name: string
    scheduledDate?: string
    location?: string
  }>
}
