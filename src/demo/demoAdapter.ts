// 데모 모드용 axios 어댑터.
//  - GET       → sampleData 상수 / demoStore (mutation 대상 리소스) 응답
//  - mutation  → 화이트리스트(체험용 인메모리 반영)만 통과, 나머지(AI·계정·생성 등)는 가입 모달 + 영원 pending
//
// DemoModeProvider 가 마운트 시 apiClient.defaults.adapter 를 이걸로 교체하고 언마운트 시 복구한다.
// 실 서비스 영향 0 — 서버로 나가는 요청이 없다(favicon 등 외부 이미지는 컴포넌트가 직접 로드).
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { useDemoSignupStore } from '@/stores/demoSignupStore'
import * as S from './sampleData'
import * as store from './demoStore'

/** resolveGet 이 "미등록 경로" 임을 알리는 sentinel (null 은 '등록됐고 값이 null' 과 구분해야 함) */
const UNREGISTERED = Symbol('unregistered')

function resolveGet(url: string, params: Record<string, unknown>): unknown {
  const path = url.split('?')[0]

  let m = path.match(/^\/applications\/[^/]+\/coverletters\/reuse-options$/)
  if (m) return []
  // 자소서 카드의 참조 경험(source-refs) — null 이면 CoverLetterCard 가 .length 에서 크래시
  m = path.match(/^\/coverletters\/[^/]+\/source-refs$/)
  if (m) return []
  m = path.match(/^\/applications\/([^/]+)\/coverletters$/)
  if (m) return store.getCoverletters(m[1])
  m = path.match(/^\/applications\/[^/]+\/steps\/([^/]+)\/checklist$/)
  if (m) return store.getChecklist(m[1])
  // 회사 조사 캐시 — 실존 회사 허위사실 방지로 null(배너 미노출). sampleData 판단 근거 참조.
  m = path.match(/^\/applications\/[^/]+\/coverletter\/research$/)
  if (m) return S.DEMO_COMPANY_RESEARCH
  // 자소서 AI 채팅 이력 — 데모는 대화 없음. null 이면 ChatPanel .filter 크래시 → 빈 배열.
  m = path.match(/^\/applications\/[^/]+\/coverletter\/messages$/)
  if (m) return []
  m = path.match(/^\/applications\/([^/]+)$/)
  if (m) return store.getApplication(m[1]) ?? null

  // 캘린더 이벤트 — 월별 필터 (실서버와 동일하게 월 단위 응답 → monthly+nextMonth 이어붙일 때 중복 방지).
  // axios 는 쿼리를 config.params 로 넘긴다(url 엔 없음). 단위 테스트가 url 에 붙여도 동작하게 둘 다 본다.
  if (path === '/calendar/events') {
    const q = new URLSearchParams(url.split('?')[1] ?? '')
    const year = Number(params.year ?? q.get('year'))
    const month = Number(params.month ?? q.get('month'))
    return year && month ? store.getCalendarEvents({ year, month }) : store.getCalendarEvents()
  }

  // 활동 상세 — /activities/:id (목록 케이스보다 먼저 매치)
  m = path.match(/^\/activities\/([^/]+)$/)
  if (m) {
    const id = m[1]
    return S.DEMO_ACTIVITIES.find((a) => a.id === id) ?? null
  }

  switch (path) {
    case '/applications': return store.getApplications()
    case '/activities': return S.DEMO_ACTIVITIES
    case '/activity-logs': return S.DEMO_TIMELINE
    case '/dashboard/stats': return S.DEMO_DASHBOARD_STATS
    case '/dashboard/dday': return S.DEMO_DDAY
    case '/dashboard/interview-review': return S.DEMO_INTERVIEW_REVIEW
    case '/dashboard/streak': return S.DEMO_STREAK
    case '/dashboard/growth-metrics': return S.DEMO_GROWTH_METRICS
    case '/calendar/daily-notes': return store.getDailyNotes()
    case '/users/me/dashboard-config': return null
    case '/announcements/active': return null
    case '/me/coin-balance': return S.DEMO_COIN_BALANCE
    // AI feature 별 사용량·한도 (AiQuotaChip) — 데모는 소비 없음 → 빈 목록
    case '/me/ai-quotas': return []
    case '/myinfo/profile': return S.DEMO_PROFILE
    case '/myinfo/language-certs': return S.DEMO_LANG_CERTS
    case '/myinfo/certs': return S.DEMO_CERTS
    case '/myinfo/awards': return S.DEMO_AWARDS
    case '/myinfo/experiences': return S.DEMO_EXPERIENCES
    case '/myinfo/educations': return S.DEMO_EDUCATIONS
    case '/myinfo/exam-schedules': return S.DEMO_EXAM_SCHEDULES
    case '/myinfo/coverletter': return S.DEMO_COVERLETTER
    case '/myinfo/documents': return []
    case '/myinfo/storage-usage': return S.DEMO_STORAGE_USAGE
    // 회사 정보(DART) — 실존 회사 재무·공시를 지어내면 허위사실이 되므로 null(섹션 미노출).
    case '/companies/details': return null
    // A7 브리핑 배너·알림 벨이 캘린더에서 조회 — null 이면 pages[null].items 렌더 크래시
    case '/notifications': return { items: [], nextCursor: null, unreadCount: 0 }
    // A3 마감 임박 준비 — CalendarDayPanel 이 urgentItems.length 접근, null 이면 크래시 (`= []` 기본값은 undefined 에만 적용)
    case '/calendar/urgent-checklist': return []
    // 내정보 수정 모달 자동완성 4형제 — 입력란 포커스 시 조회, null 이면 items.length 크래시
    case '/schools/autocomplete': return []
    case '/schools/majors/autocomplete': return []
    case '/schools/certs/autocomplete': return []
    case '/schools/lang-certs/autocomplete': return []
    default: return UNREGISTERED
  }
}

