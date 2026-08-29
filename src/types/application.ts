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
  /**
   * 어느 화면에서 만들어졌는가 — **읽기 전용 관측값** (서버 `ApplicationCreatedVia`).
   *
   * 🔴 `CreateApplicationDto.createdVia`(쓰기)와 **다른 유니온**이다. 저쪽은 프론트가 보낼 수
   * 있는 값(`add_modal`)만 좁게 두지만, 여기는 서버가 만든 값도 내려온다 — 온보딩 보상으로
   * 담긴 카드(`onboarding_pick`)를 알아보는 유일한 손잡이라 투어 무대가 이 값을 본다.
   * 도입 전 카드는 `null`(백필 안 함).
   */
  createdVia?: 'add_modal' | 'onboarding_sample' | 'onboarding_pick' | null
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
  /**
   * 어느 화면에서 만들었는가 — **관측 전용**이라 동작에 영향을 주지 않는다.
   *
   * 🔴 서버가 `IsIn` 으로 검증하므로 **아무 문자열이나 보내면 400 이 난다.** 새 생성 경로를
   * 만들 때는 백엔드 `ApplicationCreatedVia` 유니온에 값을 먼저 추가해야 한다 —
   * 관측값이라도 조용히 통과시키면 오탐이 데이터에 섞이기 때문에 일부러 막아둔 것이다.
   *
   * 안 보내면 `null` 로 남는다. 소급이 불가능한 값이라 새 경로에서 빠뜨리면 그 경로는
   * 영영 관측 밖에 있게 된다.
   */
  createdVia?: 'add_modal'
  /**
   * 직무를 어떻게 입력했는가 — **관측 전용**. `createdVia` 와 같은 이유로 서버가 `IsIn` 으로
   * 검증하므로 아무 문자열이나 보내면 400 이 난다.
   *
   * 「직접 쳐서 확정한 값」과 「추천을 수용한 값」은 신뢰도가 다르다 — 뭉치면 사전을 키울
   * 근거가 사라진다. 직무가 비면 보내지 않는다.
   *
   * `prefill` = 온보딩에서 **사람이 타이핑한** 직무가 미리 채워진 걸 **그대로 두고** 저장.
   * 셋 중 신뢰도가 가장 낮다 — 「맞다고 확인」인지 「폼을 통과시킴」인지 알 수 없다.
   */
  jobTitleSource?: JobTitleSource
}

/** 직무 입력 출처 — 백엔드 `JOB_TITLE_SOURCES` 와 같은 계약 (`parsed` 는 F0 예약값이라 프론트 미사용) */
export type JobTitleSource = 'typed' | 'suggestion' | 'prefill'

export interface UpdateApplicationDto {
  companyName?: string
  jobTitle?: string
  /**
   * 직군·계열 라벨. 🔴 **`null` = 「지워라」** (미전송 `undefined` = 「손대지 마」).
   *
   * 직무를 고치면 계열은 그 직무에서 다시 파생된다. 사전이 새 직무를 못 알아들어 보낼
   * 라벨이 없을 때 필드를 빼면 **옛 계열이 그대로 남는다** — 「승무원」→「백엔드」로 고쳤는데
   * 태그가 「영업·판매·서비스」이던 결함(2026-08-28 실기)이 그것이다.
   */
  jobCategory?: string | null
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
  /** 직무 입력 출처 — 관측 전용 (`CreateApplicationDto.jobTitleSource` 와 같은 계약) */
  jobTitleSource?: JobTitleSource
}

export interface UpdateStepsDto {
  steps: Array<{
    orderIndex: number
    name: string
    scheduledDate?: string
    location?: string
  }>
}
