import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useRecordPractice } from '@/hooks/useInterviewPrep'
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  CATEGORY_STYLE_FALLBACK,
} from '@/types/interviewPrep'
import type { ExamTimer } from '@/utils/practiceExam'
import type { InterviewPrepQuestion } from '@/types/interviewPrep'

/**
 * 「면접 보기」 연습 루프 — **한 화면에 한 문항** (질문 은행 D3).
 *
 * 🔴 **이 화면이 서는 자리는 면접장 앞 대기실이고, 손에 든 건 폰이다.** 그래서 질문이
 * 크고(`text-xl sm:text-2xl`) 버튼이 48px 이며, 문항 전환에 애니메이션이 없다 —
 * 전환 효과는 "다음" 을 누른 뒤 **답이 뜨기까지 기다리는 시간**을 만든다.
 *
 * 🔴 **답을 먼저 보여주면 연습이 아니다.** `myMemo`·`suggestedAnswer` 는 `[내 답변 보기]`
 * 전까지 **DOM 에도 넣지 않는다.** `display:none` 이면 스크린리더·찾기(Ctrl+F)·개발자도구가
 * 그대로 읽고, 무엇보다 **자기도 모르게 눈에 들어온다.** 접기(`[답변 접기]`)도 같은 규칙이라
 * **다시 DOM 에서 빼낸다** — 숨기기로 바꾸면 계약이 스타일 한 줄로 조용히 풀린다.
 *
 * 🔴 **채점은 답을 보기 전에도 할 수 있다.** 소리 내어 답한 뒤 맞았는지 아는 사람에게
 * "일단 정답을 펴라" 를 강요하면, 그 순간부터 연습이 **읽기**로 바뀐다. 그래서 3버튼은
 * 항상 화면 아래에 있고, `[내 답변 보기]` 는 그 위에서 **여닫는 선택지**로만 존재한다.
 *
 * 🔴 **채점 저장은 best-effort 다.** 실패해도 다음 문항으로 간다 — 연습 중에 저장 실패
 * 토스트가 뜨면 집중이 끊기는데, 잃는 것은 「다시 볼 것만」 필터 한 칸뿐이다.
 */

export interface PracticeTally {
  good: number
  soso: number
  again: number
  /** 채점 없이 넘긴 문항 수 */
  skipped: number
  /**
   * 「다시」로 찍은 문항 id — **요약의 「다시 볼 것만 한 번 더」가 이 배열로 다시 돈다.**
   * 서버를 다시 묻지 않는다: 방금 이 시험에서 찍은 것이 진실이고, 저장이 실패했을 수도 있다.
   */
  againIds: string[]
}

interface Props {
  /** 시작 시 확정된 시험 문항 — **이 배열의 순서가 곧 시험 순서**다 */
  questions: InterviewPrepQuestion[]
  /** 끔 · 카운트다운(제한 시간) · 스톱워치(제한 없이 카운트업) */
  timer: ExamTimer
  onFinish: (tally: PracticeTally) => void
  /** 종료(X) — 채점은 즉시 저장되므로 확인창이 없다 */
  onExit: () => void
}

type Grade = 'good' | 'soso' | 'again'

const GRADE_LABEL: Record<Grade, string> = {
  good: '잘함',
  soso: '애매',
  again: '다시',
}
/** 의미 색 그대로 — 잘함=success · 애매=warning · 다시=danger (요약 카운트와 같은 색) */
const GRADE_STYLE: Record<Grade, string> = {
  good: 'bg-success/10 text-success border border-success/25 hover:bg-success/15',
  soso: 'bg-warning/10 text-warning border border-warning/25 hover:bg-warning/15',
  again: 'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15',
}

const KBD = 'font-mono text-[10px] border border-line rounded px-1 py-0.5 bg-surface'

/** `1:30` · `0:45` — 분이 0 이어도 자리를 지켜 숫자가 안 흔들린다 */
const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

function AnswerCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4">
      <p className="text-[11px] font-medium text-text-quaternary mb-2">{label}</p>
      {/* 긴 답변은 카드 안에서만 스크롤한다 — `overscroll-contain` 이 없으면 끝에서 페이지가 딸려 움직인다 */}
      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap max-h-[40vh] overflow-y-auto overscroll-contain">
        {text}
      </p>
    </div>
  )
}