/** config.data(요청 바디)를 객체로 파싱. axios transformRequest 가 JSON 문자열로 직렬화해 넘긴다. */
function parseBody(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      return data ? (JSON.parse(data) as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  if (data && typeof data === 'object') return data as Record<string, unknown>
  return {}
}

/**
 * mutation 라우팅. 화이트리스트 매칭 시 인메모리 반영 후 payload 반환, 아니면 null(=차단).
 *
 * 화이트리스트 = 사용자가 데모에서 "직접 체험"하는 비 AI 상호작용:
 *   PATCH /applications/:id                          (상태 변경·별표·탈락 회고 등 카드 필드)
 *   PATCH /applications/:id/step                     (현재 스텝=노드 이동)
 *   PATCH /applications/:id/steps/:stepId            (스텝 날짜·장소·메모·핀)
 *   POST/PATCH/DELETE .../steps/:stepId/checklist    (체크리스트 추가·토글·삭제)
 *   POST/PATCH/DELETE /calendar/daily-notes          (데일리 노트 추가·토글·삭제)
 *   PATCH /applications/:id/coverletters/:clId       (자소서 답변 텍스트 저장 — 비 AI)
 *
 * 그 외 전부(AI 호출·카드 생성/삭제·파일 업로드·계정/설정 등) = 차단 → 가입 모달.
 */
function resolveMutation(method: string, url: string, body: Record<string, unknown>): { payload: unknown } | null {
  const path = url.split('?')[0]
  let m: RegExpMatchArray | null

  if (method === 'patch' && (m = path.match(/^\/applications\/([^/]+)\/step$/))) {
    return { payload: store.updateCurrentStep(m[1], Number(body.stepIndex)) }
  }
  if (method === 'patch' && (m = path.match(/^\/applications\/([^/]+)\/steps\/([^/]+)$/))) {
    return { payload: store.updateStep(m[1], m[2], body) }
  }
  if (method === 'post' && (m = path.match(/^\/applications\/[^/]+\/steps\/([^/]+)\/checklist$/))) {
    return { payload: store.createChecklistItem(m[1], String(body.content ?? '')) }
  }
  if ((m = path.match(/^\/applications\/[^/]+\/steps\/([^/]+)\/checklist\/([^/]+)$/))) {
    if (method === 'patch') return { payload: store.updateChecklistItem(m[1], m[2], body) }
    if (method === 'delete') {
      store.deleteChecklistItem(m[1], m[2])
      return { payload: null }
    }
  }
  if (method === 'patch' && (m = path.match(/^\/applications\/([^/]+)\/coverletters\/([^/]+)$/))) {
    return { payload: store.updateCoverletter(m[1], m[2], body) }
  }
  if (method === 'patch' && (m = path.match(/^\/applications\/([^/]+)$/))) {
    return { payload: store.updateApplication(m[1], body) }
  }
  if (method === 'post' && path === '/calendar/daily-notes') {
    return {
      payload: store.createDailyNote({
        date: String(body.date),
        hourSlot: (body.hourSlot as number | null | undefined) ?? null,
        content: String(body.content ?? ''),
      }),
    }
  }
  if ((m = path.match(/^\/calendar\/daily-notes\/([^/]+)$/))) {
    if (method === 'patch') return { payload: store.updateDailyNote(m[1], body) }
    if (method === 'delete') {
      store.deleteDailyNote(m[1])
      return { payload: null }
    }
  }
  return null
}

function envelope(config: Parameters<AxiosAdapter>[0], payload: unknown): AxiosResponse {
  return {
    data: { data: payload, message: 'ok' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  } as AxiosResponse
}

export const demoAdapter: AxiosAdapter = (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  const url = config.url ?? ''

  if (method === 'get') {
    const payload = resolveGet(url, (config.params ?? {}) as Record<string, unknown>)
    if (payload === UNREGISTERED) {
      // fail-loud — 새 화면이 데이터 없이 조용히 비지 않도록 소음을 남긴다 (계약은 기존대로 null).
      console.error(`[demo] 미등록 GET 경로: ${url.split('?')[0]} — demoAdapter 에 등록 필요`)
      return Promise.resolve(envelope(config, null))
    }
    return Promise.resolve(envelope(config, payload))
  }

  // mutation — 화이트리스트만 인메모리 반영 후 정상 응답
  const handled = resolveMutation(method, url, parseBody(config.data))
  if (handled) return Promise.resolve(envelope(config, handled.payload))

  // 차단 대상(AI·생성/삭제·업로드·계정 등) — 가입 모달 + 영원 pending(onSuccess/onError 안 탐 → 토스트 안 뜸)
  useDemoSignupStore.getState().show()
  return new Promise<never>(() => {})
}
