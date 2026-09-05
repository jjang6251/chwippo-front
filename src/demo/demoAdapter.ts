// 데모 모드용 axios 어댑터.
//  - GET       → sampleData 상수 / demoStore (mutation 대상 리소스) 응답
//  - mutation  → 화이트리스트(체험용 인메모리 반영)만 통과, 나머지(AI·계정·생성 등)는 가입 모달 + 영원 pending
//
// DemoModeProvider 가 마운트 시 apiClient.defaults.adapter 를 이걸로 교체하고 언마운트 시 복구한다.
// 실 서비스 영향 0 — 서버로 나가는 요청이 없다(favicon 등 외부 이미지는 컴포넌트가 직접 로드).
import type { AxiosAdapter, AxiosResponse } from 'axios'
import {
  useDemoSignupStore,
  type DemoBlockReason,
} from '@/stores/demoSignupStore'
import * as S from './sampleData'
import * as store from './demoStore'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

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
  // 준비 노트 시트 — 0장이면 `[]`. 프론트가 기존 notes 를 첫 탭으로 보여주는 폴백을 탄다
  m = path.match(/^\/applications\/[^/]+\/steps\/([^/]+)\/note-sheets$/)
  if (m) return store.getNoteSheets(m[1])
  // 회사 조사 캐시 — 실존 회사 허위사실 방지로 null(배너 미노출). sampleData 판단 근거 참조.
  m = path.match(/^\/applications\/[^/]+\/coverletter\/research$/)
  if (m) return S.DEMO_COMPANY_RESEARCH
  // 자소서 AI 채팅 이력 — 데모는 대화 없음. null 이면 ChatPanel .filter 크래시 → 빈 배열.
  // 자소서 AI 대화 이력 — 데모는 카카오 1건만 (「AI 에게 묻기」가 뭘 해주는지 보여주기 위해).
  // 보내기(POST /coverletter/chat)는 여전히 차단된다 — 지난 대화를 보는 것과 새로 부르는 건 다르다.
  m = path.match(/^\/applications\/([^/]+)\/coverletter\/messages$/)
  if (m) return S.DEMO_COVERLETTER_MESSAGES[m[1]] ?? []
  // ── 면접 준비 (카카오 1차 기술면접) ──────────────────────
  m = path.match(/^\/interview-prep-sessions$/)
  if (m) {
    /**
     * 🔴 **쿼리스트링과 `params` 를 둘 다 본다.** `interviewPrep.ts` 는
     * `` `/interview-prep-sessions?applicationId=${id}` `` 처럼 **URL 에 직접** 붙이지
     * axios `params` 로 넘기지 않는다. `params` 만 읽었더니 실기에서 "세션이 없어요" 가 떴다
     * (2026-08-09). 캘린더·자동완성도 같은 이유로 이 패턴을 쓴다.
     */
    const appId =
      (params.applicationId as string | undefined) ??
      new URLSearchParams(url.split('?')[1] ?? '').get('applicationId') ??
      undefined
    return appId ? (S.DEMO_INTERVIEW_SESSIONS[appId] ?? []) : []
  }
  // 「면접 보기」 자가평가가 남는 리소스라 store 를 거친다 (재조회가 결과를 덮지 않게)
  m = path.match(/^\/interview-prep-sessions\/([^/]+)\/questions$/)
  if (m) return store.getInterviewQuestions(m[1])
  m = path.match(/^\/interview-prep-sessions\/([^/]+)\/refs$/)
  if (m) return S.DEMO_INTERVIEW_REFS[m[1]] ?? { coverletters: [], logs: [] }
  /**
   * 🔴 **회사 조사는 `null` 이다** — 자소서 탭과 **같은 판단**이다.
   * 데모 카드의 회사는 전부 실존 기업이고, 회사 조사는 앱이 "치뽀가 수집한 사실" 로
   * 제시하는 정보라 지어내면 곧 허위 사실이 된다. 컴포넌트는 null 을 정상 상태로 다룬다
   * (배너 미노출). `DEMO_COMPANY_RESEARCH` 주석 참조.
   */
  m = path.match(/^\/interview-prep-sessions\/([^/]+)\/research$/)
  if (m) return S.DEMO_COMPANY_RESEARCH
  m = path.match(/^\/interview-prep-sessions\/([^/]+)$/)
  if (m) {
    const all = Object.values(S.DEMO_INTERVIEW_SESSIONS).flat()
    return all.find((x) => x.id === m![1]) ?? null
  }

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
    // 공지는 0~2건 배열. 데모엔 띄울 공지가 없다 → 빈 목록
    case '/announcements/active': return []
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
    case '/myinfo/documents': return S.DEMO_DOCUMENTS
    case '/myinfo/storage-usage': return S.DEMO_STORAGE_USAGE
    // 내 정보 「추가 정보」 슬롯의 필드 사전 — 데모엔 슬롯 항목을 두지 않는다(저장이 차단이라
    // 칸만 보이면 막다른 길이 된다). null 이면 「추가 정보」 블록이 통째로 안 그려진다.
    case '/myinfo/field-dictionary': return null
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
    // 🔴 보드 "지원 추가" 회사명 자동완성 — **둘러보기의 첫 CTA 가 여기서 죽었다** (2026-08-05).
    // 위 4형제를 등록할 때 같이 세지 않아 혼자 빠져 있었다. 빈 배열 대신 실제 후보를 준다 —
    // 데모에서 "검색 결과 없음"만 뜨면 기능이 없는 것처럼 보인다.
    case '/companies/autocomplete': {
      const q = String(
        params.q ?? new URLSearchParams(url.split('?')[1] ?? '').get('q') ?? '',
      ).trim()
      if (!q) return []
      return S.DEMO_AUTOCOMPLETE_COMPANIES.filter((c) => c.name.includes(q))
    }
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
 *   POST/PATCH/DELETE .../steps/:stepId/note-sheets  (준비 노트 시트 추가·이름·본문·삭제)
 *   POST/PATCH/DELETE /calendar/daily-notes          (데일리 노트 추가·토글·삭제)
 *   PATCH /applications/:id/coverletters/:clId       (자소서 답변 텍스트 저장 — 비 AI)
 *   PATCH /interview-prep-questions/:id              (면접 내 답변 메모 — 비 AI)
 *   POST  /interview-prep-questions/:id/practice     (「면접 보기」 자가평가 — 비 AI)
 *   PATCH /interview-prep-sessions/:id/user-notes    (면접 자료 메모 — 비 AI)
 *
 * 그 외 전부(AI 호출·카드 생성/삭제·파일 업로드·계정/설정 등) = 차단 → 가입 모달.
 */
