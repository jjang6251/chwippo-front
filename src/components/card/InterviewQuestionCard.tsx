import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, CornerDownRight, Info, Sparkles, Star } from 'lucide-react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { useAutoResize } from '@/hooks/useAutoResize'
import {
  ANSWER_LONG_SECONDS,
  estimateSpeakingSeconds,
  formatSpeakingTime,
} from '@/utils/speakingTime'
import {
  useCreateInterviewFollowup,
  useGenerateInterviewAnswer,
  useUpdateInterviewQuestion,
} from '@/hooks/useInterviewPrep'
import { useAiQuotaBlocked } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { useRequireJobTitle } from '@/hooks/useRequireJobTitle'
import { useUnloadGuard } from '@/hooks/useUnloadGuard'
import { toast } from '@/stores/toastStore'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  CATEGORY_STYLE_FALLBACK,
  FOLLOWUP_BASIS_LABEL,
  MIN_PROBEABLE_ANSWER_CHARS,
} from '@/types/interviewPrep'

interface Props {
  question: InterviewPrepQuestion
  sessionId: string
  /** 직무 사전 게이트용 — 답변 생성도 직무 기준으로 쓴다 */
  applicationId: string
  /**
   * 면접 진행 순서 기준 문항 번호 (1부터). 부모가 **필터 전에** 확정해 넘긴다 —
   * 필터마다 다시 매기면 "3번 질문" 이 화면마다 달라진다. 꼬리질문은 없다.
   */
  questionNo?: number
  /** 부모의 "전체 접기·펼치기" 신호. 값이 바뀐 렌더에서만 펼침 상태를 재설정한다 */
  collapseSignal?: number
  /** 그 신호가 접기인지 펼치기인지 */
  collapseAll?: boolean
  /**
   * 읽기 모드 — **면접 직전에 꺼내 보는 화면**.
   *
   * 준비하는 화면과 성격이 다르다. 대기실에서 스크롤하다 `AI 도움`·`꼬리질문 추가` 를
   * 잘못 누르면 **코인이 나간다.** 그래서 코인 쓰는 버튼을 전부 감추고, 외워야 할
   * **내 답변**을 앞세운다.
   */
  readOnly?: boolean
  /**
   * 🔴 **AI 답변을 펼친 채로 시작한다** (2026-08-09). 랜딩이 이 카드를 실물로 렌더하는데,
   * 읽기 모드는 **내 답변이 있으면 AI 답변을 접는다**(면접 직전엔 내가 쓴 답이 우선).
   * 그 판단은 제품에선 맞지만, **랜딩 방문자는 AI 가 무엇을 써주는지 봐야 한다.**
   *
   * 제품 규칙을 바꾸지 않고 예외를 명시적으로 연다. 기본 `false` — 기존 동작 무변경.
   * 자식(꼬리질문)에게도 그대로 내려간다.
   */
  forceAnswerOpen?: boolean
}

/**
 * F6 PR 2 Phase 4 — 재귀 질문 카드 (depth 0/1/2).
 *
 * **디자인 패턴** (실서비스 reference):
 * - **자식이 부모 카드 안** (GitHub PR review / Slack thread) — 시각적 소속 명확
 * - **좌측 connector line** (Linear / Twitter / Slack) — depth 시각 트래킹
 * - **chevron 좌측** (Notion / Finder) — 자연스러운 토글 시작점
 * - "꼬리질문 추가" 는 **항상 노출** — hover 로 숨기면 기능이 있는 줄도 모른다 (2026-08-07)
 * - **depth 1·2 default 접힘** (YouTube / Twitter) — 메인 우선 보게 유도
 *
 * **표시**:
 * - 질문 텍스트 + AI suggested_answer (펼침 시)
 * - 내 답변 my_memo + 1.5s debounce autosave
 * - 자식 질문 inline 재귀 (부모 카드 내부 + 좌측 line 연결)
 * - depth < 2 면 "꼬리질문 추가" 노출 (parent.depth=2 는 자식 depth=3 차단)
 */