export function PracticeSession({ questions, timer, onFinish, onExit }: Props) {
  const countdown = timer.mode === 'countdown'
  const stopwatch = timer.mode === 'stopwatch'

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  /** 카운트다운이면 **남은** 초, 스톱워치면 **흐른** 초 */
  const [sec, setSec] = useState(countdown ? timer.sec : 0)
  /**
   * 🔴 **한 번 멈춘 시계는 그 문항에서 끝이다.** `revealed` 만 보고 멈추면 [답변 접기] 로
   * 다시 닫는 순간 시계가 재개된다 — 그러면 "답변에 쓴 시간" 이 답을 읽은 뒤에도 계속
   * 불어나서 숫자가 아무 뜻이 없어진다. 그래서 **되돌릴 수 없는 래치**를 따로 둔다.
   */
  const [frozen, setFrozen] = useState(false)
  /**
   * 집계는 ref 다 — 화면에 안 그리는 값이라 state 로 두면 채점마다 렌더가 한 번 더 돈다.
   * 끝날 때 한 번만 읽는다.
   */
  const tally = useRef<PracticeTally>({
    good: 0,
    soso: 0,
    again: 0,
    skipped: 0,
    againIds: [],
  })
  const headingRef = useRef<HTMLHeadingElement>(null)

  /**
   * 세션 id 는 **문항이 들고 있다.** 별도 prop 으로 받으면 "다른 세션 문항을 넘긴" 조합이
   * 타입상 가능해진다 — 저장이 엉뚱한 세션 캐시로 들어간다.
   */
  const record = useRecordPractice(questions[0]?.sessionId ?? '')

  const q = questions[index]
  const expired = countdown && sec === 0
  /** 스톱워치는 만료가 없다 — 멈추는 이유는 오직 「답을 봤다」 하나뿐이다 */
  const running = !frozen && (stopwatch || (countdown && sec > 0))

  /* 새 질문으로 포커스를 옮긴다 — 스크린리더가 바뀐 질문을 읽는 유일한 길 */
  useEffect(() => {
    headingRef.current?.focus()
  }, [index])

  useEffect(() => {
    if (!running) return
    const id = setInterval(
      () => setSec((v) => (stopwatch ? v + 1 : Math.max(0, v - 1))),
      1000,
    )
    return () => clearInterval(id)
  }, [running, stopwatch, index])

  const advance = () => {
    if (index + 1 >= questions.length) {
      onFinish({ ...tally.current, againIds: [...tally.current.againIds] })
      return
    }
    /* 리셋은 여기서 한다 — 문항 바뀜을 effect 로 감지해 되돌리면 이전 문항의 답이
       한 프레임 동안 새 질문 밑에 붙어 보인다 (그게 이 화면에선 정답 유출이다) */
    setIndex((i) => i + 1)
    setRevealed(false)
    setFrozen(false)
    setSec(countdown ? timer.sec : 0)
  }

  /** 여닫기. **여는 순간 시계를 얼린다** — 닫아도 풀리지 않는다 (`frozen` 주석 참고) */
  const toggleReveal = () => {
    setRevealed((v) => !v)
    setFrozen(true)
  }

  const grade = (result: Grade) => {
    if (!q) return
    tally.current[result] += 1
    if (result === 'again') tally.current.againIds.push(q.id)
    /*
      🔴 **기다리지 않는다.** 질문이 그 사이 지워졌으면(404) 서버는 거절하지만, 그건
      다음 문항으로 가는 것과 아무 상관이 없다. 재시도도 없다 — 자가평가 한 칸이다.
    */
    record.mutate({ questionId: q.id, result })
    advance()
  }

  const skip = () => {
    tally.current.skipped += 1
    advance()
  }

  /**
   * 데스크탑 단축키. 폰에서는 존재하지 않지만, 앉아서 도는 사람은 문항당 두 번씩 누른다 —
   * 그 두 번이 마우스를 오가면 20문항에 40번이다.
   *
   * 입력 요소 안에서는 무시한다. 지금 이 화면에 입력칸은 없지만, 나중에 하나라도 생기면
   * `1` 을 치는 순간 다음 문항으로 넘어가 **쓰던 글이 사라진다.**
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      )
        return

      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault() // 스페이스 기본 동작 = 페이지 스크롤
        toggleReveal()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        skip()
        return
      }
      /* 🔴 reveal 여부를 묻지 않는다 — 채점 버튼이 상시 노출이므로 단축키도 같아야 한다 */
      if (e.key === '1') grade('good')
      else if (e.key === '2') grade('soso')
      else if (e.key === '3') grade('again')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!q) return null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <p className="font-mono tabular-nums text-sm text-text-tertiary">
          <span className="text-text-primary font-semibold">{index + 1}</span> /{' '}
          {questions.length}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {expired && (
            /* 만료는 **한 번만** 알린다 — 아래 카운트다운에 live 를 걸면 초마다 읽어 준다 */
            <span role="status" className="text-danger text-xs font-medium">
              시간이 됐어요
            </span>
          )}
          {timer.mode !== 'off' && (
            /*
              라벨에 값을 함께 담는다 — `aria-label="남은 시간"` 만 두면 **숫자가 사라진다**
              (라벨이 내용을 대체한다).

              🔴 **진행 표시(N/M)보다 크다.** 이 화면에서 초 단위로 바뀌는 유일한 숫자라
              곁눈으로 잡혀야 하는데, 같은 `text-sm` 이면 두 숫자가 구분이 안 됐다.

              🔴 남은 5초와 만료를 **같은 danger** 로 칠한다. 둘은 다른 사건이 아니라 한
              사건의 앞뒤라, 색이 갈리면 "노랑이 빨강으로 바뀌는" 단계로 읽힌다.
              스톱워치는 제한이 없으니 색이 변할 이유도 없다.
            */
            <span
              aria-label={`${stopwatch ? '경과 시간' : '남은 시간'} ${fmt(sec)}`}
              className={`font-mono tabular-nums text-xl font-semibold ${
                countdown && sec <= 5 ? 'text-danger' : 'text-text-tertiary'
              }`}
            >
              {fmt(sec)}
            </span>
          )}
          <button
            type="button"
            onClick={onExit}
            aria-label="연습 종료"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-text-quaternary hover:text-text-primary rounded-lg transition-colors"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-6">
        {q.category && (
          <span
            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mb-3 ${
              CATEGORY_STYLE[q.category] ?? CATEGORY_STYLE_FALLBACK
            }`}
          >
            {CATEGORY_LABEL[q.category] ?? q.category}
          </span>
        )}
        {/* `tabIndex={-1}` — 마우스·탭 순서엔 안 들어가고 코드에서만 포커스를 준다 */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl sm:text-2xl font-semibold leading-[1.6] text-text-primary whitespace-pre-wrap focus:outline-none"
        >
          {q.questionText}
        </h2>
      </div>

      {/*
        여닫기 토글. 접으면 답변 카드는 **다시 사라진다** — 실수로 펼친 뒤 "안 본 걸로"
        되돌릴 길이 있어야 하고, 그 길이 `display:none` 이면 계약이 아니다.
      */}
      <button
        type="button"
        onClick={toggleReveal}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 mt-8 w-full min-h-[48px] border border-line bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm font-medium rounded-xl transition-colors"
      >
        {revealed ? '답변 접기' : '내 답변 보기'}
      </button>

      {revealed && (
        <div className="mt-3 space-y-3">
          {q.myMemo && <AnswerCard label="내 답변" text={q.myMemo} />}
          {q.suggestedAnswer && (
            <AnswerCard label="AI 예시 답변" text={q.suggestedAnswer} />
          )}
          {!q.myMemo && !q.suggestedAnswer && (
            /* 빈 상태 — 지금 할 수 있는 일이 없으니 **언제 채우면 되는지**를 말한다 */
            <p className="text-text-tertiary text-sm leading-relaxed">
              적어둔 답변이 없어요 — 연습을 마치고 세션에서 채워보세요
            </p>
          )}
        </div>
      )}

      {/* 🔴 채점은 **항상 화면 아래 같은 자리**다 — 답을 폈든 안 폈든 다음 동작은 하나다 */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {(['good', 'soso', 'again'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => grade(g)}
            className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 min-h-[48px] rounded-lg text-sm font-semibold transition-colors ${GRADE_STYLE[g]}`}
          >
            {GRADE_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={skip}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 inline-flex items-center min-h-[44px] px-3 text-xs text-text-quaternary hover:text-text-secondary rounded-lg transition-colors"
        >
          건너뛰기 →
        </button>
      </div>

      {/* 단축키 힌트 — 폰에는 키보드가 없다 */}
      <div className="hidden sm:flex flex-wrap items-center justify-center gap-3 mt-6 text-[10px] text-text-quaternary">
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>1</kbd>
          <kbd className={KBD}>2</kbd>
          <kbd className={KBD}>3</kbd> 잘함·애매·다시
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>Space</kbd> 답변 {revealed ? '접기' : '보기'}
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className={KBD}>→</kbd> 건너뛰기
        </span>
      </div>
    </div>
  )
}