function resolveMutation(method: string, url: string, body: Record<string, unknown>): { payload: unknown } | null {
  const path = url.split('?')[0]
  let m: RegExpMatchArray | null

  /**
   * 면접 메모 — **자소서 답변 저장과 같은 성격**(비 AI 텍스트)이라 허용한다.
   * 데모에서 실제로 써볼 수 있어야 기능을 이해한다. 인메모리라 새로고침하면 사라진다.
   * 🔴 반면 `POST .../answer`·`/followups`·`/generate`·`/regenerate` 는 **AI 호출**이라
   * 화이트리스트에 넣지 않는다 — 아래 기본 분기가 가입 모달을 띄운다.
   *
   * 질문 은행 D2b — 이 경로가 `mustPrepare`·`questionText`·`category` 도 나른다.
   * body 를 그대로 되비추므로(`{ ...body }`) 훅의 캐시 패치가 **보낸 필드만** 반영해
   * 데모에서도 ⭐ 토글과 인라인 편집이 실제로 움직인다. `DELETE` 는 넣지 않는다 —
   * 질문이 사라지는 건 되돌릴 수 없어 둘러보기에서 보여줄 동작이 아니다.
   */
  if (
    method === 'patch' &&
    (m = path.match(/^\/interview-prep-questions\/([^/]+)$/))
  ) {
    return { payload: { ...body, id: m[1] } }
  }
  if (
    method === 'patch' &&
    path.match(/^\/interview-prep-sessions\/[^/]+\/user-notes$/)
  ) {
    return { payload: body }
  }
  /**
   * 「면접 보기」 자가평가 — **AI 도 아니고 코인도 안 쓴다.** 차단할 이유가 없고,
   * 막으면 연습 도중 문항마다 가입 모달이 떠서 데모에서 이 기능을 끝까지 볼 수 없다
   * (연습이 끝까지 도는 걸 보여주는 게 시연 가치다).
   *
   * 메모(PATCH)와 달리 store 에 실제로 남긴다 — 재조회가 결과를 덮으면 「다시 볼 것만」이
   * 빈 채로 돌아온다. 새로고침하면 초기화되는 건 데모 전체와 같다.
   */
  if (
    method === 'post' &&
    (m = path.match(/^\/interview-prep-questions\/([^/]+)\/practice$/))
  ) {
    return {
      payload: store.recordInterviewPractice(
        m[1],
        body.result as InterviewPrepQuestion['lastPracticeResult'],
      ),
    }
  }

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
  /*
    준비 노트 시트 — **체크리스트와 같은 성격**(비 AI·되돌릴 수 있는 텍스트)이라 허용한다.
    탭을 눌러보고 늘려보는 게 이 기능의 시연 가치 전부다. `DELETE` 도 넣는다 —
    질문 삭제와 달리 시트는 사용자가 방금 만든 것이고, 마지막 1장은 store 가 지킨다.
  */
  if ((m = path.match(/^\/applications\/[^/]+\/steps\/([^/]+)\/note-sheets$/))) {
    if (method === 'post') {
      return {
        payload: store.createNoteSheet(m[1], {
          name: String(body.name ?? ''),
          content: body.content as string | undefined,
          ifEmpty: body.ifEmpty === true,
        }),
      }
    }
  }
  if ((m = path.match(/^\/applications\/[^/]+\/steps\/([^/]+)\/note-sheets\/([^/]+)$/))) {
    if (method === 'patch') return { payload: store.updateNoteSheet(m[1], m[2], body) }
    if (method === 'delete') {
      store.deleteNoteSheet(m[1], m[2])
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

/**
 * 데모에서 차단된 요청의 식별 코드. 호출부는 이 코드를 만나면 **토스트를 띄우지 않는다** —
 * 사용자에겐 이미 가입 모달이 떠 있고, 에러 문구가 겹치면 두 번 혼내는 꼴이 된다.
 */
/**
 * 차단된 경로를 **사용자가 하려던 일**로 옮긴다 — 모달이 맥락에 맞는 말을 하기 위해서다.
 * 여기서 못 알아본 경로는 `default` 로 떨어지고, 그때도 문구는 어색하지 않아야 한다.
 */
function blockReason(path: string): DemoBlockReason {
  /*
    🔴 **AI 생성과 갈라 놓는다** (질문 은행 D2). 직접 적은 질문은 AI 가 아니라 **내가 모은
    자산**이라 "예상 질문을 뽑아드릴게요" 가 나가면 방금 한 행동과 어긋난다.
    `/generate` 보다 **먼저** 판정한다 — 두 경로가 같은 접두사(`/interview-prep-sessions/…`)다.
  */
  if (/^\/interview-prep-sessions\/[^/]+\/questions\/bulk$/.test(path))
    return 'custom_question'
  if (/^\/interview-prep-questions\/[^/]+\/answer$/.test(path)) return 'ai_answer'
  if (/^\/interview-prep-questions\/[^/]+\/followups$/.test(path)) return 'ai_followup'
  /*
    ↻ 낱개 교체 — **생성과 같은 사유**를 쓴다 (질문 은행 D2b). 하는 일이 "AI 가 질문을
    만든다" 로 같아서 새 문구를 만들 이유가 없다. 개수가 1개인 것은 가입 전 사용자에게
    설명할 차이가 아니다.
  */
  if (/^\/interview-prep-questions\/[^/]+\/regenerate$/.test(path))
    return 'ai_generate'
  if (/^\/interview-prep-sessions\/[^/]+\/generate$/.test(path)) return 'ai_generate'
  // 🔴 자소서는 **AI 경로와 문항 추가를 구분**한다 (2026-08-08 QA 발견).
  //    `/coverletter/` 하나로 뭉치면 `+ 지원 동기`(문항 추가)에도 "초안을 만들어드릴게요" 가
  //    떠서, 앱이 내 행동을 모른다는 게 더 분명해진다.
  if (/ai-draft|\/chat|feedback|research/.test(path)) return 'ai_coverletter'
  if (/^\/coverletters?(\/|$)/.test(path)) return 'coverletter_item'
  // 세션 생성이 곧 질문 생성이다 — "지원 카드 추가" 안내가 나가면 안 된다
  if (path === '/interview-prep-sessions') return 'ai_generate'
  if (path === '/applications') return 'create'
  return 'default'
}

export const DEMO_BLOCKED = 'DEMO_BLOCKED' as const

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

  /**
   * 차단 대상(AI·생성/삭제·업로드·계정 등) — 가입 모달을 띄우고 요청은 **거절**한다.
   *
   * 🔴 **예전엔 영원히 pending 인 Promise 를 돌려줬다.** `onSuccess`/`onError` 를 안 타서
   * 토스트가 안 뜨는 건 맞았는데, **`isPending` 도 영원히 풀리지 않았다.** 모달을 닫아도
   * 버튼이 `꼬리질문 만드는 중…` 인 채로 멈춰 있었다(2026-08-09 실기 발견).
   *
   * 대신 **전용 코드로 reject** 한다. `onError` 는 타지만 호출부가 이 코드를 알아보고
   * 조용히 넘기므로 토스트는 여전히 안 뜬다 — 그러면서 로딩은 정상적으로 풀린다.
   */
  useDemoSignupStore.getState().show(blockReason(url.split('?')[0]))
  return Promise.reject(
    Object.assign(new Error('demo-blocked'), { code: DEMO_BLOCKED }),
  )
}