export function InterviewQuestionCard({
  question,
  sessionId,
  applicationId,
  questionNo,
  collapseSignal = 0,
  collapseAll = false,
  readOnly = false,
  forceAnswerOpen = false,
}: Props) {
  const ensureJobTitle = useRequireJobTitle(applicationId)
  const [memo, setMemo] = useState(question.myMemo ?? '')
  /**
   * depth 0 default 펼침, depth 1·2 default 접힘 (메인부터 보게 유도).
   *
   * 🔴 **읽기 모드는 depth 무관 전부 펼침** — 꼬리질문이 접혀 있으면 면접 직전에
   * 하나씩 눌러 열어야 한다. 꺼내 보는 화면에서 그건 마찰이다.
   */
  const [expanded, setExpanded] = useState(readOnly || question.depth === 0)
  /**
   * 부모의 전체 접기·펼치기 반영 — **렌더 중 상태 조정**(React 공식 패턴)이다.
   * effect 로 하면 렌더가 한 번 더 돌고 lint(cascading renders)에도 걸린다.
   * 펼침을 부모가 통째로 소유하지 않는 이유는, 카드가 메모 입력 중 상태를 들고 있어서다.
   */
  /**
   * AI 답변 펼침 — **기본 펼침**이다. 답변이 있다는 건 사용자가 직접 만든 것이라
   * 감추고 시작할 이유가 없다. 길어서 거슬릴 때 접는 용도다 (`전체 닫기` 도 같이 접는다).
   */
  const [answerOpen, setAnswerOpen] = useState(
    // 읽기 모드에서 외워야 할 건 **내가 쓴 답**이다. 메모가 있으면 AI 답변은 접고 시작한다
    // (참고 자료라 필요하면 펼친다). 메모가 없으면 볼 게 그것뿐이라 펼친다.
    forceAnswerOpen || (readOnly ? !(question.myMemo ?? '').trim() : true),
  )
  const speakSec = useMemo(() => estimateSpeakingSeconds(memo), [memo])
  /**
   * 파고들 답변이 있는가 — 백엔드 `resolveFollowupBasis` 와 **같은 판정**이다.
   *
   * 🔴 `trim()` 만 보면 `ㅏ` 한 글자에도 안내가 사라져 "이제 됐구나" 로 읽힌다.
   * 실제로는 서버가 그 한 글자를 답변으로 알고 추궁해 말이 안 되는 질문이 나오고
   * 코인까지 나간다. 공백 제외 실질 길이로 본다.
   *
   * 저장 전 입력 중인 값(`memo`)을 쓰는 이유 — 방금 적었는데 안내가 남아 있으면 어색하다.
   */
  const probeableLen = (text: string) => text.replace(/\s/g, '').length
  const hasAnswerToProbe =
    probeableLen(memo) >= MIN_PROBEABLE_ANSWER_CHARS ||
    probeableLen(question.suggestedAnswer ?? '') >= MIN_PROBEABLE_ANSWER_CHARS
  const { ref: memoRef, autoResize: autoResizeMemo } = useAutoResize(memo, {
    min: 76,
    max: 420,
  })

  const [seenSignal, setSeenSignal] = useState(collapseSignal)
  if (collapseSignal !== seenSignal) {
    setSeenSignal(collapseSignal)
    setExpanded(collapseAll ? false : question.depth === 0)
    if (collapseAll) setAnswerOpen(false)
  }
  const { mutate: updateMemo } = useUpdateInterviewQuestion()
  const { mutate: createFollowup, isPending: creatingFollowup } =
    useCreateInterviewFollowup(sessionId)
  const { blocked: followupBlocked, reason: followupReason } =
    useAiQuotaBlocked('interview_prep_followup', { enabled: !readOnly })

  /**
   * v2 — 답변 on-demand 생성.
   *
   * 🔴 실패 사유를 로컬 상태로 들고 있는 이유 — 토스트로만 띄우면 사라진 뒤 사용자가
   * "왜 안 됐는지" 를 다시 볼 방법이 없다. 카드 안에 남겨 재시도까지 이어지게 한다.
   * 문구는 **서버 `reason` 우선** (동의 필요·코인 부족·장애를 서버가 구분해 준다).
   */
  const [answerError, setAnswerError] = useState<string | null>(null)
  const { mutate: generateAnswer, isPending: generatingAnswer } =
    useGenerateInterviewAnswer(sessionId)
  const { blocked: answerBlocked, reason: answerReason } =
    useAiQuotaBlocked('interview_prep_answer', { enabled: !readOnly })
  const ensureAiConsent = useRequireAiConsent()
  // 생성 중 새로고침 = 코인만 차감되고 결과 유실
  // 생성 중 새로고침 = 코인만 차감되고 결과 유실. 꼬리질문도 같은 AI 호출이다
  useUnloadGuard(generatingAnswer || creatingFollowup)

  const runGenerateAnswer = async () => {
    // 사전 게이트 — 동의 없으면 호출 자체를 안 한다 (코인·쿼터 소모 방지)
    if (!(await ensureAiConsent())) return
    // 직무도 마찬가지 — 없으면 모달로 받고, 취소하면 호출하지 않는다
    if (!(await ensureJobTitle())) return
    setAnswerError(null)
    generateAnswer(question.id, {
      onSuccess: (result) => {
        if (result.status !== 'ok') {
          setAnswerError(result.reason ?? '답변 생성에 실패했어요.')
          return
        }
        // 접어둔 상태에서 다시 생성했으면 펼쳐 보여준다 (결과가 안 보이면 실패로 읽힌다)
        setAnswerOpen(true)
      },
      /**
       * 🔴 **서버 메시지 우선.** 고정 문구로 덮으면 진짜 이유(직무 미입력·코인 부족 등)가
       * 사라져 사용자가 뭘 해야 할지 모른다. 직무 미입력은 인터셉터가 모달을 띄우므로
       * 인라인 에러는 남기지 않는다.
       */
      onError: (err) => {
        const cfg = (err as { config?: { _toastShown?: boolean } })?.config
        if (cfg?._toastShown) return
        const serverMsg = (
          err as { response?: { data?: { message?: string } } }
        )?.response?.data?.message
        setAnswerError(serverMsg ?? '답변 생성에 실패했어요. 다시 시도해 주세요.')
      },
    })
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemo(question.myMemo ?? '')
  }, [question.id, question.myMemo])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMemoChange = (val: string) => {
    setMemo(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateMemo({ questionId: question.id, dto: { myMemo: val } })
    }, 1500)
  }

  const handleAddFollowup = () => {
    createFollowup(
      { parentQuestionId: question.id },
      {
        onSuccess: (result) => {
          if (result.status === 'ok') {
            toast.show('꼬리질문을 추가했어요.')
          } else {
            toast.error(result.reason ?? '생성에 실패했어요.')
          }
        },
        onError: (err) => {
          const serverMsg = (
            err as { response?: { data?: { message?: string } } }
          )?.response?.data?.message
          toast.error(serverMsg ?? 'AI 호출 중 오류가 발생했어요.')
        },
      },
    )
  }

  // depth 별 컨테이너 스타일
  // - depth 0: 강한 박스 (border + bg-surface-2) — 메인 질문은 카드처럼 도드라지게
  // - depth 1·2: 좌측 connector line 만 (Linear/Twitter 패턴) — 부모 카드 안에 가볍게
  const isRoot = question.depth === 0
  const containerClass = isRoot
    ? 'border border-line bg-surface-2 rounded-xl p-4'
    : `border-l-2 ${
        question.depth === 1 ? 'border-info/40' : 'border-warning/40'
      } pl-4 py-2 ml-2`

  const depthLabel: Record<number, string> = {
    0: '메인',
    1: '꼬리',
    2: '재꼬리',
  }
  const depthBadgeStyle: Record<number, string> = {
    0: 'bg-brand/10 text-brand border border-brand/20',
    1: 'bg-info/10 text-info border border-info/20',
    2: 'bg-warning/10 text-warning border border-warning/20',
  }

  return (
    <div className={containerClass}>
      {/* 헤더 — chevron 좌측 (Notion 패턴) */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={
          expanded ? '질문·답변 접기' : '질문·답변 펼치기'
        }
        className="w-full text-left flex items-start gap-2"
      >
        <span className="shrink-0 mt-1">
          <CollapsibleChevron open={expanded} />
        </span>
        {/*
          🔴 태그를 질문 **왼쪽 위**로 올린다 (2026-08-07).

          한 줄에 배지 3개(깊이·우선·유형)와 질문을 나란히 두면, 질문이 배지에 밀려
          오른쪽에서 시작하고 줄바꿈될 때마다 시작점이 들쭉날쭉해진다. 문항이 20개
          쌓이면 읽기 리듬이 깨진다. 배지는 위 줄, 질문은 아래 줄이 자연스럽다.
        */}
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-1 mb-1.5">
            {questionNo !== undefined && (
              <span className="text-text-tertiary text-[11px] font-mono font-semibold tabular-nums">
                {questionNo}.
              </span>
            )}
            {/*
              🔴 `메인` 배지를 뺐다 (2026-08-07). 두 가지 이유다:
              ① brand(sage)는 **CTA·active 전용**인데 이 배지가 쓰고 있었다 —
                 같은 카드의 `✨ AI 도움`·`↻ 다시 생성` 과 색이 같아 무엇이 누르는 건지 흐려진다.
              ② 모든 메인 문항에 `메인` 이 붙는 건 정보가 0이다. 번호(1. 2. 3.)가
                 이미 메인임을 뜻하고, 꼬리질문은 들여쓰기로 이미 구분된다.
              꼬리·재꼬리는 계속 표시한다 — 그건 실제로 구분이 필요하다.
            */}
            {question.depth > 0 && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${depthBadgeStyle[question.depth]}`}
              >
                {depthLabel[question.depth]}
              </span>
            )}
            {/*
              무엇을 파고든 꼬리인지 — `질문 심화` 는 답변이 없어 질문만 보고 만든 것이라
              성격이 다르다. 색은 안 쓴다 (색은 질문 유형 한 축만 뜻한다).
            */}
            {question.followupBasis && (
              <span
                className="text-text-quaternary text-[10px] font-medium"
                title={
                  question.followupBasis === 'question'
                    ? '답변이 없어서 질문 자체를 더 깊이 파고든 질문이에요'
                    : '이 질문에 적힌 답변을 파고든 질문이에요'
                }
              >
                {FOLLOWUP_BASIS_LABEL[question.followupBasis] ??
                  question.followupBasis}
              </span>
            )}
            {/*
              우선 준비 표시 — 실제 신입 면접은 20~30분이라 **받는 질문이 5개 안팎**이다.
              20문항을 다 준비하라는 건 현실과 맞지 않아, 먼저 할 5~7개를 눈에 띄게 둔다.
              accent(coral)는 "진짜 특별한 것" 에만 쓰는 색이라 이 자리에 맞다.
            */}
            {question.mustPrepare && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/25 inline-flex items-center gap-0.5"
                title="이 면접에서 나올 확률이 높아요 — 먼저 준비하세요"
              >
                <Star size={9} strokeWidth={2.5} aria-hidden="true" />
                우선
              </span>
            )}
            {question.category && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  CATEGORY_STYLE[question.category] ?? CATEGORY_STYLE_FALLBACK
                }`}
                title={`질문 유형: ${question.category}`}
              >
                {CATEGORY_LABEL[question.category] ?? question.category}
              </span>
            )}
          </span>
          {/*
            🔴 **읽기 모드에선 질문이 소제목이다.** 편집 모드의 15px/medium 은 목록을
            훑기엔 맞지만, 문서로 읽을 땐 본문(13px)과 2px 차이라 **위계가 안 보인다** —
            라벨을 안 읽으면 질문인지 답인지 구분이 안 됐다. 크기와 굵기를 함께 올린다
            (둘 중 하나만 올리면 여전히 애매하다).
          */}
          <span
            className={`block text-text-primary ${
              readOnly
                ? // 16 × 1.25 — 레벨 간 1.2배 미만은 사용자가 구분하지 못한다 (모듈러 스케일).
                  // leading 은 한글 최소 150% (국문은 글자 폭이 균일해 충분한 행간이 필요하다).
                  'text-[20px] font-semibold leading-[1.5]'
                : // 편집 모드는 20문항을 훑는 **목록**이라 읽기 모드(20px)만큼 키우면
                  // 한 화면에 들어오는 문항이 준다. 대신 본문(13px) 대비 **1.23배**로
                  // 임계(1.2)는 넘긴다. `text-base` 는 하우스 스케일 —
                  // 기존 `text-[15px]` 은 프로젝트 통틀어 이 카드에만 있던 예외값이었다.
                  'text-base font-semibold leading-normal'
            }`}
          >
            {question.questionText}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 pl-6">
          {/*
            v2 — 답변은 세션 생성 시 만들어지지 않는다. 4상태:
            ① 생성 중  ② 답변 있음(+다시 생성)  ③ 실패(+다시 시도)  ④ 없음(AI 도움 버튼)
            주인공은 아래 "내 답변" 다 — 여기는 막혔을 때 꺼내 쓰는 보조 도구라
            brand 색을 쓰되 크기·비중을 낮춘다.
          */}
          {/*
            🔴 **완료가 안 읽히던 자리.** aria-live 가 아래 "생성 중" 블록에만 있어서,
            생성이 끝나면 그 블록이 통째로 사라지고 답변은 **형제 요소**에 나타났다 —
            화면을 못 보는 사용자는 시작만 듣고 끝을 못 들었다.

            답변 본문(350~400자)을 live 영역에 넣으면 전부 낭독돼 더 나쁘다.
            그래서 **상태 한 줄만** 알린다. 자료 부족 배지도 여기서 함께 알린다 —
            그건 "답변이 뼈대뿐" 이라는 신호라 못 보고 넘어가면 안 된다.
          */}
          <p className="sr-only" aria-live="polite">
            {generatingAnswer
              ? 'AI 답변을 만드는 중이에요.'
              : question.suggestedAnswer
                ? question.materialGap
                  ? 'AI 답변이 만들어졌어요. 자료가 부족해 뼈대만 작성됐다는 안내가 함께 있어요.'
                  : 'AI 답변이 만들어졌어요.'
                : ''}
          </p>
          {generatingAnswer ? (
            <div className="bg-surface border border-line rounded-lg p-3 space-y-1.5">
              <p className="text-text-secondary text-xs font-medium animate-pulse">
                ✨ AI 가 답변을 쓰는 중이에요…
              </p>
              <div className="h-3 w-2/3 bg-surface-3 rounded animate-pulse" />
              <div className="h-3 w-full bg-surface-3 rounded animate-pulse" />
              <div className="h-3 w-4/5 bg-surface-3 rounded animate-pulse" />
            </div>
          ) : question.suggestedAnswer ? (
            <div className="bg-surface border border-line rounded-lg p-3">
              {/*
                🔴 AI 답변은 길다 (보통 5~10줄). 20문항이 다 펼쳐져 있으면 화면이
                끝없이 늘어나 정작 **주인공인 "내 답변"** 가 스크롤 밖으로 밀린다.
                답변은 한 번 읽고 참고하는 자료라 접어두는 게 기본 흐름에 맞다.
                단 **처음 만든 직후엔 펼쳐** 둔다 — 눌렀는데 아무것도 안 보이면 실패로 읽힌다.
              */}
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAnswerOpen((v) => !v)}
                  aria-expanded={answerOpen}
                  className="min-w-0 text-left inline-flex items-center gap-1.5 text-text-tertiary text-xs font-semibold hover:text-text-secondary transition-colors"
                >
                  <CollapsibleChevron open={answerOpen} />
                  <Sparkles
                    size={readOnly ? 12 : 14}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  AI 예상 답변
                  {!answerOpen && (
                    <span className="text-text-faint font-normal truncate">
                      — {question.suggestedAnswer.slice(0, 24)}…
                    </span>
                  )}
                </button>
                {/* 읽기 모드에선 코인 쓰는 버튼을 감춘다 — 대기실 오탭 방지 */}
                {!readOnly && (
                  <button
                    onClick={() => void runGenerateAnswer()}
                    disabled={answerBlocked}
                    // 재생성이 공짜로 보이지 않게 — 코인이 다시 든다는 걸 title 로 명시
                    title={
                      answerReason ?? '답변을 새로 만들어요 (코인이 다시 차감됩니다)'
                    }
                    className="shrink-0 min-h-8 text-[11px] font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ↻ 다시 생성
                  </button>
                )}
              </div>
              {answerOpen && (
                <>
                  {/* 읽기 모드에선 참고 자료로 한 단계 물러난다 — 외울 건 내 메모다 */}
                  <p
                    className={`leading-relaxed whitespace-pre-wrap mt-1.5 text-[13px] ${
                      readOnly ? 'text-text-tertiary' : 'text-text-secondary'
                    }`}
                  >
                    {question.suggestedAnswer}
                  </p>
                  {/*
                    🔴 자료 부족은 **답변 본문 밖**에서 알린다.
                    예전엔 모델이 "자료상 ~한 사례가 있었던 것은 아니지만" 처럼 본문 안에서
                    말했고, 사용자가 그걸 그대로 외우면 면접장에서 통하지 않는다.
                    warning 색 — 답변이 틀린 게 아니라 **재료가 모자란다**는 신호다.
                  */}
                  {question.materialGap && (
                    <div className="mt-2 flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-warning/8 border border-warning/25">
                      <Info
                        size={12}
                        strokeWidth={2.25}
                        aria-hidden="true"
                        className="text-warning shrink-0 mt-0.5"
                      />
                      <p className="min-w-0 text-warning text-[11px] leading-relaxed">
                        {question.materialGap}
                      </p>
                    </div>
                  )}
                  {/* AI 답변에도 같은 기준을 붙여 "내 답변이 긴가" 를 비교할 수 있게 한다 */}
                  {/* 내 메모 칩과 같은 형태 — 나란히 두고 길이를 비교하는 게 목적이다 */}
                  <p className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-info/8 border-info/20">
                    <Clock
                      size={12}
                      strokeWidth={2.25}
                      aria-hidden="true"
                      className="text-info"
                    />
                    <span className="text-text-tertiary text-[10px]">
                      말하면 약
                    </span>
                    <span className="font-mono tabular-nums font-bold text-[12px] leading-none text-info">
                      {formatSpeakingTime(
                        estimateSpeakingSeconds(question.suggestedAnswer),
                      )}
                    </span>
                    {question.sourceLogIds.length > 0 && (
                      <span className="text-text-quaternary text-[10px]">
                        · 참조 로그 {question.sourceLogIds.length}개
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
          ) : readOnly ? null : answerError ? (
            <div className="flex items-center justify-between gap-3 bg-surface border border-line rounded-lg p-3">
              {/* 서버가 준 사유를 그대로 — 고정 문구로 덮으면 진짜 이유가 사라진다 */}
              <p className="text-danger text-xs min-w-0">{answerError}</p>
              <button
                onClick={() => void runGenerateAnswer()}
                disabled={answerBlocked}
                title={answerReason ?? undefined}
                className="shrink-0 min-h-8 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-text-quaternary text-[11px] min-w-0">
                직접 써보고 막히면 AI 가 예시를 만들어드려요
              </p>
              <button
                onClick={() => void runGenerateAnswer()}
                disabled={answerBlocked}
                title={answerReason ?? undefined}
                className="shrink-0 min-h-8 inline-flex items-center gap-1 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
                AI 도움
              </button>
            </div>
          )}

          <div>
            <label
              htmlFor={`memo-${question.id}`}
              className={`block mb-1.5 ${
                readOnly
                  ? 'text-text-quaternary text-[11px] font-medium'
                  : 'text-text-tertiary text-xs font-semibold'
              }`}
            >
              {/*
                🔴 **"메모" 가 아니라 "답변" 이다** (2026-08-09 CEO). 여기서 사용자가 하는 일은
                면접에서 말할 답을 **직접 써 보는 것**이다 — 플레이스홀더도 이미
                `"이 질문에 본인이 어떻게 답할지 적어보세요…"` 로 그렇게 안내하고 있었다.
                읽기 모드는 `내 답변`, 편집 모드만 `내 답변 메모` 라 **같은 칸을 두 이름으로**
                부르고 있었다. 필드명 `myMemo` 는 DB·API 계약이라 그대로 둔다.
              */}
              {readOnly ? '내 답변' : '내 답변 (자동 저장)'}
            </label>
            {/*
              길어지면 자동으로 늘어난다 — 면접 답변은 보통 5~10줄이라 3줄 고정이면
              **자기가 쓴 글을 한눈에 못 본다** (베타 피드백으로 나왔던 문제).
              상한 420px 은 카드가 화면을 다 먹지 않게 두는 선이고, 넘으면 스크롤된다.
            */}
            {/*
              🔴 읽기 모드에선 **입력칸이 아니라 글**로 보여준다. 면접 직전에 필요한 건
              고쳐 쓰는 게 아니라 외우는 것이고, textarea 는 탭하면 키보드가 올라와
              화면 절반을 먹는다. 비어 있으면 "안 썼다" 를 조용히 넘기지 않고 말해 준다 —
              그게 지금 준비가 덜 된 지점이다.
            */}
            {readOnly ? (
              memo.trim() ? (
                <p className="text-text-primary text-[16px] leading-[1.75] whitespace-pre-wrap">
                  {memo}
                </p>
              ) : (
                <p className="text-text-quaternary text-[13px] leading-relaxed">
                  아직 안 썼어요. 이 문항은 답을 준비하지 못한 상태예요.
                </p>
              )
            ) : (
              <textarea
                id={`memo-${question.id}`}
                ref={memoRef}
                value={memo}
                onChange={(e) => {
                  handleMemoChange(e.target.value)
                  autoResizeMemo()
                }}
                placeholder="이 질문에 본인이 어떻게 답할지 적어보세요…"
                maxLength={5000}
                style={{ minHeight: 76 }}
                className="w-full bg-input border border-line rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-y leading-relaxed"
              />
            )}
            {/*
              🔴 글자수보다 **말하는 시간**이 실제 제약이다. 면접은 답변 하나에
              1분 남짓밖에 못 쓰는데, 글자수만 보면 "5000자 중 800자" 라 여유로워 보인다.
              800자는 소리 내면 2분이 넘는다.
            */}
            <div className="flex items-center justify-between gap-2 mt-1.5">
              {/*
                글자수보다 이쪽이 중요한 정보라 **칩으로 올린다.** faint 회색 10px 로는
                눈에 안 들어와서 있으나 마나였다. 길어지면 warning 으로 바뀌어
                "줄여야 한다" 가 색만으로 읽힌다.
              */}
              {/*
                카테고리 칩과 **형태로** 구분한다 — 그쪽은 글자만 든 작은 pill(rounded),
                이건 아이콘이 앞장서고 숫자가 주인공인 chip(rounded-lg)이다.
                형태가 다르면 같은 계열 색이어도 "저건 유형, 이건 수치" 로 읽힌다.
                한 번 무채색으로 뺐더니 밋밋했는데, 문제는 색이 아니라
                **색도 같고 형태도 같았던 것**이었다.
              */}
              {speakSec > 0 ? (
                <span
                  title="또박또박 말하는 발표 속도(분당 350자) 기준 추정치예요"
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                    speakSec > ANSWER_LONG_SECONDS
                      ? 'bg-warning/10 border-warning/30'
                      : 'bg-info/8 border-info/20'
                  }`}
                >
                  <Clock
                    size={12}
                    strokeWidth={2.25}
                    aria-hidden="true"
                    className={
                      speakSec > ANSWER_LONG_SECONDS
                        ? 'text-warning'
                        : 'text-info'
                    }
                  />
                  <span className="text-text-tertiary text-[10px]">
                    말하면 약
                  </span>
                  <span
                    className={`font-mono tabular-nums font-bold text-[12px] leading-none ${
                      speakSec > ANSWER_LONG_SECONDS
                        ? 'text-warning'
                        : 'text-info'
                    }`}
                  >
                    {formatSpeakingTime(speakSec)}
                  </span>
                  {speakSec > ANSWER_LONG_SECONDS && (
                    <span className="text-warning text-[10px] font-medium">
                      · 조금 길어요
                    </span>
                  )}
                </span>
              ) : (
                <span />
              )}
              <p
                className={`text-[10px] ${memo.length >= 5000 ? 'text-danger' : memo.length >= 4500 ? 'text-warning' : 'text-text-quaternary'}`}
              >
                {memo.length} / 5000
              </p>
            </div>
          </div>

          {/* 자식 질문 — 부모 카드 안 nested (GitHub PR review 패턴) */}
          {question.children.length > 0 && (
            <div className="space-y-2 mt-3">
              {question.children.map((child) => (
                <InterviewQuestionCard
                  key={child.id}
                  question={child}
                  sessionId={sessionId}
                  applicationId={applicationId}
                  readOnly={readOnly}
                  forceAnswerOpen={forceAnswerOpen}
                />
              ))}
            </div>
          )}

          {/*
            🔴 **항상 보인다** (2026-08-07). 예전엔 데스크탑에서 hover 전까지 숨겼는데
            (`lg:opacity-0 lg:group-hover:opacity-100`), 그러면 **기능이 있는 줄도 모른다.**
            Notion 의 hover 액션 패턴은 "이미 아는 기능을 정리해 두는" 자리에 맞는 것이고,
            꼬리질문은 이 화면의 핵심 기능이라 발견돼야 한다.

            무엇을 하는 버튼인지도 함께 적는다 — "+ 꼬리질문 추가" 만으로는
            추가 코인이 드는 AI 호출이라는 걸 알 수 없다.
          */}
          {/*
            **보이되 조용하게.** 테두리·배경을 주면 20문항에 20개가 깔려 시끄럽고
            주인공인 "내 답변" 보다 튄다. 반대로 hover 로 숨기면 기능이 있는 줄도
            모른다 (예전 `lg:opacity-0`). 그 사이가 이 자리다 —
            평상시 text-tertiary, hover 시 brand. `min-h-8` 은 모바일 터치 타겟.
          */}
          {question.depth < 2 && !readOnly && (
            <button
              onClick={handleAddFollowup}
              disabled={creatingFollowup || followupBlocked}
              className="min-h-8 inline-flex items-center gap-1 text-xs font-medium text-text-tertiary hover:text-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                followupReason ??
                '면접관이 "그럼 왜 그렇게 했나요?" 하고 더 파고드는 질문을 만들어요 (코인이 차감됩니다)'
              }
            >
              {creatingFollowup ? (
                <>
                  <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
                  꼬리질문 만드는 중…
                </>
              ) : (
                <>
                  <CornerDownRight
                    size={13}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  꼬리질문 추가
                  {/*
                    🔴 답변이 없으면 꼬리질문은 **질문 심화**로만 나온다 — 실제 면접의
                    꼬리질문("그럼 왜 그렇게 했나요?")과 가장 먼 형태다. 막지는 않되
                    순서를 알려준다: 메모를 먼저 쓰면 그 메모를 파고든다.
                  */}
                  {!hasAnswerToProbe && (
                    <span className="text-text-faint font-normal">
                      — 답변을 적고 누르면 그 답변을 파고들어요
                    </span>
                  )}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
