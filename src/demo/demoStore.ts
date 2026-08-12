// 데모 모드 인메모리 mutable 상태.
//
// 목적: 둘러보기(데모)에서 사용자가 노드(전형 스텝) 이동·체크리스트·데일리노트 등을
// "직접 눌러보고 화면에 반영되는" 경험을 하게 한다. 단 브라우저 메모리 안에서만 —
// 서버 요청 0, 새로고침하면 초기화 (모듈 재로드 + DemoModeProvider 가 resetDemoStore 호출).
//
// mutation 대상 리소스만 여기서 deep-copy 해 보관한다. 불변 리소스(대시보드 통계·프로필·
// streak·growth 등)는 sampleData 상수를 adapter 가 직접 읽는다.
import * as S from './sampleData'
import type { Application, UpdateApplicationDto } from '@/types/application'
import type {
  ChecklistItem,
  CreateNoteSheetBody,
  StepDetail,
  StepNoteSheet,
  UpdateNoteSheetBody,
  UpdateStepBody,
} from '@/api/stepDetail'
import type { CalendarEvent, DailyNote } from '@/api/calendar'
import type { ApplicationCoverletter, UpdateCoverletterDto } from '@/types/coverletter'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

interface DemoState {
  applications: Application[]
  /** stepId → 체크리스트 */
  checklists: Record<string, ChecklistItem[]>
  /**
   * stepId → 준비 노트 시트.
   *
   * 🔴 **읽기 상수로 둘 수 없다.** 탭 추가·이름 변경·삭제가 이 기능의 시연 가치인데,
   * 재조회가 상수를 다시 내려주면 방금 만든 탭이 사라진다 (면접 자가평가와 같은 이유).
   */
  noteSheets: Record<string, StepNoteSheet[]>
  dailyNotes: DailyNote[]
  /** applicationId → 자소서 문항 */
  coverletters: Record<string, ApplicationCoverletter[]>
  calendarEvents: CalendarEvent[]
  /**
   * sessionId → 면접 질문 트리. 「면접 보기」 자가평가가 여기에 남는다 (질문 은행 D3).
   *
   * 🔴 **캐시 패치만으로는 부족하다.** 훅이 `setQueryData` 로 방금 찍은 결과를 반영하지만,
   * 질문 조회는 staleTime 0 이라 화면을 나갔다 오거나 탭을 다시 보면 **재조회가 덮어쓴다.**
   * 그러면 「다시 볼 것만」으로 다시 시작했을 때 방금 찍은 게 사라져, 데모에서 이 기능이
   * 고장난 것처럼 보인다.
   */
  interviewQuestions: Record<string, InterviewPrepQuestion[]>
}

// structuredClone 금지 — ES2022 급 API 라 iOS 15.4 미만 WebKit 에 없어 데모 전체가 죽는다
// (CHWIPPO-FRONT-3 과 같은 기기 대역). 픽스처는 빌더가 전부 문자열·숫자로 만들어 JSON-safe.
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// 신규 항목 id 생성기 — reset 마다 0 부터 (테스트 결정성)
let seq = 0
const genId = (prefix: string) => `demo-${prefix}-${++seq}`
const now = () => new Date().toISOString()

function init(): DemoState {
  seq = 0
  return {
    applications: clone(S.DEMO_APPLICATIONS),
    checklists: clone(S.DEMO_CHECKLISTS),
    noteSheets: clone(S.DEMO_NOTE_SHEETS),
    dailyNotes: clone(S.DEMO_DAILY_NOTES),
    coverletters: clone(S.DEMO_COVERLETTERS),
    calendarEvents: clone(S.DEMO_CALENDAR_EVENTS),
    interviewQuestions: clone(S.DEMO_INTERVIEW_QUESTIONS),
  }
}

let state: DemoState = init()

/** 데모 진입(어댑터 교체) 시 함께 호출 — 초기 상태로 되돌린다. */
export function resetDemoStore(): void {
  state = init()
}

// ── 지원 카드 (읽기) ─────────────────────────────────────────
export const getApplications = (): Application[] => state.applications
export const getApplication = (id: string): Application | undefined =>
  state.applications.find((a) => a.id === id)

