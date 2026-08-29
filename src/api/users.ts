import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const agreeTerms = () =>
  apiClient.post('/users/me/terms').then(() => undefined)

export const markOnboarded = () =>
  apiClient.post('/users/me/onboard').then(() => undefined)

// AI 사용 동의 (PIPA 26조). 서버의 CURRENT_AI_CONSENT_VERSION 과 동일해야 저장됨.
export const CURRENT_AI_CONSENT_VERSION = 'v1'

export const agreeAiConsent = (version: string = CURRENT_AI_CONSENT_VERSION) =>
  apiClient
    .post('/users/me/ai-consent', { version })
    .then(() => undefined)

export const withdrawAiConsent = () =>
  apiClient.delete('/users/me/ai-consent').then(() => undefined)

export const updateNickname = (nickname: string) =>
  apiClient.patch('/users/me/nickname', { nickname }).then(unwrap<{ nickname: string }>)

export const deleteAccount = () => apiClient.delete('/users/me')

/**
 * 희망 직무·계열 변경 — 온보딩 이후 **바꾸는 유일한 경로**.
 *
 * 🔴 `postSignupAnswer` 와 헷갈리면 안 된다. 저건 온보딩 1회 기록(카드까지 만든다)이고,
 * 이건 그 뒤로 값만 고치는 길이다 (내 정보 › 기본 인적사항 · 카드 추가 모달의
 * 「앞으로도 ‘X’로 채우기」 · 설정의 길잡이).
 *
 * 부분 갱신 — **보낸 필드만** 바뀐다. `null` 은 「비우기」, 미전송은 「손대지 마」.
 * 그래서 둘 다 optional 인 건 맞지만 **둘 다 안 보내면 서버가 400** 을 준다.
 *
 * 🔴 `jobTitle` 에는 **사람이 타이핑한 원문만** 넣는다 — 계열 라벨(「의료·보건·복지」)을
 * 여기 넣으면 시스템 말이 카드 프리필·AI 기준으로 승격된다. 계열은 `seriesId` 로만.
 */
export interface JobProfileBody {
  jobTitle?: string | null
  seriesId?: string | null
}

export const patchJobProfile = (body: JobProfileBody) =>
  apiClient.patch('/users/me/job-profile', body).then(() => undefined)

/**
 * signup 1 질문 답변 — **두 경로가 같은 엔드포인트를 쓴다**.
 *
 * | 경로 | 보내는 것 | 서버가 만드는 카드 |
 * |---|---|---|
 * | 구 21칩 | `jobCategories` (+`otherText`) | 가상 회사 샘플 |
 * | 신 계열 1탭 | `jobCategories: []` + `seriesId` (+`jobTitle`·`pickedCompanies`) | 지원 예정(PLANNED) |
 *
 * 🔴 새 경로도 `jobCategories: []` 를 **반드시** 보낸다 — 서버가 그 컬럼의 NULL 여부로
 * 「이미 답변했나」를 판정하기 때문이다. 안 보내면 온보딩이 매번 다시 뜬다.
 */
export interface SignupAnswerBody {
  jobCategories: string[]
  otherText?: string
  /** 계열 id (`@/utils/jobRole` 의 `JOB_SERIES` id). 서버가 14개 화이트리스트로 검증 */
  seriesId?: string
  /** 🔴 **사람이 타이핑한** 직무 원문만. 계열 라벨을 여기 넣지 않는다 (카드 프리필로 승격된다) */
  jobTitle?: string
  /** 2단 보상에서 고른 회사명 (최대 6) — 각각 지원 예정 카드가 된다 */
  pickedCompanies?: string[]
  /**
   * 미리보기에 쓴 전형 템플릿 id — 🔴 **서버가 이걸 못 계산한다.**
   *
   * 세밀 그룹 오버라이드(승무원 → 항공 서비스)는 직무 사전이 있어야 도는 판정인데
   * 사전은 프론트 단일 소스다. 안 보내면 서버가 계열까지만 알아 **방금 본 미리보기와
   * 담긴 카드의 스텝이 달라진다.** 카드를 안 만드는 경로(picks 0)에선 보내지 않는다.
   */
  templateId?: string
}
export const postSignupAnswer = (body: SignupAnswerBody) =>
  apiClient.post('/users/me/signup-answer', body).then(() => undefined)

