import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, FileText, Mic, Star } from 'lucide-react'
import { CompanyResearchCard } from '@/components/card/CompanyResearchCard'
import { JobTitleField } from '@/components/common/JobTitleField'
import { useRequireJobTitle } from '@/hooks/useRequireJobTitle'
import { JobPostingBanner } from '@/components/coverletter/JobPostingBanner'
import { EditInterviewSessionModal } from '@/components/card/EditInterviewSessionModal'
import { AddInterviewQuestionForm } from '@/components/card/AddInterviewQuestionForm'
import { GenerateQuestionsModal } from '@/components/card/GenerateQuestionsModal'
import { InterviewQuestionCard } from '@/components/card/InterviewQuestionCard'
import { isNeedCoverletterBlocked } from '@/api/interviewPrep'
import { AiQuotaChip } from '@/components/common/AiQuotaChip'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useCoverletters, useUpdateCoverletter } from '@/hooks/useApplicationCoverletters'
import { CoverletterQuestionCard } from '@/components/coverletter/CoverletterQuestionCard'
import { SheetedNoteEditor } from '@/components/editor/SheetedNoteEditor'
import { useApplication } from '@/hooks/useApplications'
import { useDemoLink } from '@/hooks/useDemoLink'
import { pickInterviewSteps } from '@/utils/stepTemplates'
import { mergePinnedIntoNotes } from '@/utils/stepNotes'
import {
  useDeleteInterviewSession,
  useGenerateInterviewSession,
  useInterviewPrepQuestions,
  useInterviewPrepRefs,
  useInterviewPrepSession,
  useRefetchQuestionsOnGenerationEnd,
  useUpdateInterviewPrepSession,
} from '@/hooks/useInterviewPrep'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { useUnloadGuard } from '@/hooks/useUnloadGuard'
import {
  INTERVIEW_SIDEBAR_EXPANDED_STORAGE_KEY as SIDEBAR_EXPANDED_KEY,
  saveCollapseExpanded,
} from '@/utils/collapsePref'
import { toast } from '@/stores/toastStore'
import { compareByInterviewFlow } from '@/utils/practiceExam'
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  CATEGORY_STYLE_FALLBACK,
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'
import type { ApplicationStep } from '@/types/application'
import type {
  ApplicationCoverletter,
  UpdateCoverletterDto,
} from '@/types/coverletter'
import type {
  GenerateSessionDto,
  GenerateSessionResult,
  InterviewPrepQuestion,
} from '@/types/interviewPrep'

/** 트리 전체에서 **내가 직접 적은** 질문 수 — 꼬리 자리에 적은 것도 함께 센다 */
function countUserQuestions(nodes: InterviewPrepQuestion[]): number {
  return nodes.reduce(
    (sum, n) =>
      sum + (n.source === 'user' ? 1 : 0) + countUserQuestions(n.children),
    0,
  )
}

/**
 * F6 PR 2 Phase 4 — 면접 세션 풀스크린 페이지.
 *
 * 라우트: `/interviews/:sessionId` — 사이드바 "면접 준비" active 유지.
 * applicationId 는 session 응답으로부터 추출 (백엔드 user_id 가드 보장).
 */
/** 두 열이 나눠 갖지 **못하는** 폭 — `gap-5` 두 곳(40) + 구분선 열(22). grid 정의와 짝이다 */
const SPLIT_CHROME = 62

/** 추가 직후 위치 안내를 기다리는 질문들 — 목록에 나타나면 소진된다 */
type PendingAdded = { ids: string[]; multi: boolean } | null

/**
 * 토스트에 질문을 통째로 넣으면 줄이 넘친다 — 어느 질문인지 알아볼 만큼만 남긴다.
 * `trimEnd` 는 자른 자리가 공백일 때 `기술적 …` 처럼 뜨는 걸 막는다.
 */
const TOAST_CLIP = 12
const clipQuestion = (s: string) =>
  s.length > TOAST_CLIP ? `${s.slice(0, TOAST_CLIP).trimEnd()}…` : s

/**
 * 방금 들어간 질문을 잠깐 감싸는 테두리. **2.5초면 눈이 한 번 옮겨 가기에 충분**하고,
 * 계속 남으면 "선택됨" 같은 다른 상태로 읽힌다.
 *
 * 🔴 알파 틴트(`bg-brand/5`)를 두지 않는 이유 — 카드 배경이 `bg-surface-2`(불투명)라
 * 래퍼 색은 아예 보이지 않는다. 실제로 보이는 건 링뿐이라 링만 둔다.
 */
const ADDED_HIGHLIGHT_MS = 2500
const ADDED_HIGHLIGHT = 'ring-2 ring-brand/50'