// ── 지원 카드 (mutation) ─────────────────────────────────────
/** PATCH /applications/:id — 상태 변경·별표·회고 등 카드 필드 수정 */
export function updateApplication(id: string, patch: UpdateApplicationDto): Application {
  const app = state.applications.find((a) => a.id === id)
  if (!app) throw new Error(`[demo] updateApplication: 미존재 카드 ${id}`)
  if (patch.companyName !== undefined) app.companyName = patch.companyName
  if (patch.jobTitle !== undefined) app.jobTitle = patch.jobTitle
  if (patch.jobCategory !== undefined) app.jobCategory = patch.jobCategory
  if (patch.status !== undefined) app.status = patch.status
  if (patch.jobUrl !== undefined) app.jobUrl = patch.jobUrl
  if (patch.memo !== undefined) app.memo = patch.memo
  if (patch.currentStepIndex !== undefined) app.currentStepIndex = patch.currentStepIndex
  if (patch.needsDetail !== undefined) app.needsDetail = patch.needsDetail
  if (patch.isStarred !== undefined) app.isStarred = patch.isStarred
  if (patch.failedTakeaway !== undefined) {
    app.failedTakeaway = patch.failedTakeaway
    app.failedTakeawayAt = now()
  }
  if (patch.deadline !== undefined && app.steps[0]) {
    app.steps[0].scheduledDate = patch.deadline
  }
  app.updatedAt = now()
  return app
}

/** PATCH /applications/:id/step — 현재 스텝(노드) 이동 */
export function updateCurrentStep(id: string, stepIndex: number): Application {
  const app = state.applications.find((a) => a.id === id)
  if (!app) throw new Error(`[demo] updateCurrentStep: 미존재 카드 ${id}`)
  app.currentStepIndex = stepIndex
  app.updatedAt = now()
  return app
}

/** PATCH /applications/:id/steps/:stepId — 스텝 날짜·장소·메모·핀 수정 */
export function updateStep(appId: string, stepId: string, patch: UpdateStepBody): StepDetail {
  const app = state.applications.find((a) => a.id === appId)
  const step = app?.steps.find((s) => s.id === stepId)
  if (!step) throw new Error(`[demo] updateStep: 미존재 스텝 ${appId}/${stepId}`)
  if (patch.scheduledDate !== undefined) step.scheduledDate = patch.scheduledDate
  if (patch.location !== undefined) step.location = patch.location
  if (patch.notes !== undefined) step.notes = patch.notes
  if (patch.pinnedContent !== undefined) step.pinnedContent = patch.pinnedContent
  return step
}

// ── 체크리스트 ───────────────────────────────────────────────
export const getChecklist = (stepId: string): ChecklistItem[] =>
  state.checklists[stepId] ?? []

export function createChecklistItem(stepId: string, content: string): ChecklistItem {
  const list = (state.checklists[stepId] ??= [])
  const item: ChecklistItem = {
    id: genId('ck'),
    stepId,
    content,
    isDone: false,
    orderIndex: list.length,
    createdAt: now(),
  }
  list.push(item)
  return item
}

export function updateChecklistItem(
  stepId: string,
  itemId: string,
  patch: { content?: string; isDone?: boolean },
): ChecklistItem {
  const item = state.checklists[stepId]?.find((i) => i.id === itemId)
  if (!item) throw new Error(`[demo] updateChecklistItem: 미존재 항목 ${stepId}/${itemId}`)
  if (patch.content !== undefined) item.content = patch.content
  if (patch.isDone !== undefined) item.isDone = patch.isDone
  return item
}

export function deleteChecklistItem(stepId: string, itemId: string): void {
  const list = state.checklists[stepId]
  if (list) state.checklists[stepId] = list.filter((i) => i.id !== itemId)
}

// ── 준비 노트 시트 ───────────────────────────────────────────
/**
 * 서버 규칙을 **데모에서도 그대로** 지킨다 — 캡 10장·마지막 1장 삭제 불가·`ifEmpty` 승격 멱등.
 * 여기서만 무르게 두면 둘러보기에서 되는 게 가입 후엔 막혀, 데모가 거짓말을 한 셈이 된다.
 */
const MAX_SHEETS = 10

export const getNoteSheets = (stepId: string): StepNoteSheet[] =>
  state.noteSheets[stepId] ?? []

export function createNoteSheet(stepId: string, body: CreateNoteSheetBody): StepNoteSheet {
  const list = (state.noteSheets[stepId] ??= [])
  // 승격 멱등 — 캡보다 먼저 본다 (10장 꽉 찬 스텝에 승격이 와도 첫 시트를 돌려줘야 화면이 뜬다)
  if (body.ifEmpty && list.length > 0) return list[0]
  if (list.length >= MAX_SHEETS) {
    throw new Error(`[demo] createNoteSheet: 시트 상한 ${MAX_SHEETS}장 초과`)
  }
  const sheet: StepNoteSheet = {
    id: genId('ns'),
    stepId,
    name: body.name,
    content: body.content || null,
    orderIndex: list.reduce((max, s) => Math.max(max, s.orderIndex), -1) + 1,
    createdAt: now(),
    updatedAt: now(),
  }
  list.push(sheet)
  return sheet
}