// W1 — 샘플 카드 전체 숨기기 (멱등)
export const dismissAllSampleCards = () =>
  apiClient.post('/users/me/sample-cards/dismiss').then(() => undefined)

// 캘린더 UX 재구성 — "이제 캘린더가 홈이에요" 안내 배너 dismiss (멱등)
export const dismissCalendarHomeIntro = () =>
  apiClient.post('/users/me/dismiss-calendar-home-intro').then(() => undefined)

/**
 * 앱 소개 투어 진행 기록 — 투어가 **끝나는 순간 한 번**만 보낸다 (마지막 장 CTA · 건너뛰기).
 *
 * 🔴 **다시 보기(`?replay=1`)에서는 부르지 않는다.** 재생일 뿐인데 「처음 만난 시각」과
 * 「이탈 장면」을 오염시키면 관측이 거짓말을 한다 — 서버에 그 분기가 없는 이유다.
 *
 * 실패는 조용히 넘어간다 (호출부가 fire-and-forget). 진입 경로가 온보딩 직후뿐이라
 * 기록이 안 돼도 투어가 다시 뜨지 않는다.
 */
export interface TourProgressBody {
  /** 마지막으로 본 장면 (1~6) */
  lastStep: number
  /** 마지막 장까지 도달했는가. false = 건너뛰기 */
  completed: boolean
}

export const postTourProgress = (body: TourProgressBody) =>
  apiClient.post('/users/me/tour', body).then(() => undefined)

/**
 * 면접 유도 모달 「다시 보지 않기」 — 전 카드 영구 차단 (멱등).
 *
 * 🔴 **이건 실패를 그냥 넘기면 안 된다.** 다른 dismiss 는 실패해도 「한 번 더 뜨는」 정도지만,
 * 이건 사용자가 명시적으로 체크한 약속이라 실패 후 또 뜨면 약속 파기가 된다.
 * 호출부(`useDismissInterviewNudge`)가 재시도 + localStorage 보조 기록으로 한 겹 더 막는다.
 */
export const dismissInterviewNudge = () =>
  apiClient.post('/users/me/dismiss-interview-nudge').then(() => undefined)

/**
 * 데스크탑 웹 사용 스탬프 (관측 전용) — **자소서 게이트와 같은 조건**일 때만 부른다.
 * 서버는 최초 1회만 기록하고 재호출은 0행이다. 실패해도 화면에 영향을 주지 않는다.
 */
export const markDesktopWebSeen = () =>
  apiClient.post('/users/me/desktop-seen').then(() => undefined)

export interface DashboardSection {
  id: string
  visible: boolean
}

export interface DashboardConfig {
  sections: DashboardSection[]
}

/**
 * 백엔드 UpdateDashboardConfigDto의 VALID_SECTION_IDS와 동기화.
 * 옛 버전 앱에서 만들어진 orphan section ID(예: deprecated된 'myinfo_progress')가
 * 사용자 DB에 남아있다가 reorder 시 그대로 echo back되면 400. 저장 직전 화이트리스트로 필터.
 */
export const KNOWN_DASHBOARD_SECTION_IDS = [
  'stats',
  'dday',
  'todos',
  'today_schedule',
  'top_applications',
  'goals',
  'calendar_mini',
  'cover_letter_quick',
] as const

export const getDashboardConfig = (): Promise<DashboardConfig> =>
  apiClient.get('/users/me/dashboard-config').then(unwrap<DashboardConfig>)

export const patchDashboardConfig = (config: DashboardConfig): Promise<DashboardConfig> => {
  const sanitized: DashboardConfig = {
    sections: config.sections.filter((s) =>
      (KNOWN_DASHBOARD_SECTION_IDS as readonly string[]).includes(s.id),
    ),
  }
  return apiClient
    .patch('/users/me/dashboard-config', sanitized)
    .then(unwrap<DashboardConfig>)
}