export function InterviewSessionPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const {
    data: session,
    isLoading: sessionLoading,
    isError: sessionError,
  } = useInterviewPrepSession(sessionId)
  const applicationId = session?.applicationId ?? ''
  const { data: app } = useApplication(applicationId)
  // 사전 게이트 — 누르기 전에 직무를 받는다 (누른 뒤 실패로 알게 되지 않도록)
  const ensureJobTitle = useRequireJobTitle(applicationId)
  const {
    data: questions = [],
    isLoading: questionsLoading,
    isError: questionsError,
  } = useInterviewPrepQuestions(sessionId)
  const { data: refs } = useInterviewPrepRefs(sessionId)
  const { blocked: quotaBlocked, reason: quotaReason } = useAiQuotaBlocked('interview_prep_session')
  const { mutateAsync: generateSession, isPending: pendingLocal } =
    useGenerateInterviewSession(sessionId)
  /**
   * 🔴 **서버 상태를 함께 본다.** `isPending` 은 이 탭의 요청이 살아 있는 동안만 true 라,
   * 새로고침하면 false 로 돌아가 화면이 "아직 질문이 없어요" 를 띄운다 — 사용자는
   * 실패한 줄 알고 다시 누르고, in-flight lock 에 막혀 엉뚱한 문구를 본다.
   * `generationStatus` 는 새로고침해도 살아 있으므로 그걸 같이 본다.
   */
  const generating =
    pendingLocal || session?.generationStatus === 'in_progress'
  /*
    생성 중 새로고침하면 이 탭엔 mutation 이 없어 완료를 알 방법이 없었다 —
    서버는 질문을 다 만들어 놨는데 화면은 0개인 채로 생성 버튼을 다시 띄웠다.
  */
  useRefetchQuestionsOnGenerationEnd(sessionId, session?.generationStatus)
  const ensureAiConsent = useRequireAiConsent()
  // 생성 중 새로고침 = 코인만 차감되고 질문은 유실 (면접에만 이 가드가 없었다)
  useUnloadGuard(generating)
  const { mutate: updateSession, isPending: updatingSession } =
    useUpdateInterviewPrepSession(sessionId, applicationId)
  const { mutate: deleteSession } = useDeleteInterviewSession(applicationId)
  const [editing, setEditing] = useState(false)
  /**
   * 읽기 모드 — **면접 직전에 꺼내 보는 화면**.
   *
   * 이 페이지는 준비하는 화면이라 편집 표면이 촘촘하다. 대기실에서 스크롤하다
   * `AI 도움`·`꼬리질문 추가` 를 잘못 누르면 **코인이 나간다.** 읽기 모드는 그 버튼을
   * 전부 감추고, 꼬리질문까지 펼쳐 **훑어보기**에 맞춘다.
   *
   * 🔴 자소서의 `useCoverletterAiBlocked` 처럼 **강제하지 않는다** — 그건 뷰포트·네이티브에서
   * 코인 소비 AI 를 막는 제약(IAP 심사)이라, 면접에 적용하면 모바일에서 질문 생성 자체를 못 한다.
   * 여기선 사용자가 고르는 토글이다.
   */
  const [readMode, setReadMode] = useState(false)
  /** ✨ AI 질문 생성 모달 — 개수·유형을 고르고 시작한다 (질문 은행 D2b) */
  const [generateOpen, setGenerateOpen] = useState(false)
  /**
   * 🔴 **면접 ↔ 자소서 나란히 보기** (2026-08-10).
   *
   * 면접 질문은 **자소서에서 나온 것**인데(모델을 「자료 밀착도」로 골랐다), 답을 쓸 때
   * 그 자소서를 볼 수가 없어 `/board/:id/coverletter` 로 나갔다 돌아와야 했다.
   *
   * 3단으로 둔 이유 — 반반은 참고하며 쓸 때, 한쪽만은 그 일에 집중할 때다.
   * 접힌 쪽은 44px 세로 탭으로 **남긴다.** 완전히 없애면 되돌리는 법을 기억에 맡기게 된다.
   * 좁은 화면은 나란히가 불가능해 이동 버튼으로 대신한다 (아래 `narrow`).
   */
  const [split, setSplit] = useState<'iv' | 'both' | 'cl'>('iv')
  /**
   * 🔴 **오른쪽 열은 자소서만이 아니다** (2026-08-11).
   *
   * 자소서로 나란히 보기를 만들고 나니 **같은 이유로 준비 노트도 옆에 있어야 했다** —
   * 면접 준비 노트에는 기출·리서치·당일 메모가 있고(기본 포맷의 첫 칸이 「예상 질문 & 답변」),
   * 답을 다듬을 때 보게 되는 자료라는 점이 자소서와 정확히 같다. 열을 하나 더 만드는 대신
   * 오른쪽 열의 **내용을 고르게** 한다 — 3열은 열당 300px 이라 어느 것도 못 읽는다.
   *
   * 기본은 `coverletter` — 지금까지의 동작이 그대로 기본값이어야 한다.
   * 저장하지 않는다: 분할 상태(`split`) 자체가 매번 「면접만」으로 시작하는데
   * 그 안의 선택만 기억하면 기준이 둘이 된다.
   */
  const [rightPane, setRightPane] = useState<'coverletter' | 'note'>('coverletter')
  /** 면접 스텝이 여럿일 때 열에서 고른 스텝 — `null` 이면 첫 번째 */
  const [noteStepId, setNoteStepId] = useState<string | null>(null)
  /** 자소서 열의 편집 여부 — 기본은 읽기. 보러 온 거지 고치러 온 게 아니다 */
  const [clEditing, setClEditing] = useState(false)
  const [openClId, setOpenClId] = useState<string | null>(null)
  /** 면접 열이 차지하는 비율 (C안 — 경계를 끌어서 정한다) */
  const [ratio, setRatio] = useState(0.5)
  /**
   * 🔴 **`useRef` + `useLayoutEffect([])` 로는 못 붙는다** (2026-08-10 실사고).
   *
   * 첫 렌더는 세션 로딩 **스켈레톤**이라 그 시점 `ref.current` 는 `null` 이다.
   * deps 가 `[]` 면 다시 실행되지 않으므로 **ResizeObserver 가 영원히 부착되지 않고**
   * `contentW` 가 0 에 머문다 — 새로고침(cold load)에서만 그렇고 HMR·재방문에서는
   * effect 가 다시 돌아 **개발자와 사용자가 서로 다른 화면을 봤다.**
   *
   * 콜백 ref(상태)로 두면 **요소가 실제로 붙는 순간** 재실행된다.
   */
  const [splitEl, setSplitEl] = useState<HTMLDivElement | null>(null)
  /**
   * 🔴 **뷰포트가 아니라 「실제 쓸 수 있는 폭」으로 판정한다** (2026-08-10).
   *
   * 예전엔 `useMediaQuery('(max-width: 1023px)')` 였는데 두 가지가 틀렸다.
   *
   * ① **스크롤바가 경계를 넘긴다.** `window.innerWidth` 는 스크롤바를 포함하지만
   *    미디어 쿼리는 제외한다. 창이 1024px 이면 로드 직후엔 스크롤바가 없어 2열이 뜨고,
   *    질문이 채워져 스크롤바가 생기는 순간 1009px 이 되어 **손잡이가 사라졌다.**
   * ② **뷰포트가 넓어도 쓸 수 있는 폭은 훨씬 좁다.** 창 1024 − 전역 사이드바 224 −
   *    좌우 여백 72 = 콘텐츠 728px, 반반이면 열당 353px 다. 자소서 본문을 읽을 폭이 아니다.
   *
   * 컨테이너를 직접 재면 스크롤바도 사이드바 접기도 자동으로 반영된다.
   * 960px = 열당 약 460px + 구분선 22 + 여백 40 — 명조 16px 본문이 읽히는 최소선.
   */
  const [contentW, setContentW] = useState(0)
  /**
   * 🔴 **기준은 「열당 폭」에서 역산한다** — 컨테이너 폭 자체엔 의미가 없다.
   *
   *   열당 400px  ⇔  contentW 862 = 400×2 + gap 40 + 구분선 22
   *
   * 400px 은 16px 한글 기준 **약 25자/행**이다. 라틴 45~75 CPL(이상 66)을 전각 한글로
   * 환산하면 23~38자이므로 하한선에 해당한다 — 참고용 열이라 하한을 취한다.
   * 1024px 창(콘텐츠 720px · 열당 329px ≈ 20자)은 폰 폭이라 나란히가 성립하지 않는다.
   *
   * ⚠️ **`contentW === 0` 은 「측정 전」이라 넓다고 본다.** 콜백 ref 라 마운트 직후
   * `useLayoutEffect` 에서 재므로 화면에 그려지기 전에 확정된다. RO 자체가 없는 환경
   * (아주 오래된 브라우저)에서만 0 이 유지되고, 그때는 기존처럼 2열로 떨어진다.
   */
  const narrow = contentW > 0 && contentW < 862
  /**
   * 준비 노트를 붙일 면접 스텝 — 판정은 `pickInterviewSteps` 단일 구현 (세션 자료 모달의
   * 「준비 노트 보기」 링크와 같은 헬퍼다. 어긋나면 링크는 있는데 열은 없는 카드가 생긴다).
   *
   * 🔴 **0개면 오른쪽 열의 선택지에서 아예 뺀다.** 스텝이 없으면 노트도 없어서
   * 눌러도 빈 화면이 나온다 — 갈 곳이 없는 컨트롤은 두지 않는다는 기존 판단 그대로다.
   */
  const interviewSteps = pickInterviewSteps(app?.steps)
  const noteAvailable = interviewSteps.length > 0
  /**
   * 실제로 그릴 오른쪽 내용. 스텝이 없으면(또는 아직 안 왔으면) 자소서로 되돌린다 —
   * `app` 이 늦게 도착하는 동안 선택만 남아 **빈 노트 열**이 그려지는 걸 막는다.
   */
  const rightPaneView = noteAvailable ? rightPane : 'coverletter'
  const activeNoteStep =
    interviewSteps.find((s) => s.id === noteStepId) ?? interviewSteps[0] ?? null
  /*
    나란히 열었을 때만 가져온다 — 안 쓰는 화면에서 자소서까지 조회할 이유가 없다.
    준비 노트를 보는 중이면 자소서 열이 없으므로 같은 이유로 조회하지 않는다
    (노트는 `useApplication` 이 이미 들고 있는 값이라 추가 조회가 없다).
  */
  const {
    data: coverletters = [],
    isLoading: clLoading,
    isError: clError,
  } = useCoverletters(
    applicationId,
    !!applicationId && !narrow && split !== 'iv' && rightPaneView === 'coverletter',
  )
  const { mutate: updateCl } = useUpdateCoverletter(applicationId)
  /** 좁은 화면은 나란히가 불가능 — 상태와 무관하게 면접만 */
  const view = narrow ? 'iv' : split
  /**
   * 전체 접기·펼치기 — **목록 전체를 다루는 동작**이라 `✨ AI 질문 생성` 과 같은 줄에 둔다.
   * 예전엔 필터 바 안에 `ml-auto` 로 있었는데, 뒤에 카테고리 칩이 더 붙어 줄바꿈되면
   * 목록 한가운데 놓였다.
   *
   * `collapseSignal` 은 카드에 "지금 다시 맞춰라" 를 알리는 카운터다 — 카드가 각자
   * 펼침 상태를 들고 있어서(메모 입력 중 상태 보존) 값 하나로는 못 덮는다.
   */
  const [allCollapsed, setAllCollapsed] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const toggleAll = () => {
    setAllCollapsed((v) => !v)
    setCollapseSignal((n) => n + 1)
  }

  /**
   * 질문 은행 D2 — **내가 직접 적는 질문 폼**의 열림. 목록 툴바와 빈 상태 두 곳에서 연다.
   * 폼은 열린 쪽 바로 아래에 펼쳐지지만, 목록 아래쪽에서 눌렀다면 화면 밖일 수 있어 옮겨 준다
   * (`scrollIntoView` 는 jsdom 에 없어 옵셔널 호출).
   */
  /**
   * 🔴 **준비 노트에서 건너온 본문을 받는다** (2026-08-11).
   *
   * 스텝 페이지의 「이 내용으로 면접 질문 만들기」가 노트를 plain text 로 실어 보낸다
   * (`navigate(..., { state: { bridgeText } })`). 받는 쪽은 폼을 **붙여넣기로 열고
   * 채우기만** 한다 — 쪼개기·번호 떼기·중복 제외·50개 상한은 기존 파서가 그대로 하고,
   * 미리보기가 관문이라 확인 없이 서버로 나가지 않는다.
   *
   * 열림·본문을 **effect 가 아니라 초기값으로** 잡는 이유 — effect 에서 setState 하면
   * 첫 프레임엔 폼이 닫힌 채 그려졌다가 다시 열려 깜빡인다(그리고 cascading render 다).
   */
  const { state: navState } = useLocation()
  const seededText = (navState as { bridgeText?: string } | null)?.bridgeText
  const bridgeSeed = seededText?.trim() ? seededText : null

  const [addOpen, setAddOpen] = useState(bridgeSeed !== null)
  /**
   * 폼을 닫으면 비워서 **다시 열면 빈 폼**이게 한다 — 한 번 처리한 노트가
   * 「＋ 질문 추가」를 누를 때마다 되살아나면 사용자가 방금 끈 줄이 다시 켜져 온다.
   */
  const [bridgeText, setBridgeText] = useState<string | null>(bridgeSeed)
  /**
   * 🔴 **state 는 한 번만 먹는다.** 지우지 않으면 새로고침에 같은 노트가 되살아난다
   * (라우터 state 는 `history.state.usr` 에 산다). 브라우저 히스토리라는 **외부 시스템**을
   * 갱신하는 일이라 effect 가 제자리다 — 여기서 setState 는 하지 않는다.
   */
  useEffect(() => {
    if (bridgeSeed === null) return
    /*
      🔴 소비 여부의 근거는 **우리가 실제로 읽은 값**(`bridgeSeed`)이지 히스토리의 모양이
      아니다. 히스토리를 다시 들여다보고 판단하면 라우터 구현(MemoryRouter 등)에 따라
      읽은 쪽과 지우는 쪽이 엇갈려, 지운 줄 알았는데 안 지워진 채로 남는다.
      `key`·`idx` 는 라우터 것이라 건드리지 않고 `usr.bridgeText` 만 뺀다.
    */
    const hist = (window.history.state ?? {}) as Record<string, unknown>
    const usr = { ...((hist.usr as Record<string, unknown>) ?? {}) }
    delete usr.bridgeText
    window.history.replaceState({ ...hist, usr }, '')
  }, [bridgeSeed])
  const addFormRef = useRef<HTMLDivElement | null>(null)
  const closeAddForm = () => {
    setAddOpen(false)
    setBridgeText(null)
  }
  const openAddForm = () => {
    setAddOpen(true)
    // 🔴 JS 스크롤은 index.css 의 reduced-motion 미디어가 못 줄인다 — 여기서 직접 존중
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    requestAnimationFrame(() =>
      addFormRef.current?.scrollIntoView?.({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'nearest',
      }),
    )
  }

  /**
   * 질문 은행 D2 — **방금 추가한 질문이 어디로 갔는지 알려준다.**
   *
   * 🔴 목록은 `orderIndex` 가 아니라 **면접 진행 순서**(`CATEGORY_FLOW_ORDER`)로 정렬된다.
   * 그래서 직접 추가한 질문은 맨 끝이 아니라 **카테고리가 정한 자리**(미분류는 중간)로
   * 들어가고, 추가 직후 화면 아래쪽엔 아무 변화가 없어 "방금 넣은 게 어디 갔지" 가 된다.
   * 정렬을 바꾸면 리허설이 깨지므로(1번은 자기소개여야 한다) **자리를 안내한다.**
   *
   * 서버 응답 시점엔 아직 refetch 전이라 번호를 모른다 — 목록에 **실제로 나타난 뒤**
   * 안내한다 (번호를 계산하는 `CategoryFilterAndList` 의 effect 가 맡는다).
   */
  const [pendingAdded, setPendingAdded] = useState<PendingAdded>(null)
  const handleAdded = (created: InterviewPrepQuestion[]) => {
    if (created.length === 0) return
    setPendingAdded({ ids: created.map((q) => q.id), multi: created.length > 1 })
  }
  /** effect deps 에 들어가므로 렌더마다 새로 만들지 않는다 */
  const clearPendingAdded = useCallback(() => setPendingAdded(null), [])
  // 공고 요건 접힘 — 정리 안 했으면 펼쳐서 CTA 가 바로 보이게
  const [jpExpanded, setJpExpanded] = useState(true)

  /**
   * 좌측 메타 사이드바 펼침 — **데스크탑에서도 접을 수 있다** (2026-08-06).
   *
   * 이전엔 접기 버튼이 `md:hidden` 이라 모바일 전용이었고, 데스크탑에선 280px 이
   * 항상 자리를 차지했다. 공고 요건처럼 내용이 있는 카드가 들어오면서 좁아졌고,
   * 질문을 읽을 땐 사이드바가 필요 없는 순간이 많다.
   *
   * 저장된 선택이 있으면 그걸 따르고, 없을 때만 화면 폭으로 정한다
   * (모바일 기본 접힘 — 사이드바가 질문을 아래로 밀어낸다).
   */
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
      if (saved !== null) return saved === '1'
    } catch {
      /* 접근 불가(프라이빗 모드 등) → 기본 펼침 */
    }
    return true
  })
  /**
   * 🔴 **반반일 땐 자료 사이드바를 접는다.** 열이 504px 인데 280px 을 사이드바가 먹으면
   * 질문에 224px 밖에 안 남는다. 다만 `sidebarExpanded`(저장값)를 **바꾸지는 않는다** —
   * 사용자가 고른 설정이고, 「면접만」으로 돌아오면 그대로 복원돼야 한다.
   */
  const sidebarOn = sidebarExpanded && view !== 'both'

  /**
   * 🔴 **경계를 끌어 비율을 정한다** (2026-08-10 · C안).
   *
   * 헤더에 `면접 / 반반 / 자소서` 세그먼트를 뒀다가 뺐다 — 셋이 **대등해 보이는데**
   * 실제로는 면접이 주(主)고 자소서는 참조다. 의미와 형태가 어긋나 어색했다.
   * 컨트롤을 **경계로 내리면** 헤더도 비고, 화살표를 읽을 필요 없이 위치가 곧 설명이 된다
   * (VSCode·Figma·IntelliJ splitter 관용구).
   *
   * 🔴 **`pointerdown` 에서 `preventDefault()` 를 부르면 click 이 안 난다.**
   * 그래서 처음엔 아무것도 막지 않고 **4px 넘게 움직인 뒤에야** 드래그로 전환한다.
   * 안 움직였으면 그냥 클릭 — 손잡이는 누르면 면접 ↔ 자소서를 번갈아 편다.
   */
  /**
   * 🔴 **분할일 땐 바깥 스크롤을 없앤다** (2026-08-10).
   *
   * 열마다 스크롤을 주고 페이지 스크롤을 그대로 두면 **스크롤이 셋**이 된다.
   * 바깥을 내리면 두 열이 통째로 밀려 올라가 어느 것을 움직이는지 알 수 없다.
   *
   * 높이는 **재서 정한다** — 헤더 높이를 상수로 박으면 헤더가 바뀔 때 조용히 어긋난다.
   * 컨테이너의 문서상 위치를 알면 남은 높이는 `뷰포트 − 그 위치 − 아래 여백` 이다.
   * 페이지가 안 늘어나므로 `scrollY` 는 0 에 머물고 이 계산은 스스로 유지된다.
   */
  const [splitTop, setSplitTop] = useState(0)
  useLayoutEffect(() => {
    if (!splitEl || typeof ResizeObserver === 'undefined') return
    /* 위치만 rect 로 잰다 — 폭은 관찰자가 주는 값을 쓴다 (그게 실제 콘텐츠 폭이다) */
    const measureTop = () =>
      setSplitTop(splitEl.getBoundingClientRect().top + window.scrollY)
    const ro = new ResizeObserver(([entry]) => {
      setContentW(entry.contentRect.width)
      measureTop()
    })
    ro.observe(splitEl)
    window.addEventListener('resize', measureTop)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measureTop)
    }
  }, [splitEl])

  /**
   * 🔴 **분할 동안엔 페이지 스크롤을 잠근다** (2026-08-10).
   *
   * 열 높이를 뷰포트에 맞춰도 배너·공지·폰트 로딩처럼 **높이를 바꾸는 요소가 위에 있으면**
   * 몇 px 이 남아 바깥 스크롤이 되살아난다. 계산으로 그걸 전부 쫓는 대신 아예 잠근다 —
   * 스크롤은 두 열이 각자 갖고 있으므로 잠가도 못 보는 내용이 생기지 않는다.
   *
   * 🔴 `body.style.overflow` 가 아니라 **클래스**다. 모달이 같은 인라인 자리를 쓰는데,
   * 닫을 때 `''` 로 되돌리면서 이 잠금까지 풀어버린다 (`index.css` 의 `body.split-locked` 참고).
   *
   * 반드시 풀어야 한다 — 다른 화면에서 스크롤이 죽어 있으면 앱이 멈춘 것처럼 보인다.
   */
  const splitLocked = view === 'both' && !narrow
  useEffect(() => {
    if (!splitLocked) return
    document.body.classList.add('split-locked')
    return () => {
      document.body.classList.remove('split-locked')
    }
  }, [splitLocked])

  /**
   * 🔴 **손잡이는 세 상태를 순환한다** (2026-08-10 CEO: "한쪽만 펼치려면 꼭 드래그해야
   * 하는 것 같은데 이건 아닌 것 같아").
   *
   * 클릭을 전부 「반반」에 몰아주는 바람에 **한쪽만 보려면 드래그밖에 없게** 됐다.
   * 그래서 손잡이가 세 상태를 다 돈다 — 버튼을 늘리지 않고 클릭만으로 닿는다.
   *
   * 🔴 순서는 **구분선이 한 칸씩 움직이는 방향**이다:
   *
   *     면접만 ──▶ 반반 ──▶ 자소서만 ──▶ 반반 ──▶ 면접만
   *
   * 「반반 → 면접만 → 자소서만」 처럼 돌면 **면접만에서 누를 때 반반을 건너뛴다** —
   * 그건 CEO 가 이미 좋다고 한 동작이라 없애면 안 된다. 반반에서 어느 쪽으로 갈지는
   * **직전에 보던 한쪽의 반대**로 정한다 (`lastSingle`). 다음에 무엇이 되는지는
   * 툴팁·`aria-label` 이 매번 말한다.
   */
  /* 렌더에서 읽어 라벨을 만든다 — ref 를 렌더 중 읽는 건 React 규칙 위반이라 state 로 둔다 */
  const [lastSingle, setLastSingle] = useState<'iv' | 'cl'>('iv')
  const goSplit = (next: 'iv' | 'both' | 'cl') => {
    if (next === 'both') {
      ratioRef.current = 0.5
      setRatio(0.5)
    } else {
      setLastSingle(next)
    }
    setSplit(next)
  }
  /**
   * 🔴 **키보드로도 비율을 조정할 수 있어야 한다** (2026-08-10 점검).
   *
   * `aria-label` 은 「끌면 비율 조정」이라고 **말하고 있었는데 실행 수단이 없었다** —
   * 비율은 드래그 전용이라 마우스가 없으면 반반과 한쪽만 보기 사이만 오갈 수 있었다.
   * 화살표 키로 한 번에 5%씩 움직인다. 한계(15%·85%)를 넘겨 밀면 그쪽이 접힌다 —
   * 드래그를 끝까지 미는 것과 같은 규칙이라 배울 게 하나뿐이다.
   */
  const nudgeRatio = (delta: number) => {
    if (view !== 'both') {
      goSplit('both')
      return
    }
    const next = ratioRef.current + delta
    if (next <= 0.18) return goSplit('cl')
    if (next >= 0.82) return goSplit('iv')
    ratioRef.current = next
    setRatio(next)
  }

  /** 손잡이를 누르면 갈 곳 */
  const nextSplit: 'iv' | 'both' | 'cl' =
    view === 'both' ? (lastSingle === 'iv' ? 'cl' : 'iv') : 'both'
  /**
   * 🔴 오른쪽이 무엇인지에 따라 이름이 바뀐다 — 준비 노트를 보는 중에 손잡이가
   * 「자소서만」이라고 말하면 누르기 전과 후가 어긋난다 (화면 낭독기엔 이 이름이 전부다).
   */
  const rightLabel = rightPaneView === 'note' ? '준비 노트' : '자소서'
  const SPLIT_LABEL = { iv: '면접만', both: '반반', cl: `${rightLabel}만` } as const

  const ivColRef = useRef<HTMLDivElement | null>(null)
  /**
   * 언마운트 때는 스크롤을 건드리면 안 된다 — 이미 다음 화면이 그려지고 있다.
   *
   * 🔴 **`useLayoutEffect` 여야 한다.** 레이아웃 effect 의 cleanup 은 일반 effect 의
   * cleanup 보다 **먼저** 돈다. 이걸 `useEffect` 로 두면 아래 스크롤 effect 가 정리될 때
   * 이 깃발이 아직 `true` 라서 가드가 통째로 무력해진다 — 화면을 떠나는 중에
   * `scrollTo` 가 나가 **다음 화면이 튄다.**
   */
  const alive = useRef(true)
  useLayoutEffect(() => () => {
    alive.current = false
  }, [])

  /**
   * 🔴 **분할로 들어갈 때 읽던 자리를 열 안으로 옮긴다** (2026-08-10 CEO 실기 지적:
   * "아래로 스크롤한 다음 손잡이를 클릭하면 오류가 발생해").
   *
   * 분할이 되면 페이지 스크롤을 잠근다. 그런데 **잠그기만 하고 위치를 안 되돌렸다** —
   * 스크롤이 1200 인 채로 분할 영역이 문서 213px 지점에 651px 로 줄어드니 내용이 전부
   * 화면 위로 밀려나고, 방금 잠근 탓에 **되돌릴 수도 없다.** 빈 배경만 남는 막다른 길이었다.
   *
   * 0 으로 되돌리기만 해도 막다른 길은 없어지지만, 그러면 20번째 질문을 보다 나란히 열었을 때
   * 1번으로 튕긴다. 페이지 스크롤에 있던 양을 **열 스크롤로 옮겨** 보던 자리를 유지한다.
   * 나갈 때는 반대로 옮긴다 — 안 그러면 이번엔 나가면서 맨 위로 튄다.
   */
  useLayoutEffect(() => {
    if (!splitLocked || splitTop <= 0) return
    const carried = Math.max(0, window.scrollY - splitTop)
    window.scrollTo(0, 0)
    const col = ivColRef.current
    if (col) col.scrollTop = carried
    return () => {
      if (!alive.current) return
      const back = col ? col.scrollTop : 0
      window.scrollTo(0, splitTop + back)
    }
  }, [splitLocked, splitTop])

  const drag = useRef({ down: false, moved: false, raf: 0, justDragged: false })
  /** 끄는 동안의 최신 비율 — 창 리스너 클로저는 렌더 시점 state 를 못 본다 */
  const ratioRef = useRef(0.5)

  /**
   * 🔴 **끄는 동안엔 애니메이션을 끈다** (2026-08-10 CEO: "사이즈 조절할 때 버벅거리나?").
   *
   * 240ms 전환은 **세 단계 전환**(탭 클릭·두 번 누르기)을 위한 것이다. 드래그에도 켜져 있으면
   * 움직일 때마다 새 전환이 시작돼 열이 커서를 뒤늦게 따라온다 —
   * **실측: 손잡이가 커서에서 평균 79px, 최대 219px 떨어졌다.** 프레임이 밀린 게 아니라
   * (평균 8.6ms) 애니메이션이 드래그와 싸운 것이라, 최적화가 아니라 **끄는 게** 답이다.
   */
  const [dragging, setDragging] = useState(false)

  /* 끄는 중에 화면을 떠나면 선택 금지가 앱 전체에 남는다 — 글자를 못 긁게 된다 */
  useEffect(
    () => () => {
      document.body.style.userSelect = ''
    },
    [],
  )

  /**
   * 🔴 **이벤트를 창에서 받는다** (같은 날 실측에서 드러난 진짜 버그).
   *
   * 전에는 구분선 엘리먼트의 `onPointerMove` 로 받고, 4px 을 넘긴 **뒤에야**
   * `setPointerCapture` 를 했다. 그런데 구분선은 **22px 폭**이다 — 손잡이를 잡고 빠르게
   * 그으면 **첫 이동이 이미 그 밖**이라 이벤트가 안 오고, 그래서 4px 판정도 캡처도 못 한다.
   * 결과는 **잡았는데 안 따라오는 것.** 천천히 끌면 중간 이벤트가 안에 떨어져 되살아나므로
   * 「될 때도 있고 안 될 때도 있다」로 보인다.
   *
   * 캡처를 pointerdown 으로 앞당기는 방법도 있지만, 캡처 중엔 `click` 이 캡처 대상으로
   * 옮겨가 **손잡이 버튼의 click 이 죽는다** (한 번 눌러 펼치기가 그 버튼이다).
   * 창 리스너는 그 부작용이 없다.
   */
  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const startX = e.clientX
    const box = splitEl?.getBoundingClientRect()
    const wasBoth = view === 'both'
    drag.current = { down: true, moved: false, raf: 0, justDragged: false }

    const onMove = (ev: PointerEvent) => {
      const d = drag.current
      if (!d.down) return
      if (!d.moved) {
        if (Math.abs(ev.clientX - startX) <= 4) return
        d.moved = true
        document.body.style.userSelect = 'none'
        setDragging(true)
        // 접힌 상태에서 끌면 되살아난다 — 되돌리는 길이 손잡이에도 있어야 한다
        if (!wasBoth) setSplit('both')
      }
      if (!box) return
      /*
        포인터는 화면보다 자주 온다 (고주사율·정밀 마우스는 120~240Hz). 그대로 setState 하면
        **그릴 수도 없는 횟수**만큼 질문 카드 20여 개를 다시 렌더한다. 프레임당 한 번으로 묶는다.
      */
      const x = ev.clientX
      if (d.raf) return
      d.raf = requestAnimationFrame(() => {
        d.raf = 0
        /*
          🔴 `fr` 이 나눠 갖는 건 전체 폭이 아니라 **간격과 구분선을 뺀 나머지**다.
          전체 폭으로 나누면 손잡이가 가장자리로 갈수록 커서에서 최대 21px 어긋난다 —
          잡고 있는데 미끄러지는 느낌이 된다.
        */
        const track = box.width - SPLIT_CHROME
        if (track <= 0) return
        const r = Math.min(
          0.85,
          Math.max(0.15, (x - box.left - SPLIT_CHROME / 2) / track),
        )
        ratioRef.current = r
        setRatio(r)
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const d = drag.current
      if (!d.down) return
      d.down = false
      document.body.style.userSelect = ''
      if (d.raf) {
        cancelAnimationFrame(d.raf)
        d.raf = 0
      }
      setDragging(false)
      if (!d.moved) return // 안 움직였으면 onClick 이 처리한다

      /*
        🔴 **끌고 나서 놓으면 그 자리에 `click` 이 따라온다** (2026-08-10 CEO 실기 지적:
        "고정될 때도 있고 갑자기 면접이 펼쳐진다").

        손잡이가 커서를 정확히 따라가므로 **놓는 지점은 거의 항상 버튼 위**다. 그러면
        브라우저가 click 을 발행하고, 그 핸들러는 「한 번 누르면 반반」이다 — 방금 맞춘
        비율이 통째로 날아간다. 비율이 한계에 걸려 손잡이가 멈춘 경우엔 커서가 버튼을
        벗어나 클릭 대상이 달라지므로, **될 때도 있고 안 될 때도 있는** 것처럼 보인다.

        예전엔 `setPointerCapture` 가 이걸 우연히 막고 있었다 — 캡처 중 click 은 캡처
        대상(구분선 div)으로 옮겨가 버튼까지 오지 않았다. 캡처를 걷어내면서 그 방패도
        같이 사라졌다. 이제는 **의도한 자리에서 명시적으로** 막는다.

        되돌리는 건 `setTimeout(0)` 이다 — click 은 pointerup 과 같은 처리 순번에 오므로
        그 뒤에 풀린다. 이게 없으면 **다음 진짜 클릭 한 번**이 통째로 먹힌다.
      */
      d.justDragged = true
      setTimeout(() => {
        drag.current.justDragged = false
      }, 0)
      // 끝까지 밀면 접는다 — 15% 는 읽을 수 없는 폭이라 그 의도로 본다
      if (ratioRef.current <= 0.18) {
        goSplit('cl')
        ratioRef.current = 0.5
        setRatio(0.5)
      } else if (ratioRef.current >= 0.82) {
        goSplit('iv')
        ratioRef.current = 0.5
        setRatio(0.5)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const toggleSidebar = () =>
    setSidebarExpanded((prev) => {
      const next = !prev
      saveCollapseExpanded(SIDEBAR_EXPANDED_KEY, next)
      return next
    })

  /**
   * 🔴 **직접 적은 질문은 따로 센다** (질문 은행 D2b). AI 질문은 다시 만들면 되지만
   * 내가 모은 기출은 **어디에도 없다** — 면접 다녀와서 복기한 것, 카톡에서 긁어온 것이다.
   * "생성된 질문과 메모" 라는 한 줄에 뭉뚱그리면 그게 함께 사라지는 줄 모르고 지운다.
   *
   * 트리 **전체**를 세는 이유 — 꼬리 자리에 직접 적은 질문도 같이 사라진다
   * (`bulkCreateQuestions` 가 `parentQuestionId` 를 받는다).
   */
  const userQuestionCount = useMemo(
    () => countUserQuestions(questions),
    [questions],
  )

  const handleDelete = () => {
    const userLine =
      userQuestionCount > 0
        ? `\n직접 추가한 질문 ${userQuestionCount}개도 함께 삭제돼요.`
        : ''
    const ok = window.confirm(
      `🗑️ 면접 세션 "${session?.round ?? ''}" 을 정말 삭제하시겠어요?\n\n생성된 질문과 메모가 모두 삭제됩니다 (회사 조사 캐시는 보존).${userLine}\n복구할 수 없습니다.`,
    )
    if (!ok) return
    deleteSession(sessionId, {
      onSuccess: () => {
        toast.show('세션을 삭제했어요.')
        /*
          🔴 **온 자리로 돌려보낸다.** 예전엔 카드 상세(`/board/:id`)로 보냈는데,
          이 페이지는 면접 준비 모아보기에서 들어온다. 세션 하나를 지웠다고 카드
          상세로 튕기면 "내가 왜 여기 있지" 가 되고, 다른 세션을 지우려면 다시
          모아보기로 돌아와야 한다.
        */
        navigate('/interviews')
      },
      onError: () => toast.error('삭제에 실패했어요.'),
    })
  }

  /**
   * AI 질문 생성 — **모달이 고른 개수·유형으로 더한다** (질문 은행 D2b).
   *
   * 🔴 `window.confirm` 이 사라진 건 카피를 다듬어서가 아니라 **위험이 사라져서다.**
   * 예전 생성은 기존 질문과 사용자가 쓴 답변을 **전부 지우고** 새로 만들었고, 확인창은
   * 그걸 막는 마지막 문이었다. 지금 생성은 아무것도 지우지 않는다 (ADR-074 뒤집기) —
   * 지울 게 없는 동작에 확인창을 남기면 사용자는 확인창을 안 읽는 습관만 배운다.
   * 데이터가 사라지는 자리는 이제 ↻ 낱개 교체 하나뿐이고, 확인은 **거기**에 있다.
   *
   * 결과를 그대로 돌려준다 — 모달이 `NEED_COVERLETTER` 를 안내 화면으로 바꿔야 해서다.
   */
  const handleGenerate = async (
    dto: GenerateSessionDto,
  ): Promise<GenerateSessionResult | undefined> => {
    // 사전 게이트 — 취소하면 호출하지 않는다 (코인·쿼터 소모 방지)
    if (!(await ensureAiConsent())) return undefined
    if (!(await ensureJobTitle())) return undefined
    try {
      const result = await generateSession(dto)
      if (result.status === 'ok') {
        /*
          🔴 캡 때문에 덜 만들었으면 **서버 문구가 이긴다** (`notice`). 캡 숫자가 바뀔 때
          프론트도 같이 고쳐야 하는 구조를 만들지 않는다.
        */
        toast.show(
          result.notice ??
            `질문 ${result.meta?.mainCount ?? 0}개를 추가했어요 — 답변은 각 질문에서 만들 수 있어요`,
        )
        return result
      }
      /*
        자소서 게이트는 **토스트로 흘리지 않는다.** 여기서 필요한 건 "실패했어요" 가 아니라
        자소서를 쓰러 가는 길이고, 토스트는 몇 초 뒤 그 길까지 데려간다. 모달이 받는다.
      */
      if (isNeedCoverletterBlocked(result)) return result
      // 그 외 차단(쿼터·동의·생성 중복·장애)은 **서버 reason 그대로** — 진짜 이유를 덮지 않는다
      toast.error(result.reason ?? '생성에 실패했어요.')
      return result
    } catch (err) {
      // 인터셉터가 이미 토스트를 띄웠거나(400 서버 메시지) 직무 모달을 열었으면
      // 여기서 또 띄우지 않는다 — 고정 문구가 진짜 이유를 덮는다
      const shown = (err as { config?: { _toastShown?: boolean } })?.config
        ?._toastShown
      if (shown) return undefined
      const message =
        err instanceof Error ? err.message : 'AI 호출 중 오류가 발생했어요.'
      toast.error(message)
      return undefined
    }
  }

  if (sessionLoading) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <div className="h-32 bg-surface-2 border border-line rounded-xl animate-pulse" />
      </div>
    )
  }

  /**
   * 🔴 **로딩과 실패를 갈라야 한다** (2026-08-09).
   *
   * 예전엔 `if (sessionLoading || !session)` 한 줄이 둘 다 삼켰다. 조회가 **실패하면**
   * `isLoading=false` · `data=undefined` 가 되는데, 그러면 이 조건이 다시 참이라
   * **로딩이 끝났는데도 로딩 화면**으로 돌아간다. 상태가 더 안 바뀌니 영원히 그대로다.
   *
   * 삭제된 세션 링크(404) · 남의 세션(403) · 네트워크 끊김 · 배포 중 500 에서 걸리고,
   * 화면엔 빠져나갈 길이 없어 새로고침만 반복하게 된다. `main.tsx` 가 기본
   * `new QueryClient()` 라 **재시도 3회**를 이미 쓴 뒤다 — 더 기다려도 안 바뀐다.
   */
  if (!session) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <div className="border border-line bg-surface-2 rounded-xl px-5 py-10 text-center">
          <p className="text-text-primary text-sm font-semibold mb-1.5">
            면접 준비를 불러오지 못했어요
          </p>
          <p className="text-text-tertiary text-xs leading-relaxed mb-5">
            {sessionError
              ? '삭제됐거나 접근할 수 없는 세션일 수 있어요.'
              : '잠시 후 다시 시도해 주세요.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-medium text-text-secondary border border-line hover:border-line-strong px-4 py-3 rounded-lg transition-colors"
            >
              다시 시도
            </button>
            {/* 막다른 길을 만들지 않는다 — 어디로든 나갈 문이 화면에 있어야 한다 */}
            <button
              onClick={() => navigate('/interviews')}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-4 py-3 rounded-lg transition-colors"
            >
              면접 준비 목록으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalMain = questions.length
  /**
   * 생성 모달의 상한(60) 계산 근거.
   *
   * 🔴 **depth 0 만 센다 — 서버와 같은 기준이다.** 백엔드 `generateSession` 은
   * `loadDepth0Questions` 로 세어 `aiCapRemaining` 을 낸다. 꼬리질문까지 더해 세면
   * 화면이 서버보다 **먼저** 한도를 말한다 — 실제로는 40개를 더 만들 수 있는데
   * 슬라이더가 25에서 멈추고 "25개 남았어요" 라고 거짓말을 한다.
   * `questions` 는 트리의 뿌리 배열이라 그 자체가 depth 0 이다.
   */
  const aiQuestionCount = questions.filter((q) => q.source === 'ai').length
  const totalFollowup = questions.reduce(
    (n, q) => n + q.children.length + q.children.reduce((m, c) => m + c.children.length, 0),
    0,
  )

  return (
    /*
      🔴 분할일 땐 **아래 여백도 뺀다.** 열 높이를 뷰포트에 맞춰도 `pb-[88px]` 이 남아 있으면
      그만큼 페이지가 스크롤돼 「바깥 스크롤」이 되살아난다.
    */
    <div
      className={`w-full mx-auto px-[18px] pt-6 lg:max-w-[1100px] lg:px-9 lg:py-9 ${
        splitLocked ? 'pb-0 lg:pb-9' : 'pb-[88px]'
      }`}
    >
      <>
        {/* 헤더 — breadcrumb + 차수 */}
        <header className="mb-5 space-y-2">
          <div className="text-xs text-text-tertiary">
            <Link to="/interviews" className="hover:text-text-primary transition-colors">
              ← 면접 목록
            </Link>
            <span className="text-text-quaternary mx-2">·</span>
            <span>{app?.companyName ?? '...'}</span>
            <span className="text-text-quaternary mx-2">·</span>
            <span>{session.round}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-text-primary text-2xl font-bold">
              {session.round}
            </h1>
            {session.interviewType && (
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${INTERVIEW_TYPE_STYLE[session.interviewType]}`}
              >
                {INTERVIEW_TYPE_LABEL[session.interviewType]}
              </span>
            )}
            {/*
              🔴 **읽기 모드에서도 남는다.** 코인을 쓰지 않고, 면접 직전에 꺼내는 화면이
              바로 이 버튼이 가는 곳이다 (읽기 모드가 감추는 건 코인 쓰는 버튼뿐).
              질문이 하나도 없으면 볼 게 없으므로 숨긴다 — 빈 시험은 막다른 길이다.
            */}
            {questions.length > 0 && (
              <button
                onClick={() => navigate('practice')}
                className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-brand border border-line hover:border-brand/40 bg-surface-2 px-3 py-1.5 rounded-md transition-colors"
                title="질문을 골라 실전처럼 한 문항씩 보기"
              >
                <Mic size={13} strokeWidth={2} aria-hidden="true" />
                면접 보기
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className={`${questions.length > 0 ? '' : 'ml-auto '}text-xs text-text-tertiary hover:text-brand border border-line hover:border-brand/40 bg-surface-2 px-3 py-1.5 rounded-md transition-colors`}
            >
              ✎ 세션 자료
            </button>
            <button
              onClick={() => setReadMode((v) => !v)}
              aria-pressed={readMode}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                readMode
                  ? 'bg-brand text-bg border-brand'
                  : 'text-text-tertiary hover:text-brand border-line hover:border-brand/40 bg-surface-2'
              }`}
              title={
                readMode
                  ? '편집 화면으로 돌아가요'
                  : '면접 직전에 훑어보기 좋게 — 코인 쓰는 버튼을 감추고 꼬리질문까지 펼쳐요'
              }
            >
              {readMode ? '✎ 편집 모드' : '📖 읽기 모드'}
            </button>
            {/* 읽기 중에 삭제가 보일 이유가 없다 — 오탭이 가장 비싼 버튼이다 */}
            {!readMode && (
              <button
                onClick={handleDelete}
                className="text-xs text-text-tertiary hover:text-danger border border-line hover:border-danger/40 bg-surface-2 px-3 py-1.5 rounded-md transition-colors"
                title="세션 삭제 (질문·답변 모두 삭제, 회사 조사 캐시는 보존)"
              >
                🗑️ 삭제
              </button>
            )}
            {/*
              🔴 **접혀 있을 때만** 노출한다 — 펼쳐져 있으면 사이드바 안의 `←` 가 닫기를
              맡는다. 같은 일을 하는 버튼이 둘 다 보이면 어느 쪽이 무엇인지 흐려진다.
              접히면 사이드바가 통째로 사라지므로 여는 수단은 여기밖에 없다.
            */}
            {/*
              🔴 반반에선 렌더하지 않는다 (2026-08-10 점검). `sidebarOn` 이 항상 false 라
              버튼이 늘 보였는데, 눌러도 화면은 그대로이고 **저장값만 뒤집혔다** —
              「면접만」으로 돌아오면 사이드바가 사용자가 둔 것과 반대가 돼 있었다.
            */}
            {!sidebarOn && view !== 'both' && (
              <button
                onClick={toggleSidebar}
                aria-expanded={false}
                aria-label="자료 사이드바 펼치기"
                className="hidden md:inline-block text-xs text-text-tertiary hover:text-text-primary border border-line rounded-md px-2.5 py-1.5"
              >
                📋 자료 보기
              </button>
            )}
          </div>
        </header>

        {/*
          🔴 **면접 ↔ 자소서 2열.** 열 비율만 240ms 로 움직인다 (앱 `slideUp` 곡선).
          접힌 쪽은 44px 세로 탭으로 남는다 — 없애면 되돌리는 법을 기억에 맡기게 된다.
        */}
        <div
          className={
            narrow
              ? ''
              : `grid gap-5 ${
                  dragging
                    ? ''
                    : 'transition-[grid-template-columns] duration-[240ms] ease-[cubic-bezier(.32,.72,0,1)]'
                }`
          }
          ref={setSplitEl}
          style={
            narrow
              ? undefined
              : {
                  // 분할일 때만 뷰포트에 맞춘다 — 한쪽만 볼 땐 페이지 스크롤이 자연스럽다
                  height:
                    view === 'both' && splitTop > 0
                      ? `calc(100dvh - ${Math.round(splitTop)}px - 36px)`
                      : undefined,
                  gridTemplateColumns:
                    view === 'both'
                      ? `${ratio}fr 22px ${1 - ratio}fr`
                      : view === 'iv'
                        ? '1fr 22px 44px'
                        : '44px 22px 1fr',
                }
          }
        >
        {/* 🔴 좁은 화면엔 2열 자체가 없다 — 세로 탭도 렌더하지 않는다 */}
        {!narrow && view === 'cl' ? (
          <div className="min-w-0 self-start sticky top-[88px]">
            <SplitTab side="iv" onClick={() => goSplit('iv')} />
          </div>
        ) : (
        /*
          🔴 **반반일 땐 열이 각자 스크롤한다** (2026-08-10).

          페이지 스크롤 하나를 공유하면 15번 질문에 답할 때쯤 **자소서 열은 이미 끝나
          옆이 빈 공간**이다 — 「보면서 쓴다」가 그 지점에서 무효가 된다.
          시안이 성립했던 건 열마다 고정 높이 + 자기 스크롤이었기 때문인데, 그 조건을
          옮기지 않아 손잡이만 따라오고 **내용은 안 따라왔다.**

          한쪽만 볼 때(면접만·자소서만)는 페이지 스크롤 그대로 둔다 — 나란히 볼 이유가
          없는 상태에서 뷰포트를 잘라 쓸 필요가 없다.
        */
        <div
          ref={ivColRef}
          className={`min-w-0 ${
            view === 'both'
              ? 'h-full overflow-y-auto overscroll-contain pr-1'
              : ''
          }`}
        >
        {/* 접으면 열이 사라져 질문 목록이 전체 폭을 쓴다 */}
        <div
          className={`grid grid-cols-1 gap-5 ${sidebarOn ? 'md:grid-cols-[280px_1fr]' : 'md:grid-cols-1'}`}
        >
          {/* 좌측: 메타 사이드바 — 그룹화 (Linear 패턴) + 시각 위계 */}
          {/* 🔴 모바일에는 사이드바가 없다 (`hidden md:block`) — 세로로 쌓이면 카드 8개가
              질문 위를 덮어 한참 스크롤해야 질문이 나온다. 모바일에서 자료는
              `세션 자료` 모달이 전담하고, 그래서 그 모달은 사이드바의 **상위집합**이다. */}
          <aside
            className={`hidden ${sidebarOn ? 'md:block' : 'md:hidden'} space-y-5`}
          >
            {/*
              접기 손잡이 — 사이드바 맨 위, 본문 경계 쪽(오른쪽 정렬)에 둔다.
              화살표가 가리키는 방향 = 사이드바가 밀려갈 방향이라 무슨 일이 일어날지
              눌러보지 않아도 읽힌다 (Notion·Linear·VSCode 패턴).
              여는 쪽은 헤더의 `📋 자료 보기` 가 맡는다 (접히면 이 버튼이 사라지므로).
            */}
            <button
              onClick={toggleSidebar}
              aria-expanded={true}
              aria-label="자료 사이드바 접기"
              className="w-full min-h-8 flex items-center justify-end gap-1 px-1 text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
            >
              <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
              접기
            </button>

            {/* ─── 그룹 1: 회사 (primary) ─── */}
            <section className="space-y-2.5">
              <h2 className="text-text-quaternary text-[10px] font-bold uppercase tracking-wider px-1">
                회사
              </h2>

              <MetaCard title="회사·직무">
                <p className="text-text-primary text-base font-semibold">
                  {app?.companyName ?? '...'}
                </p>
                {/*
                  🔴 예전엔 `jobCategory` 만 보여줬다 — 프롬프트는 `jobTitle` 을 우선하므로
                  화면에 "금융" 이 뜨는데 질문은 개발로 나가는 어긋남이 있었다.
                  `JobTitleField` 가 같은 규칙(`resolveJobText`)으로 표시하고, 그 자리에서
                  고칠 수도 있다 — 질문의 기준값을 세션 안에서 확인·수정하게 한다.
                */}
                <div className="mt-2 pt-2 border-t border-line">
                  <JobTitleField applicationId={applicationId} />
                </div>
              </MetaCard>

              {/* 회사 조사 + 내가 알아본 정보 (primary 카드 — bg-brand/5) */}
              <CompanyResearchCard
                sessionId={sessionId}
                userNotes={session.userResearchNotes}
              />

              {/*
                v2 — 공고 요건. 세션 안에서도 확인하고, 안 해뒀으면 여기서 바로 정리한다.
                `app.jobPosting` 단일 소스라 카드 상세·자소서와 같은 내용을 본다
                (여기서 정리하면 그쪽에도 바로 반영된다).
                직무 fork 질문의 1순위 근거라 회사 조사 바로 아래 둔다.
              */}
              <JobPostingBanner
                variant="section"
                applicationId={applicationId}
                jobPosting={app?.jobPosting}
                jobPostingStatus={app?.jobPostingStatus}
                readOnly={false}
                expanded={jpExpanded}
                onToggle={() => setJpExpanded((v) => !v)}
              />
            </section>

            {/* ─── 그룹 2: 내 자료 (secondary) ─── */}
            <section className="space-y-2.5">
              <h2 className="text-text-quaternary text-[10px] font-bold uppercase tracking-wider px-1">
                내 자료
              </h2>

              <CollapsibleMetaCard
                title={`자소서 문항 · ${session.coverletterIds.length}개`}
                defaultOpen={false}
              >
                {session.coverletterIds.length === 0 ? (
                  <p className="text-text-faint text-xs">선택된 자소서 없음</p>
                ) : !refs ? (
                  <div className="space-y-1.5">
                    {session.coverletterIds.slice(0, 3).map((id) => (
                      <div
                        key={id}
                        className="h-3 bg-surface-3 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {refs.coverletters.map((cl) => (
                      <li key={cl.id} className="text-xs leading-relaxed">
                        {cl.category && (
                          <span className="inline-block text-[10px] font-medium bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded mb-1">
                            {cl.category}
                          </span>
                        )}
                        <p className="text-text-secondary line-clamp-2">
                          {cl.question}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleMetaCard>

              <CollapsibleMetaCard
                title={`📂 활동 로그 · ${session.extraLogIds.length}개`}
                defaultOpen={false}
              >
                {session.extraLogIds.length === 0 ? (
                  <p className="text-text-faint text-xs">선택된 로그 없음</p>
                ) : !refs ? (
                  <div className="space-y-1.5">
                    {session.extraLogIds.slice(0, 3).map((id) => (
                      <div
                        key={id}
                        className="h-3 bg-surface-3 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {refs.logs.map((log) => (
                      <li
                        key={log.id}
                        className="text-xs leading-relaxed border-l-2 border-line pl-2"
                      >
                        <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-text-faint text-[10px] font-mono">
                            {log.occurredAt.slice(5).replace('-', '/')}
                          </span>
                          {/* 활동명은 사용자가 직접 쓴 텍스트라 길 수 있다 —
                              min-w-0 없이는 truncate 가 죽어 320px 에서 가로로 넘친다 */}
                          <span className="min-w-0 text-text-tertiary text-[10px] font-medium truncate">
                            {log.activityName}
                          </span>
                          {log.cat && (
                            <span className="inline-block text-[10px] font-medium bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded">
                              {log.cat}
                            </span>
                          )}
                        </div>
                        <p className="text-text-secondary line-clamp-2">
                          {log.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleMetaCard>

              <CollapsibleMetaCard title="🎯 AI 강화 자료" defaultOpen={false}>
                {!session.jobDescription && !session.emphasisPoints ? (
                  <p className="text-text-tertiary text-xs leading-relaxed">
                    모집 요강·강조 포인트를 추가하면 더 정확한 질문이 나와요.
                    <br />
                    상단 <strong>"✎ 세션 편집"</strong> 을 눌러 입력하세요.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {session.jobDescription && (
                      <div>
                        <p className="text-text-tertiary text-[11px] mb-1 font-semibold">
                          모집 요강
                        </p>
                        <p className="text-text-secondary text-xs line-clamp-3 leading-relaxed">
                          {session.jobDescription}
                        </p>
                      </div>
                    )}
                    {session.emphasisPoints && (
                      <div>
                        <p className="text-text-tertiary text-[11px] mb-1 font-semibold">
                          강조 포인트
                        </p>
                        <p className="text-text-secondary text-xs line-clamp-3 leading-relaxed">
                          {session.emphasisPoints}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleMetaCard>
            </section>

            {/* ─── 그룹 3: 진행 (minimal) ─── */}
            <section>
              <div className="border-t border-line pt-3 px-1 flex items-center justify-between text-xs">
                <span className="text-text-quaternary font-medium uppercase tracking-wider text-[10px]">
                  진행
                </span>
                <div className="flex items-center gap-3 text-text-tertiary">
                  <span>
                    메인{' '}
                    <span className="text-text-primary font-mono font-semibold">
                      {totalMain}
                    </span>
                  </span>
                  <span className="text-text-faint">·</span>
                  <span>
                    꼬리{' '}
                    <span className="text-text-primary font-mono font-semibold">
                      {totalFollowup}
                    </span>
                  </span>
                </div>
              </div>
            </section>
          </aside>

          {/* 우측: 질문 트리 */}
          <main>
            {questionsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-surface-2 border border-line rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : questionsError ? (
              /*
                🔴 **실패를 빈 상태로 보여주면 데이터가 날아간다** (2026-08-09).

                훅이 `data = []` 로 떨어져서, 질문 20개짜리 세션이 조회 한 번 실패했다고
                **"아직 질문이 없어요" + [✨ AI 질문 생성]** 으로 보였다. 그리고 그 버튼은
                `handleGenerate(false)` — **재생성이 아니라 최초 생성으로 취급**되므로
                `기존 질문과 메모가 모두 삭제됩니다` 확인창도 **안 뜬다.**
                서버는 `interview-prep-ai.service.ts:726` 에서
                `em.delete(InterviewPrepQuestion, { sessionId })` 로 전부 지우고 새로 만든다.

                즉 **한 번의 조회 실패 → 한 번의 클릭 → 사용자가 쓴 답변 전량 소실 + 코인 차감.**
                에러를 빈 상태로 착각시키는 건 그냥 못 보는 것보다 나쁘다.
              */
              <div className="border border-line bg-surface-2 rounded-xl px-6 py-10 text-center">
                <p className="text-text-primary text-sm font-semibold mb-1.5">
                  질문을 불러오지 못했어요
                </p>
                <p className="text-text-quaternary text-xs leading-relaxed mb-5">
                  질문이 없는 게 아니라 <b className="font-semibold">불러오기가 실패</b>한 거예요.
                  <br />
                  새로 만들지 말고 다시 시도해 주세요.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-4 py-3 rounded-lg transition-colors"
                >
                  다시 시도
                </button>
              </div>
            ) : session?.generationStatus === 'failed' &&
              questions.length === 0 ? (
              /*
                생성이 도중에 끊긴 상태 (서버 예외·재시작). 결과가 없으므로 다시 눌러야
                하는데, 빈 화면만 두면 "왜 아무것도 없지" 가 된다. 상태를 말해 준다.
                코인은 `status='ok'` 에서만 차감되므로 실패분은 안 나갔다.
              */
              <div className="border border-dashed border-warning/40 bg-warning/5 rounded-xl px-6 py-10 text-center">
                <p className="text-warning text-sm font-medium mb-1.5">
                  질문 생성이 중간에 멈췄어요
                </p>
                <p className="text-text-quaternary text-xs leading-relaxed mb-4">
                  코인은 차감되지 않았어요. 다시 시도해 주세요.
                </p>
                {/*
                  🔴 여기서도 **모달을 거친다.** 예전엔 곧바로 재호출했지만, 생성이
                  개수·유형을 고르는 동작이 된 지금 이 버튼만 기본값(20개)으로 몰래
                  쏘면 캡 안내도 코인 문구도 건너뛴다 — 실패 직후가 가장 그게 필요한 순간이다.
                */}
                <button
                  onClick={() => setGenerateOpen(true)}
                  disabled={generating || quotaBlocked}
                  className="min-h-8 text-xs font-medium text-bg bg-brand hover:bg-accent px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  다시 시도
                </button>
              </div>
            ) : generating && questions.length === 0 ? (
              /*
                🔴 **스피너를 스켈레톤으로** — DESIGN.md 는 로딩에 스켈레톤을 쓴다.
                같은 화면의 답변 생성(InterviewQuestionCard)은 이미 스켈레톤인데 여기만
                스피너라 자기모순이었다. 스피너는 "돌고 있다" 만 말하지만, 질문 모양
                스켈레톤은 **무엇이 몇 개 올지**를 보여준다 — 10초를 기다리는 근거가 된다.
              */
              <div className="space-y-3">
                <div className="border border-dashed border-brand/40 bg-brand/5 rounded-xl px-5 py-4 text-center">
                  <p className="text-text-secondary text-sm font-medium mb-1">
                    🤖 AI 면접관이 질문을 만들고 있어요
                  </p>
                  <p className="text-text-quaternary text-xs leading-relaxed">
                    자소서·활동·회사 조사를 꼼꼼히 읽고 있어요. 1~2분쯤 걸려요.
                  </p>
                </div>
                {/* 곧 들어올 질문 카드의 자리 — 번호·태그·본문 두 줄 구조를 그대로 흉내낸다 */}
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="border border-line bg-surface-2 rounded-xl p-4 space-y-2 animate-pulse"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-6 bg-surface-3 rounded" />
                      <div className="h-3 w-16 bg-surface-3 rounded-full" />
                    </div>
                    <div className="h-3.5 w-full bg-surface-3 rounded" />
                    <div className="h-3.5 w-4/5 bg-surface-3 rounded" />
                  </div>
                ))}
              </div>
            ) : questions.length === 0 ? (
              /*
                🔴 **기본 동선이 뒤집혔다** (질문 은행 D2). 예전엔 여기 버튼이 AI 생성
                하나뿐이라, 세션을 만든 사람에게 남은 선택지가 「코인을 쓰거나 나가거나」
                였다. 실사용자 피드백은 **자기가 받은 기출을 모으고 싶다**는 것이었고,
                그건 코인도 자소서도 없이 지금 당장 할 수 있는 일이다.
                그래서 직접 추가가 주(主) 버튼이고 AI 생성은 옆에 선다.
              */
              <>
                <div className="border border-dashed border-line bg-surface-2/30 rounded-xl px-6 py-12 text-center">
                  <div className="text-2xl mb-2">✨</div>
                  <p className="text-text-secondary text-sm mb-2">
                    아직 질문이 없어요
                  </p>
                  <p className="text-text-quaternary text-xs leading-relaxed mb-5">
                    기출·예상 질문을 직접 모으고,
                    <br />
                    자소서 기반 AI 질문으로 채워보세요.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={openAddForm}
                      aria-expanded={addOpen}
                      className="bg-brand hover:bg-accent text-bg text-sm font-semibold px-5 py-2.5 rounded-md transition-colors"
                    >
                      ＋ 질문 추가
                    </button>
                    <button
                      onClick={() => setGenerateOpen(true)}
                      disabled={generating || quotaBlocked}
                      className="text-text-secondary hover:text-text-primary bg-card border border-line hover:border-line-strong text-sm font-medium px-5 py-2.5 rounded-md transition-colors disabled:opacity-50"
                      title={quotaReason ?? undefined}
                    >
                      ✨ AI 질문 생성
                    </button>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <AiQuotaChip feature="interview_prep_session" />
                  </div>
                </div>
                {addOpen && (
                  <div ref={addFormRef} className="mt-3">
                    <AddInterviewQuestionForm
                      sessionId={sessionId}
                      onClose={closeAddForm}
                      onAdded={handleAdded}
                      initialPasteText={bridgeText ?? undefined}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {/*
                  🔴 **좁은 화면 전용 — 나란히가 안 되니 건너간다** (2026-08-10).
                  1024px 미만에서는 2열이 열당 250px 도 안 나온다. 대신 자소서로 가는 길을
                  **「✨ AI 질문 생성」 바로 위**에 둔다 — 답을 쓰다 "내가 뭐라고 썼더라" 가
                  떠오르는 자리가 여기다.

                  문구가 「자소서 보기」가 아니라 **「이 면접의 바탕이 된」** 인 이유 —
                  왜 면접 화면에 자소서 링크가 있는지를 한 줄로 말해 준다.
                  답변은 자동 저장되므로(2026-08-09 flush) 나갔다 와도 글자를 잃지 않는다.
                */}
                {narrow && (
                  <Link
                    to={`/board/${applicationId}/coverletter`}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg mb-2 w-full min-h-[44px] inline-flex items-center gap-2 text-xs font-medium text-text-secondary bg-card border border-line hover:border-line-strong rounded-lg px-3.5 py-3 transition-colors"
                  >
                    <FileText size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                    이 면접의 바탕이 된 자소서 보기
                    <span className="ml-auto text-text-quaternary" aria-hidden="true">
                      →
                    </span>
                  </Link>
                )}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-text-tertiary text-xs">
                      메인 {totalMain}개 · 꼬리 {totalFollowup}개
                    </p>
                    <AiQuotaChip feature="interview_prep_session" />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/*
                      질문 은행 D2 — 직접 적은 질문을 **목록 옆에서** 바로 더한다.
                      읽기 모드는 훑어보기 전용이라 편집 표면을 두지 않는다 (↻ 와 같은 조건).
                    */}
                    {!readMode && (
                      <button
                        type="button"
                        onClick={() => (addOpen ? closeAddForm() : openAddForm())}
                        aria-expanded={addOpen}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-2.5 py-1 rounded-md transition-colors"
                      >
                        ＋ 질문 추가
                      </button>
                    )}
                    {/*
                      🔴 **좁은 화면에선 감춘다** (2026-08-09). 모바일 목록은 이제 한 줄
                      요약이라 접을 게 없다 — 눌러도 아무 일이 안 일어나는 **거짓 어포던스**가
                      된다. 카드가 실제로 펼쳐지는 건 넓은 화면뿐이다.
                    */}
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="hidden sm:inline-flex text-xs text-text-tertiary hover:text-text-primary transition-colors items-center gap-1"
                    >
                      <CollapsibleChevron open={!allCollapsed} />
                      {allCollapsed ? '전체 펼치기' : '전체 닫기'}
                    </button>
                    {/* 읽기 모드엔 코인 쓰는 버튼을 두지 않는다 */}
                    {!readMode && (
                      <button
                        onClick={() => setGenerateOpen(true)}
                        disabled={generating || quotaBlocked}
                        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary text-xs disabled:opacity-50"
                        /*
                          🔴 문구가 `↻ 다시 생성` → `✨ AI 질문 생성` 으로 바뀐 건 카피
                          다듬기가 아니라 **동작이 달라져서다.** 이 버튼은 더 이상 기존
                          질문을 지우지 않는다 — 고른 개수만큼 **더한다.** `다시` 를 남겨
                          두면 사용자는 여전히 답변이 날아갈까 봐 누르지 못한다.
                        */
                        title={quotaReason ?? '고른 개수만큼 AI 질문을 더 만들어요'}
                      >
                        {/* 버튼 로딩은 하우스 패턴대로 **텍스트 변경**만 (스피너 없음) */}
                        <span>
                          {generating ? '만들고 있어요…' : '✨ AI 질문 생성'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {addOpen && !readMode && (
                  <div ref={addFormRef}>
                    <AddInterviewQuestionForm
                      sessionId={sessionId}
                      onClose={closeAddForm}
                      onAdded={handleAdded}
                      initialPasteText={bridgeText ?? undefined}
                    />
                  </div>
                )}
                <CategoryFilterAndList
                  questions={questions}
                  sessionId={sessionId}
                  applicationId={applicationId}
                  readOnly={readMode}
                  allCollapsed={allCollapsed}
                  collapseSignal={collapseSignal}
                  pendingAdded={pendingAdded}
                  onAddedShown={clearPendingAdded}
                />
              </>
            )}
          </main>
        </div>
        </div>
        )}

        {/*
          🔴 **손잡이는 방향을 말하지 않는다.** 화살표를 두면 「이 화살표를 눌러 저쪽으로」로
          읽혀 누를 때마다 방향을 판단하게 된다. 잡는 곳 표시만 둔다.

          🔴 **누르면 반반이다** (2026-08-10 점검에서 뒤집음). 전에는 전면 스왑이었고
          반반은 **더블클릭 전용**이었는데, 실측해 보니 **사람 속도에서 아예 안 됐다** —
          첫 클릭이 즉시 스왑하면서 구분선이 240ms 에 걸쳐 반대편으로 **이동**해,
          두 번째 클릭이 그 자리에 없는 손잡이 대신 밑에 깔린 카드를 누른다
          (0·120·250·400ms 전부 반반에 도달하지 못했다). 그래서 나란히 보기로 가는 길이
          사실상 드래그 하나뿐이었다 — **이 화면을 만든 이유가 숨어 있었던 셈**이다.
          내 e2e 는 `dblclick()` 이 기계 속도라 전환 전에 두 번째 클릭이 꽂혀 통과했다.

          지금은 역할이 갈린다 (2026-08-10 CEO: "이거 분할이 아니라 서로 펼치는 걸로") —
          **세로 탭은 「펼치기」라고 쓰여 있으니 그 말대로** 그쪽만 펼치고, **반반은 손잡이**가
          맡는다. 한쪽만 보기는 손잡이를 계속 눌러도, 드래그를 끝까지 밀어도
          (`ratio ≤ 0.18` · `≥ 0.82`) 된다. 더블클릭 핸들러는 지웠다 —
          남겨두면 두 번째 클릭이 이동해버린 손잡이 대신 엉뚱한 카드에 떨어진다.
        */}
        {!narrow && (
          <div
            onPointerDown={onDividerDown}
            /*
              🔴 **`items-center` 면 손잡이가 문서 한가운데로 간다.** 구분선은 열 전체 높이만큼
              늘어나는데, 질문 20개가 펼쳐지면 수천 px 이 되어 손잡이가 화면 밖으로 나간다 —
              「잠깐 있다가 없어진다」의 정체가 이것이었다. 접힌 세로 탭이 이미 `sticky` 인 것과
              같은 이유로, 손잡이도 화면에 붙어 따라와야 한다.

              🔴 붙이는 위치는 **화면 세로 중앙**(`50vh − 손잡이 절반`)이다. `top-[88px]` 로
              두면 화면 꼭대기에 붙어 두 열의 경계라기보다 헤더의 일부처럼 읽힌다.
              sticky 는 자연 위치가 `top` 보다 위면 아래로 밀어주므로, 스크롤 0 에서도
              중앙에 온다. 열이 짧으면 구분선 박스 안으로 제한돼 알아서 위로 붙는다.
            */
            /*
              🔴 **`touch-none` 없이는 터치 화면에서 드래그가 성립하지 않는다** (2026-08-10 점검).
              브라우저는 터치 제스처를 기본적으로 **스크롤로 가져간다** — 손잡이를 잡고 그으면
              몇 px 만에 `pointercancel` 이 날아와 끊긴다. 터치 노트북·아이패드 가로(1024+)가
              분할이 뜨는 폭이라 실제로 닿는 조합이다.
            */
            className="relative flex items-start justify-center cursor-col-resize group touch-none"
          >
            {/*
              🔴 세로선을 **실제 요소**로 그린다. `before:bg-line` 은 빌드에서 생성되지 않아
              (`line` 이 borderColor·divideColor 쪽 토큰이라 `before:` 조합이 안 나왔다)
              선이 통째로 안 보였다 — 손잡이만 공중에 뜬 상태였다.
            */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 border-l border-line group-hover:border-line-strong transition-colors"
            />
            <button
              type="button"
              onClick={() => {
                if (drag.current.justDragged) return // 방금 끈 것 — 클릭이 아니다
                goSplit(nextSplit)
              }}
              title={`${SPLIT_LABEL[nextSplit]} 보기 · 끌면 비율 조정`}
              /*
                🔴 접힌 열의 세로 탭도 「자소서 펼치기」다 — 이름이 같으면 화면 낭독기에서
                두 컨트롤이 구분되지 않는다. 여기는 **구분선**임을 이름에 넣는다.
              */
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  nudgeRatio(-0.05)
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  nudgeRatio(0.05)
                }
              }}
              /*
                🔴 `aria-valuenow` 류는 **`role="button"` 에서 무시된다** — 값을 알리려면
                `role="separator"`(WAI window splitter) 로 바꿔야 하는데, 그러면 이 손잡이의
                **주 동작인 클릭이 안 읽힌다.** 여기선 누르는 게 먼저고 비율은 부가라,
                무효 속성을 지우고 **현재 비율을 이름에 담는다.**
              */
              aria-label={`구분선 — 누르면 ${SPLIT_LABEL[nextSplit]}, 화살표 키로 비율 조정${
                view === 'both' ? ` (현재 ${Math.round(ratio * 100)}%)` : ''
              }`}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg sticky top-[calc(50vh-28px)] flex flex-col gap-[3px] px-1 py-2.5 rounded-md bg-surface-2 border border-line hover:bg-surface-3 hover:border-line-strong transition-colors cursor-col-resize"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="w-0.5 h-[9px] rounded-sm bg-text-quaternary/60 group-hover:bg-text-tertiary transition-colors"
                />
              ))}
            </button>
          </div>
        )}

        {/* ── 오른쪽 열 — 자소서 또는 준비 노트 ── */}
        {narrow ? null : view === 'iv' ? (
          /*
            🔴 **접힌 채로도 무엇이 있는지 보인다** (2026-08-11). 탭을 하나만 두고 안에서
            고르게 하면, 준비 노트가 여기 있다는 걸 **한 번 열어 본 사람만** 알게 된다.
            누른 쪽이 곧 오른쪽 열의 내용이 되고, 여는 방식(그쪽만 전체 펼침)은 기존 그대로다 —
            버튼에 「펼치기」라고 쓰여 있으면 그 말대로 펼친다(반반은 손잡이가 맡는다).
          */
          <div className="min-w-0 self-start sticky top-[88px] flex flex-col items-center gap-2">
            <SplitTab
              side="cl"
              onClick={() => {
                setRightPane('coverletter')
                goSplit('cl')
              }}
            />
            {noteAvailable && (
              <SplitTab
                side="note"
                onClick={() => {
                  setRightPane('note')
                  goSplit('cl')
                }}
              />
            )}
          </div>
        ) : rightPaneView === 'note' && activeNoteStep ? (
          <StepNotePane
            scrollable={view === 'both'}
            applicationId={applicationId}
            steps={interviewSteps}
            step={activeNoteStep}
            onSelectStep={setNoteStepId}
            switcher={
              <RightPaneSwitch value={rightPaneView} onChange={setRightPane} />
            }
          />
        ) : (
          <CoverletterPane
            loading={clLoading}
            error={clError}
            scrollable={view === 'both'}
            coverletters={coverletters}
            applicationId={applicationId}
            editing={clEditing}
            onEditingChange={setClEditing}
            openId={openClId}
            onOpen={setOpenClId}
            onUpdate={(clId, dto) => updateCl({ clId, dto })}
            switcher={
              noteAvailable ? (
                <RightPaneSwitch value={rightPaneView} onChange={setRightPane} />
              ) : null
            }
          />
        )}
        </div>
      </>

      {editing && (
        <EditInterviewSessionModal
          session={session}
          questionCount={totalMain}
          isSaving={updatingSession}
          onClose={() => setEditing(false)}
          onSave={(dto, refs) => {
            updateSession(
              { ...dto, ...refs },
              {
                onSuccess: () => {
                  setEditing(false)
                  toast.show(
                    '저장됐어요. "✨ AI 질문 생성" 을 누르면 새 자료 기반 질문이 만들어져요.',
                  )
                },
                onError: () => toast.error('저장에 실패했습니다.'),
              },
            )
          }}
        />
      )}

      {generateOpen && (
        <GenerateQuestionsModal
          onClose={() => setGenerateOpen(false)}
          applicationId={applicationId}
          aiQuestionCount={aiQuestionCount}
          hasQuestions={totalMain > 0}
          onGenerate={handleGenerate}
          generating={generating}
          quotaBlocked={quotaBlocked}
          quotaReason={quotaReason}
        />
      )}
    </div>
  )
}

/**
 * 접힌 열 — 44px 세로 탭.
 *
 * 🔴 **완전히 없애지 않는다.** 사라지면 되돌리는 법을 기억에 맡기게 되고, 한 번 접은
 * 사용자는 다시 안 켠다. 같은 판단을 면접 카드의 AI 답변 접기에서도 했다.
 */
function SplitTab({
  side,
  onClick,
}: {
  side: 'iv' | 'cl' | 'note'
  onClick: () => void
}) {
  const label = side === 'iv' ? '면접' : side === 'cl' ? '자소서' : '준비 노트'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={false}
      aria-label={`${label} 펼치기`}
      title={`${label} 펼치기`}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg shrink-0 min-w-0 w-11 rounded-xl border border-line bg-card hover:bg-surface-3 transition-colors flex flex-col items-center gap-2 py-4"
    >
      {/*
        🔴 **텍스트 문자 chevron 금지** (memory `feedback_collapsible_chevron`).
        `‹` `›` 는 폰트마다 크기·baseline 이 달라 다른 chevron 들과 안 맞고 토큰 색 제어도
        어긋난다. 같은 파일이 이미 lucide `ChevronLeft` 를 쓰고 있어 그걸 재사용한다 —
        오른쪽 방향은 뒤집는다 (`ChevronRight` 를 새로 들일 이유가 없다).
      */}
      <ChevronLeft
        size={14}
        strokeWidth={2}
        aria-hidden="true"
        className={`text-text-quaternary ${side === 'iv' ? '' : 'rotate-180'}`}
      />
      <span
        className="text-[11px] font-semibold text-text-tertiary [writing-mode:vertical-rl]"
      >
        {label}
      </span>
    </button>
  )
}

/**
 * 오른쪽 열 전환 — **자소서 ↔ 준비 노트** (2026-08-11).
 *
 * 🔴 **열려 있는 동안에도 바꿀 수 있어야 한다.** 세로 탭만 두면 바꾸려고 열을 한 번 접었다
 * 다시 펴야 하고, 그 사이 비율이 리셋된다(`goSplit('both')` 가 0.5 로 되돌린다).
 * 여기서 바꾸면 `split`·`ratio` 를 건드리지 않으므로 **보던 비율 그대로** 내용만 갈린다.
 *
 * 문법은 같은 헤더의 「읽기 / 편집」 토글 그대로다 — 한 줄에 세그먼트가 둘인데 생김새가
 * 다르면 둘 중 하나는 다른 것처럼 읽힌다.
 */
function RightPaneSwitch({
  value,
  onChange,
}: {
  value: 'coverletter' | 'note'
  onChange: (v: 'coverletter' | 'note') => void
}) {
  return (
    <div
      role="group"
      aria-label="오른쪽 열 내용"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-line"
    >
      {(
        [
          ['coverletter', '자소서'],
          ['note', '준비 노트'],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${
            value === v
              ? 'bg-card-solid text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-secondary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * 준비 노트 열 — **스텝 페이지의 노트 그대로** (체크리스트·일정·완료 버튼은 제외).
 *
 * 🔴 **왜 여기 있나** — 면접 준비 노트의 기본 포맷 첫 칸이 「예상 질문 & 답변」이다. 즉
 * 여기 적힌 게 곧 이 세션에서 다듬는 것이고, 그런데도 답을 쓰는 화면에서는 볼 수가 없어
 * 카드 상세 → 스텝으로 나갔다 돌아와야 했다 (자소서와 정확히 같은 이유다).
 *
 * 🔴 **읽기 전용이 아니라 편집 가능**이다. 자소서 열과 다른 점인데, 자소서는 「면접 참고용
 * 재료」라 손대는 게 예외지만 노트는 **면접 준비 그 자체**다 — 질문을 보다 떠오른 걸
 * 적는 게 이 열의 용도이므로 막으면 다시 나갔다 와야 한다.
 * 자동 저장(1.5s)·저장 상태 표시는 `StepNoteEditor`(→ `RichTextEditor`) 소관이다.
 */
function StepNotePane({
  scrollable,
  applicationId,
  steps,
  step,
  onSelectStep,
  switcher,
}: {
  /** 반반일 때만 자기 스크롤 — 한쪽만 볼 땐 페이지 스크롤이 자연스럽다 */
  scrollable: boolean
  applicationId: string
  /** 면접형 스텝 전부 — 2개 이상이면 열 안에서 고른다 */
  steps: ApplicationStep[]
  step: ApplicationStep
  onSelectStep: (stepId: string) => void
  switcher: React.ReactNode
}) {
  const link = useDemoLink()

  /*
    시트가 0장인 스텝에서만 첫 탭에 보이는 **폴백**이다 (`StepPage` 와 같은 규칙).
    죽은 `pinnedContent` 는 여기서 📌 문단으로 앞에 붙고, 승격될 때 시트로 함께 복사된다.
    원본 `notes`·`pinnedContent` 는 이 화면에서 갱신하지 않는다 — 저장은 전부 시트 API 다.
  */
  const initialNotes = mergePinnedIntoNotes(step.notes, step.pinnedContent)

  return (
    <section
      className={`min-w-0 ${
        scrollable ? 'h-full overflow-y-auto overscroll-contain pr-1' : ''
      }`}
      aria-label="면접 준비 노트"
    >
      <div className="shrink-0 mb-4 space-y-3">
        {switcher}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-text-primary text-lg font-bold truncate">
              {step.name}
            </h2>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              면접 준비 노트 · 적는 대로 저장돼요
            </p>
          </div>
          {/*
            조용한 출구 — 체크리스트·일정처럼 여기 없는 것들이 어디 있는지 알려 준다.
            자소서 열의 「자소서 화면에서 열기 ↗」와 같은 자리·같은 문법이다.
          */}
          <Link
            to={link(`/board/${applicationId}/steps/${step.id}`)}
            title="체크리스트·일정·장소는 스텝 화면에서"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg shrink-0 text-[11px] text-text-tertiary hover:text-text-secondary underline underline-offset-2 decoration-text-quaternary/50 whitespace-nowrap"
          >
            전체 화면으로 →
          </Link>
        </div>

        {/*
          🔴 면접 스텝이 여럿인 카드가 흔하다 (1차 실무 · 2차 임원 · 컬처핏). 어느 노트인지
          **세션이 정해 줄 수 없어서**(세션은 스텝에 묶여 있지 않다) 여기서 고르게 한다.
          하나뿐이면 고를 게 없으므로 렌더하지 않는다 — 선택지 1개짜리 select 는 잡음이다.
        */}
        {steps.length > 1 && (
          <span className="relative block">
            <select
              value={step.id}
              onChange={(e) => onSelectStep(e.target.value)}
              aria-label="준비 노트를 볼 면접 단계"
              className="w-full appearance-none bg-surface-2 border border-line rounded-md pl-2.5 pr-9 py-1.5 text-[11px] text-text-secondary focus:outline-none focus:bg-surface-3 focus:border-brand/60 transition-colors cursor-pointer"
            >
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none"
            >
              <path
                d="M2 4l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>

      {/*
        🔴 **`key` 가 없으면 스텝을 바꿔도 글이 안 바뀐다.** tiptap 은 `content` 를 초기화
        시점에만 읽으므로, 같은 자리에서 prop 만 갈아끼우면 **직전 스텝의 노트를 그대로
        보여주면서 새 스텝에 저장한다** — 조용히 남의 노트를 덮어쓰는 경로다.
        시트 컨테이너도 같은 이유로 통째 remount 한다 (고른 탭·미저장분이 스텝을 넘어가면
        남의 스텝 시트에 저장된다).
      */}
      <SheetedNoteEditor
        key={step.id}
        appId={applicationId}
        stepId={step.id}
        stepName={step.name}
        fallbackContent={initialNotes}
      />
    </section>
  )
}

/**
 * 자소서 열 — **실제 자소서 화면 그대로** (AI 채팅 패널만 제외).
 *
 * 🔴 **왜 여기 있나** — 면접 질문은 자소서에서 나온 것인데(모델을 「자료 밀착도」로 골랐다),
 * 답을 쓸 때 그 자소서를 볼 수가 없어 화면을 나갔다 돌아와야 했다. 재료를 안 보여주고
 * 요리를 시키는 구조였다.
 *
 * 🔴 **읽기가 기본이고 편집은 `simpleEdit`** — 여기서 하는 일은 참고지 자소서 작업이 아니다.
 * 유형·글자수 제한·AI·가져오기·정리·삭제는 감추고 **답변 글자만** 고치게 한다.
 * 그 기능들이 어디 있는지는 헤더의 조용한 링크가 알려 준다.
 */
function CoverletterPane({
  loading,
  error,
  scrollable,
  coverletters,
  applicationId,
  editing,
  onEditingChange,
  openId,
  onOpen,
  onUpdate,
  switcher,
}: {
  /** 반반일 때만 자기 스크롤 — 한쪽만 볼 땐 페이지 스크롤이 자연스럽다 */
  loading: boolean
  error: boolean
  scrollable: boolean
  coverletters: ApplicationCoverletter[]
  applicationId: string
  editing: boolean
  onEditingChange: (v: boolean) => void
  openId: string | null
  onOpen: (id: string | null) => void
  onUpdate: (clId: string, dto: UpdateCoverletterDto) => void
  /** 자소서 ↔ 준비 노트 전환 — 면접 스텝이 없으면 `null` (고를 게 없다) */
  switcher: React.ReactNode
}) {
  // 아무것도 안 열려 있으면 첫 문항 — 빈 열을 보여줄 이유가 없다
  const activeId = openId ?? coverletters[0]?.id ?? null

  return (
    <section
      className={`min-w-0 ${
        scrollable
          ? 'h-full overflow-y-auto overscroll-contain pr-1 flex flex-col'
          : ''
      }`}
      aria-label="자기소개서"
    >
      {/* 전환 세그먼트는 제목 위 — 제목·링크 줄에 끼우면 460px 열에서 셋이 서로를 밀어낸다 */}
      {switcher && <div className="shrink-0 mb-3">{switcher}</div>}
      <div className="shrink-0 flex items-start gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-text-primary text-lg font-bold">자기소개서</h2>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            문항 {coverletters.length}개 · 면접 질문이 여기서 나왔어요
          </p>
        </div>
        {/*
          🔴 **조용한 출구.** 여기선 글자만 고친다 — AI·답변 가져오기·정리·삭제는 감춰져 있다.
          그걸 아는 사람이 「어디 갔지」 하지 않게 **어디 있는지**를 말해 준다.
          다만 왔다갔다를 없애려고 만든 화면이라 버튼이 아니라 **링크**로 둔다.
        */}
        <Link
          to={`/board/${applicationId}/coverletter`}
          title="AI 도움 · 답변 가져오기 · 정리 · 문항 추가는 자소서 화면에서"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg shrink-0 text-[11px] text-text-tertiary hover:text-text-secondary underline underline-offset-2 decoration-text-quaternary/50 whitespace-nowrap"
        >
          자소서 화면에서 열기 ↗
        </Link>
        <div className="shrink-0 flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-line">
          {([[false, '읽기'], [true, '편집']] as const).map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => onEditingChange(v)}
              aria-pressed={editing === v}
              className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                editing === v
                  ? 'bg-card-solid text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/*
        🔴 **모르는 상태를 「없음」으로 말하지 않는다** (2026-08-10 점검).
        이 쿼리는 나란히 열 때 **처음** 켜지므로, 가르지 않으면 여는 순간마다
        「문항이 없어요」가 번쩍이고 조회가 실패하면 **그 거짓말이 영구 고정**된다 —
        세션이 참조하는 자소서가 실제로 있는데도.
      */}
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-card border border-line rounded-[14px] p-4 space-y-2.5"
            >
              <div className="h-3 w-24 bg-surface-3 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-surface-3 rounded animate-pulse" />
              <div className="h-3 w-full bg-surface-3 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-surface-2 border border-line rounded-xl p-8 text-center">
          <p className="text-text-secondary text-sm font-medium mb-1.5">
            자소서를 불러오지 못했어요
          </p>
          <p className="text-text-quaternary text-xs leading-relaxed mb-4">
            잠시 후 다시 시도해 주세요.
          </p>
          <Link
            to={`/board/${applicationId}/coverletter`}
            className="inline-flex items-center justify-center min-h-[44px] text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-4 py-3 rounded-lg transition-colors"
          >
            자소서 화면에서 보기
          </Link>
        </div>
      ) : coverletters.length === 0 ? (
        <div className="bg-surface-2 border border-dashed border-line rounded-xl p-8 text-center">
          <p className="text-text-secondary text-sm font-medium mb-1.5">
            아직 작성된 자소서 문항이 없어요
          </p>
          <p className="text-text-quaternary text-xs leading-relaxed mb-4">
            면접 질문은 자소서를 바탕으로 만들어져요.
          </p>
          <Link
            to={`/board/${applicationId}/coverletter`}
            className="inline-block min-h-[44px] text-xs font-semibold text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-4 py-3 rounded-lg transition-colors"
          >
            자소서 쓰러 가기
          </Link>
        </div>
      ) : (
        <div className="shrink-0 space-y-3">
          {coverletters.map((cl, i) => (
            <CoverletterQuestionCard
              key={cl.id}
              cl={cl}
              number={i + 1}
              applicationId={applicationId}
              expanded={cl.id === activeId}
              onToggle={() => onOpen(cl.id === activeId ? null : cl.id)}
              onUpdate={(dto) => onUpdate(cl.id, dto)}
              /* simpleEdit 이면 삭제·AI 는 렌더되지 않는다 — 호출될 일이 없다 */
              onDelete={() => {}}
              onAskAI={() => {}}
              readOnly={!editing}
              simpleEdit={editing}
            />
          ))}
        </div>
      )}

      {/*
        🔴 **바닥 마무리 줄** (2026-08-10 CEO 실기 지적 — "분할되면 아래가 좀 비어보인다").

        열 높이를 뷰포트에 고정했더니 자소서 문항이 적을 때 아래가 통째로 빈 배경이 됐다
        (실측: 문항 2개 = 174px). 배경 패널로 덮는 방법은 접었다 — 라이트 모드에서
        카드(`bg-card` 크림)와 `surface`(흰색)가 거의 붙어 **카드가 묻힌다.**

        대신 **바닥에 붙는 한 줄**로 끝을 만든다. 문항이 많아 열이 넘치면 `mt-auto` 는
        0 이 되어 내용 뒤에 그냥 따라붙는다 — 짧을 때만 바닥으로 내려간다.

        문구는 헤더가 안 하는 말을 한다: **여기선 왜 버튼이 적은지.** 지금 그 설명은
        헤더 링크의 `title` 에만 있어 마우스를 올려야 보인다.
      */}
      {!loading && !error && coverletters.length > 0 && (
        <div className="mt-auto shrink-0 pt-6">
          <div className="border-t border-line pt-3 flex items-center gap-3 text-[11px] text-text-quaternary">
            <span>여기선 글자만 고쳐요</span>
            <Link
              to={`/board/${applicationId}/coverletter`}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ml-auto py-2 text-text-tertiary hover:text-text-secondary underline underline-offset-2 decoration-text-quaternary/50 whitespace-nowrap"
            >
              AI · 문항 추가는 자소서 화면에서 ↗
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

function MetaCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-line bg-surface-2 rounded-lg p-3.5">
      <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider mb-2.5">
        {title}
      </h3>
      {children}
    </div>
  )
}

/** Notion 식 collapsible 카드 — chevron 좌측 + 부드러운 토글 */
function CollapsibleMetaCard({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-line bg-surface-2 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? `${title} 접기` : `${title} 펼치기`}
        className="w-full flex items-center gap-2 px-3.5 py-3 hover:bg-surface-3 transition-colors"
      >
        <CollapsibleChevron open={open} />
        <h3 className="text-text-primary text-xs font-bold uppercase tracking-wider text-left">
          {title}
        </h3>
      </button>
      {open && <div className="px-3.5 pb-3.5">{children}</div>}
    </div>
  )
}

/**
 * F1 v2 Phase 5b — 카테고리 chip filter + 그룹/평면 보기 toggle.
 * main 20개 + 카테고리 18종 → 사용자가 카테고리 누르면 해당만, '전체' = 모두.
 */
function CategoryFilterAndList({
  questions,
  sessionId,
  applicationId,
  readOnly = false,
  allCollapsed,
  collapseSignal,
  pendingAdded = null,
  onAddedShown,
}: {
  questions: InterviewPrepQuestion[]
  sessionId: string
  applicationId: string
  /** 읽기 모드 — 카드까지 그대로 내려간다 (꼬리질문 포함) */
  readOnly?: boolean
  /** 전체 접기·펼치기 — 버튼은 부모(AI 질문 생성 옆)에 있고 상태만 내려온다 */
  allCollapsed: boolean
  collapseSignal: number
  /** 방금 추가돼 위치 안내를 기다리는 질문들 — 번호를 여기서 매기므로 안내도 여기서 한다 */
  pendingAdded?: PendingAdded
  onAddedShown?: () => void
}) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  /**
   * 우선 질문만 보기 — 실제 면접에서 받는 질문이 5개 안팎이라 20개를 다 준비하는 건
   * 현실과 맞지 않다. "먼저 할 것" 만 추려 보는 창구다.
   */
  const [onlyMust, setOnlyMust] = useState(false)
  const mustCount = useMemo(
    () => questions.filter((q) => q.mustPrepare).length,
    [questions],
  )
  /**
   * 🔁 지난 「면접 보기」에서 「다시」로 찍은 것만 — **연습의 결과가 준비로 이어지는 길**이다.
   * 연습 화면은 답을 고쳐 쓸 수 없으니, 찍고 나서 할 일은 결국 여기로 돌아오는 것이다.
   *
   * 연습 전 세션은 전부 `null` 이라 0개다 — 그땐 칩 자체를 안 띄운다 (⭐ 와 같은 규칙).
   */
  const [onlyAgain, setOnlyAgain] = useState(false)
  const againCount = useMemo(
    () => questions.filter((q) => q.lastPracticeResult === 'again').length,
    [questions],
  )
  /**
   * 전체 접기·펼치기 — 메인은 기본 펼침이라 20문항이면 화면이 매우 길어진다.
   * 목록을 훑을 땐 접고, 준비할 문항을 정하면 그것만 펼치는 흐름이다.
   *
   * `collapseSignal` 은 **카드에 "지금 다시 맞춰라" 를 알리는 카운터**다. 카드가 각자
   * 펼침 상태를 들고 있어서(메모 입력 중 유실 방지), 부모가 통째로 소유하지 않고
   * 신호만 보낸다. 카드는 신호가 바뀐 렌더에서만 자기 상태를 재설정한다.
   */

  // 카테고리별 카운트 (UI chip badge)
  const catCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of questions) {
      const c = q.category ?? '(미분류)'
      map.set(c, (map.get(c) ?? 0) + 1)
    }
    return map
  }, [questions])

  /**
   * 🔴 **면접 진행 순서로 정렬하고, 그 순서로 번호를 매긴다.**
   *
   * 번호는 **필터보다 먼저** 확정한다 — 필터를 걸 때마다 번호가 1부터 다시 매겨지면
   * "3번 질문" 이 화면마다 달라져서 기억할 수가 없다. 전체 기준 번호를 들고 다닌다.
   *
   * 우선순위로 정렬하지 않는 이유는 `CATEGORY_FLOW_ORDER` 주석 참고 — 자기소개가
   * 1번이어야 리허설이 된다.
   */
  const numbered = useMemo(() => {
    return [...questions]
      /* 「면접 보기」의 `차례` 와 **같은 함수** — 목록 번호와 시험 순서가 갈라지지 않게 */
      .sort(compareByInterviewFlow)
      .map((q, i) => ({ q, no: i + 1 }))
  }, [questions])

  const filtered = useMemo(() => {
    let list = numbered
    if (onlyMust) list = list.filter(({ q }) => q.mustPrepare)
    if (onlyAgain) list = list.filter(({ q }) => q.lastPracticeResult === 'again')
    if (selectedCat === '(미분류)') list = list.filter(({ q }) => !q.category)
    else if (selectedCat)
      list = list.filter(({ q }) => q.category === selectedCat)
    return list
  }, [numbered, selectedCat, onlyMust, onlyAgain])

  const totalCats = catCounts.size

  /**
   * 🔴 **모바일은 「목록 ↔ 집중」 두 화면으로 나눈다** (2026-08-09 CEO).
   *
   * 390px 에서 카드를 세로로 쌓으면 문항 하나가 화면을 넘긴다. 그래서 평소엔
   * **한 줄 요약**으로 20문항을 한 화면에 담고, 준비할 문항을 누르면 그것만 전체 화면으로 연다.
   * 넓은 화면은 원래대로 카드 목록이다 — 폭이 있어서 나눌 이유가 없다.
   *
   * 꼬리질문은 **순서에 넣지 않고 그 문항 아래에 그대로 둔다** (기본 접힘).
   * 순서에 넣으면 재귀 구조를 평탄한 배열로 바꿔야 하는데, 그러면 "이 꼬리가 누구의 꼬리인지"
   * 를 라벨로만 설명하게 된다. 아래 두는 편이 관계가 눈에 보인다.
   */
  const narrow = useMediaQuery('(max-width: 639px)')
  const [focusIdx, setFocusIdx] = useState<number | null>(null)

  // 필터를 바꾸면 인덱스가 다른 문항을 가리킨다 — 목록으로 되돌린다
  const [seenLen, setSeenLen] = useState(filtered.length)
  if (seenLen !== filtered.length) {
    setSeenLen(filtered.length)
    setFocusIdx(null)
  }

  const focused = focusIdx !== null ? filtered[focusIdx] : undefined

  /**
   * 🔴 **문항을 넘기면 맨 위로 올린다** (2026-08-09). 「다음 질문」 버튼은 카드 **하단**에 있어
   * 누르는 순간 스크롤이 페이지 아래쪽이다. 카드가 remount 돼도 스크롤은 그대로라
   * **다음 질문의 첫 줄이 아니라 중간부터** 보인다 — 꼬리질문이 있으면 확실히 어긋난다.
   * 20문항을 넘기는 동안 매번 겪는 자리라 자동으로 맞춘다.
   */
  useEffect(() => {
    if (focusIdx === null) return
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [focusIdx])

  /**
   * 방금 들어간 질문에 두르는 강조.
   *
   * 🔴 **별도 state 로 복제하지 않는다.** `pendingAdded` 가 살아 있는 동안이 곧 강조
   * 구간이고, 2.5초 뒤 부모가 비우면 저절로 걷힌다. 복제하면 effect 안에서 setState 를
   * 하게 되고(cascading render), 무엇보다 **두 값이 어긋날 자리**가 생긴다.
   * 목록에 나타나기 전에도 세팅돼 있지만 그때는 그릴 요소 자체가 없다.
   */
  const highlighted = useMemo(
    () => new Set(pendingAdded?.ids ?? []),
    [pendingAdded],
  )
  /** 같은 추가를 두 번 알리지 않는다 — `numbered` 가 바뀔 때마다 아래 effect 가 다시 돈다 */
  const announcedRef = useRef<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    },
    [],
  )
  /**
   * 🔴 **추가 직후 "어디로 갔는지" 를 말해 준다** (2026-08-11).
   *
   * 목록이 면접 진행 순서라 새 질문은 맨 끝이 아니라 카테고리의 자리로 들어간다.
   * 단건은 **번호만 알려주고 스크롤하지 않는다** — 연달아 적는 흐름이라 화면이 움직이면
   * 입력칸을 뺏긴다. 붙여넣기는 폼이 닫히고 흐름이 끝나므로 그때만 데려간다.
   *
   * 번호는 `numbered` 에 실제로 나타난 뒤에야 확정된다 — 서버 응답 시점엔 아직 refetch
   * 전이라 못 찾는다. 못 찾으면 그냥 두고 **다음 렌더에 다시 본다.**
   */
  useEffect(() => {
    if (!pendingAdded) return
    const [firstId] = pendingAdded.ids
    if (announcedRef.current === firstId) return
    const hit = numbered.find(({ q }) => q.id === firstId)
    if (!hit) return
    announcedRef.current = firstId

    if (pendingAdded.multi) {
      // 🔴 JS 스크롤은 index.css 의 reduced-motion 미디어가 못 줄인다 — 여기서 직접 존중
      const reduceMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      document
        .querySelector(`[data-question-id="${firstId}"]`)
        ?.scrollIntoView?.({
          block: 'center',
          behavior: reduceMotion ? 'auto' : 'smooth',
        })
      toast.show(
        `질문 ${pendingAdded.ids.length}개를 추가했어요 (면접 흐름 순서로 배치돼요)`,
      )
    } else {
      toast.show(`「${clipQuestion(hit.q.questionText)}」 ${hit.no}번으로 들어갔어요`)
    }

    /*
      deps 가 바뀔 때 정리하지 않는다 — `numbered` 는 자동저장·refetch 로 자주 바뀌는데,
      cleanup 으로 타이머를 끊으면 위 `announcedRef` 가드에 걸려 다시 걸지 못하고
      강조가 영원히 남는다. 언마운트 정리는 위 effect 가 맡는다.
    */
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(
      () => onAddedShown?.(),
      ADDED_HIGHLIGHT_MS,
    )
  }, [pendingAdded, numbered, onAddedShown])

  if (narrow && focused) {
    const answered = filtered.filter(({ q }) => (q.myMemo ?? '').trim()).length
    return (
      <div className="space-y-3">
        {/* 상단 — 어디쯤인지와 나갈 문 */}
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setFocusIdx(null)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] -ml-1 inline-flex items-center gap-1 pl-1 pr-3 text-xs font-medium text-text-secondary"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              목록
            </button>
            <span className="text-[13px] font-mono font-semibold tabular-nums">
              {focusIdx! + 1}
              <span className="text-text-quaternary"> / {filtered.length}</span>
            </span>
            <span className="text-[11px] text-text-quaternary">· 답변 {answered}개</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${((focusIdx! + 1) / filtered.length) * 100}%` }}
            />
          </div>
        </div>

        {/*
          카드를 그대로 쓴다 — 꼬리질문·AI 답변·자동저장이 전부 이미 여기 있다.
          `key` 를 문항 id 로 두는 이유: 문항을 넘기면 카드가 새로 마운트돼
          **가림 상태가 다시 걸린다.** 그게 연습이다.
        */}
        <InterviewQuestionCard
          key={focused.q.id}
          question={focused.q}
          questionNo={focused.no}
          sessionId={sessionId}
          applicationId={applicationId}
          readOnly={readOnly}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFocusIdx((i) => Math.max(0, (i ?? 0) - 1))}
            disabled={focusIdx === 0}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] flex-1 text-[13px] font-medium text-text-secondary border border-line rounded-lg py-3 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>
          <button
            type="button"
            onClick={() =>
              setFocusIdx((i) => Math.min(filtered.length - 1, (i ?? 0) + 1))
            }
            disabled={focusIdx === filtered.length - 1}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg min-h-[44px] flex-[2] text-[13px] font-semibold rounded-lg py-3 bg-brand text-bg disabled:opacity-35 disabled:cursor-not-allowed"
          >
            다음 질문 →
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="space-y-3">
      {totalCats > 0 && (
        /*
          🔴 **모바일은 가로 스크롤 한 줄** (2026-08-09 CEO).

          실측: 세션에 흔한 칩 12개가 390px 에서 **4줄 · 약 122px** 를 먹었다 — 질문이
          나오기 전에 화면 1/6 이다. PC(1028px)에선 한 줄에 들어가 문제가 안 보였다.
          **같은 요소가 폭에 따라 성격이 달라진 경우**다.

          칩을 없애지 않고 눕힌다 — 모바일에서 카테고리 필터를 쓰는지 **관측한 적이 없어서**
          (실사용자 3명 전원 PC) 기능을 지우는 결정은 근거가 없다. 안 쓰는 게 확인되면
          그때 빼면 된다. `전체`·`우선` 은 맨 앞이라 스크롤 없이 잡힌다.
        */
        <div className="relative">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-x-visible sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCat(null)}
            className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-full border transition-colors ${
              selectedCat === null
                ? 'bg-brand text-bg border-brand'
                : 'bg-card hover:bg-card-strong border-line text-text-secondary hover:text-text-primary'
            }`}
          >
            전체 ({questions.length})
          </button>
          {/*
            우선 필터 — 다른 칩(카테고리)과 축이 달라서 색을 accent 로 구분한다.
            옛 세션은 mustPrepare 가 전부 false 라 0개면 아예 안 띄운다.
          */}
          {mustCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyMust((v) => !v)}
              aria-pressed={onlyMust}
              title="이 면접에서 나올 확률이 높은 질문만 봅니다"
              className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${
                onlyMust
                  ? 'bg-accent text-white border-accent'
                  : 'bg-accent/10 text-accent border-accent/25 hover:bg-accent/15'
              }`}
            >
              <Star size={10} strokeWidth={2.5} aria-hidden="true" />
              우선 ({mustCount})
            </button>
          )}
          {/*
            🔁 다시 볼 것 — ⭐ 와 **같은 토글 문법**이되 색은 danger 다 (축이 다르다).
            연습 전 세션은 0개라 아예 안 띄운다: 쓸 수 없는 칩이 필터 줄 맨 앞을 차지하면
            정작 쓰는 카테고리 칩이 스크롤 밖으로 밀린다.
          */}
          {againCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyAgain((v) => !v)}
              aria-pressed={onlyAgain}
              title="지난 「면접 보기」에서 「다시」로 표시한 질문만 봅니다"
              className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${
                onlyAgain
                  ? 'bg-danger text-white border-danger'
                  : 'bg-danger/10 text-danger border-danger/25 hover:bg-danger/15'
              }`}
            >
              🔁 다시 볼 것 ({againCount})
            </button>
          )}
          {/*
            🔴 **전체 접기·펼치기는 여기 없다** (2026-08-07). `ml-auto` 로 우측에 밀었는데
            **뒤에 카테고리 칩이 더 붙어서**, 줄바꿈되면 목록 한가운데 놓였다.
            필터 바는 필터만 두고, 목록 전체를 다루는 동작은 `✨ AI 질문 생성` 옆으로 올렸다.
          */}
          {Array.from(catCounts.entries()).map(([cat, count]) => {
            const isActive = selectedCat === cat
            const label = CATEGORY_LABEL[cat] ?? cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(isActive ? null : cat)}
                /*
                  비활성 칩도 **카드의 태그와 같은 색**을 쓴다. 여기만 회색이면
                  "필터의 파랑" 과 "카드의 파랑" 이 따로 놀아 색이 묶음 역할을 못 한다.
                  활성은 대비를 위해 채도를 올린다.
                */
                className={`shrink-0 whitespace-nowrap text-[11px] px-2 py-1 rounded-full border transition-colors ${
                  isActive
                    ? 'bg-brand text-bg border-brand font-medium'
                    : `${CATEGORY_STYLE[cat] ?? CATEGORY_STYLE_FALLBACK} hover:brightness-110`
                }`}
              >
                {label} ({count})
              </button>
            )
          })}
          </div>
          {/*
            우측 페이드 — **더 있다는 신호.** 없으면 스크롤 되는 줄 모르고, 오른쪽 칩은
            존재 자체가 안 알려진다. 넓은 화면은 줄바꿈이라 필요 없다.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent sm:hidden"
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="text-text-quaternary text-xs text-center py-4">
          이 카테고리에 질문이 없어요.
        </p>
      ) : narrow ? (
        /*
          🔴 **모바일 목록은 한 줄이다.** 카드를 그대로 쌓으면 문항 하나가 화면을 넘겨서
          "어디까지 했나" 를 보려면 한참 스크롤해야 했다. 여기서 필요한 정보는 세 개뿐이다 —
          **몇 번인지 · 답을 썼는지 · 꼬리가 몇 개인지.** 나머지는 눌러서 본다.
        */
        <ul className="space-y-1.5">
          {filtered.map(({ q, no }, i) => {
            const done = (q.myMemo ?? '').trim().length > 0
            const kids =
              q.children.length +
              q.children.reduce((m, c) => m + c.children.length, 0)
            /* 🔴 분모가 손자(재꼬리)까지 세므로 분자도 같은 범위로 — 안 맞추면 재꼬리에 답해도 안 오른다 */
            const kidsDone =
              q.children.filter((c) => (c.myMemo ?? '').trim()).length +
              q.children.reduce(
                (m, c) =>
                  m + c.children.filter((g) => (g.myMemo ?? '').trim()).length,
                0,
              )
            return (
              <li
                key={q.id}
                data-question-id={q.id}
                className={`rounded-lg transition-shadow ${
                  highlighted.has(q.id) ? ADDED_HIGHLIGHT : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setFocusIdx(i)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg w-full min-h-[52px] text-left border border-line-strong bg-card-solid shadow-sm rounded-lg px-3 py-3 flex items-start gap-2.5 active:bg-card-hover transition-colors"
                >
                  <span className="shrink-0 w-5 mt-0.5 text-text-tertiary text-[11px] font-mono font-semibold tabular-nums">
                    {no}.
                  </span>
                  {/* 작성 여부를 색 점 하나로 — 목록을 훑는 눈이 제일 먼저 잡는 신호다 */}
                  <span
                    aria-hidden="true"
                    className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${done ? 'bg-brand' : 'bg-surface-3'}`}
                  />
                  <span
                    /*
                      🔴 **2줄까지 보여준다** (2026-08-09). 1줄(약 13자)로는 질문이 구분되지
                      않았다 — 실측상 질문 56개의 **최소 길이가 44자**이고 「커넥션 풀을…」
                      「커넥션 획득…」처럼 앞머리가 겹치는 게 흔하다. 목록의 일은
                      **어느 질문인지 알아보는 것**인데 그게 안 되면 결국 하나씩 열어보게 된다.
                      모든 질문이 26자를 넘으므로 행 높이는 **전부 2줄로 균일**하다.
                    */
                    className={`flex-1 min-w-0 line-clamp-2 text-[14px] font-medium leading-snug ${
                      done ? 'text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {q.questionText}
                  </span>
                  {q.mustPrepare && (
                    <Star
                      size={12}
                      strokeWidth={2.5}
                      aria-label="우선 준비"
                      className="shrink-0 mt-0.5 text-accent fill-accent"
                    />
                  )}
                  {/*
                    🔴 **320px 에선 「꼬리」 두 글자를 뗀다.** 이 표시가 58px 를 먹는데,
                    320px 행에서 질문에 남는 폭이 178 → 120px 로 줄어 2줄 합쳐 16자밖에 안 된다.
                    목록의 일은 **어느 질문인지 아는 것**이라 그쪽이 우선이다 —
                    분자/분모 숫자만 남겨도 무엇을 세는지는 위치와 아이콘으로 읽힌다.
                  */}
                  {kids > 0 && (
                    <span
                      className="shrink-0 mt-0.5 text-[11px] text-text-quaternary tabular-nums"
                      title={`꼬리질문 ${kids}개 중 ${kidsDone}개 작성`}
                    >
                      <span className="max-[359px]:hidden">꼬리 </span>
                      {kidsDone}/{kids}
                    </span>
                  )}
                  <span className="sr-only">{done ? '답변 작성함' : '미작성'}</span>
                  <CollapsibleChevron open={false} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="space-y-3">
          {/*
            래퍼 div 는 **하이라이트와 스크롤 표적** 전용이다 — 카드 컴포넌트는 그대로 둔다.
            radius 는 카드(`rounded-xl`)와 맞춘다. 안 맞추면 모서리에서 링이 튄다.
          */}
          {filtered.map(({ q, no }) => (
            <div
              key={q.id}
              data-question-id={q.id}
              className={`rounded-xl transition-shadow ${
                highlighted.has(q.id) ? ADDED_HIGHLIGHT : ''
              }`}
            >
              <InterviewQuestionCard
                question={q}
                questionNo={no}
                sessionId={sessionId}
                applicationId={applicationId}
                collapseSignal={collapseSignal}
                collapseAll={allCollapsed}
                readOnly={readOnly}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