export function updateNoteSheet(
  stepId: string,
  sheetId: string,
  patch: UpdateNoteSheetBody,
): StepNoteSheet {
  const sheet = state.noteSheets[stepId]?.find((s) => s.id === sheetId)
  if (!sheet) throw new Error(`[demo] updateNoteSheet: 미존재 시트 ${stepId}/${sheetId}`)
  if (patch.name !== undefined) sheet.name = patch.name
  if (patch.content !== undefined) sheet.content = patch.content || null
  if (patch.orderIndex !== undefined) sheet.orderIndex = patch.orderIndex
  sheet.updatedAt = now()
  return sheet
}

export function deleteNoteSheet(stepId: string, sheetId: string): void {
  const list = state.noteSheets[stepId]
  if (!list || list.length <= 1) return // 마지막 1장은 서버도 막는다
  state.noteSheets[stepId] = list.filter((s) => s.id !== sheetId)
}

// ── 캘린더 데일리 노트 ───────────────────────────────────────
export const getDailyNotes = (): DailyNote[] => state.dailyNotes

export function createDailyNote(body: {
  date: string
  hourSlot?: number | null
  content: string
}): DailyNote {
  const note: DailyNote = {
    id: genId('dn'),
    date: body.date,
    hourSlot: body.hourSlot ?? null,
    content: body.content,
    isDone: false,
    createdAt: now(),
  }
  state.dailyNotes.push(note)
  return note
}

export function updateDailyNote(
  id: string,
  patch: { content?: string; isDone?: boolean },
): DailyNote {
  const note = state.dailyNotes.find((n) => n.id === id)
  if (!note) throw new Error(`[demo] updateDailyNote: 미존재 노트 ${id}`)
  if (patch.content !== undefined) note.content = patch.content
  if (patch.isDone !== undefined) note.isDone = patch.isDone
  return note
}

export function deleteDailyNote(id: string): void {
  state.dailyNotes = state.dailyNotes.filter((n) => n.id !== id)
}

// ── 캘린더 이벤트 (읽기 — 별표는 지원 카드에서 파생) ──────────
// year/month 를 주면 해당 월만 필터한다. 실서버는 월별로 응답하므로, 데모도 월별로 걸러야
// 캘린더가 monthly+nextMonth 를 이어붙일 때 이벤트가 중복되지 않는다(React key 충돌 방지).
export const getCalendarEvents = (filter?: { year: number; month: number }): CalendarEvent[] => {
  const prefix = filter ? `${filter.year}-${String(filter.month).padStart(2, '0')}` : null
  return state.calendarEvents
    .filter((e) => (prefix ? e.date.startsWith(prefix) : true))
    .map((e) =>
      e.type === 'step' && e.applicationId
        ? { ...e, isStarred: getApplication(e.applicationId)?.isStarred ?? false }
        : e,
    )
}

// ── 면접 질문 (읽기 + 「면접 보기」 자가평가) ────────────────
export const getInterviewQuestions = (sessionId: string): InterviewPrepQuestion[] =>
  state.interviewQuestions[sessionId] ?? []

/**
 * POST /interview-prep-questions/:id/practice — 잘함/애매/다시 저장 (비 AI).
 *
 * 못 찾은 id 는 `null` 을 돌려준다 — 실서버의 404 자리이고, 연습 루프는 그걸 조용히
 * 넘기도록 만들어져 있다 (던지면 데모에서만 루프가 멈춘다).
 */
export function recordInterviewPractice(
  questionId: string,
  result: InterviewPrepQuestion['lastPracticeResult'],
): InterviewPrepQuestion | null {
  for (const list of Object.values(state.interviewQuestions)) {
    const q = list.find((x) => x.id === questionId)
    if (!q) continue
    q.lastPracticeResult = result
    q.lastPracticedAt = now()
    return q
  }
  return null
}

// ── 회사별 자소서 ────────────────────────────────────────────
export const getCoverletters = (applicationId: string): ApplicationCoverletter[] =>
  state.coverletters[applicationId] ?? []

/** PATCH /applications/:id/coverletters/:clId — 답변 텍스트 저장 (비 AI) */
export function updateCoverletter(
  applicationId: string,
  clId: string,
  patch: UpdateCoverletterDto,
): ApplicationCoverletter {
  const cl = state.coverletters[applicationId]?.find((c) => c.id === clId)
  if (!cl) throw new Error(`[demo] updateCoverletter: 미존재 문항 ${applicationId}/${clId}`)
  if (patch.question !== undefined) cl.question = patch.question
  if (patch.category !== undefined) cl.category = patch.category
  if (patch.answer !== undefined) cl.answer = patch.answer
  if (patch.charLimit !== undefined) cl.charLimit = patch.charLimit
  cl.updatedAt = now()
  return cl
}
