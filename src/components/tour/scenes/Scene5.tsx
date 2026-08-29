import { Check, Sparkles } from 'lucide-react'
import { TourSceneLayout } from '@/components/tour/TourSceneLayout'
import { usePhase } from '@/components/tour/usePhase'
import { cue } from '@/components/tour/choreo'
import { SCENE5_PHASE_MS, scene5ElapsedAt } from '@/components/tour/scenePhases'
import {
  SHOWCASE_INTERVIEW,
  SHOWCASE_INTERVIEW_STEP,
} from '@/components/tour/showcase'

/**
 * 장면 5 — **「면접, 실제처럼 답해 보고 피드백까지」**
 *
 * 질문 목록이 아니라 **대화 한 판**이다: 질문 → 내 답변이 문장 단위로 올라오고(타이머 동반)
 * → AI 피드백 → **Q1 이 한 줄로 접히고 Q2 가 열려** 한 판 더 돈다.
 *
 * ## 안무 (`choreo.ts` `CHOREO[5]`) — 판이 둘이라 읽기도 둘이다
 *
 * ```
 * 틀 → 상단 바 → Q1 → 말풍선 틀 → 문장 4개(상태) → 피드백 팝(핵심) → 제목·설명
 *   → 읽기 2.5s → Q1 접힘(상태) → Q2 → 문장 2개(상태) → 피드백 팝
 * ```
 *
 * 🔴 Q2 는 두 번째라 **읽기 상한이 낮다**(3s) — 이미 한 번 읽은 구조라 「어떻게 굴러가는지」만
 * 확인하면 된다. 같은 상한을 주면 뒤가 늘어져 지루해진다.
 */
interface Props {
  paused?: boolean
  reduced?: boolean
}

const SCENE = 5
const P_ANSWER = 1
const P_FEEDBACK = 2
const P_COLLAPSE = 3
const P_ANSWER2 = 4
const P_FEEDBACK2 = 5
/** 문장 하나가 오르는 간격 — 말하는 리듬 (글자 단위 타이핑은 지루했다) */
const SCENE_ANSWER_STEP = 400

export function Scene5({ paused = false, reduced = false }: Props) {
  const phase = usePhase(SCENE5_PHASE_MS.length + 1, SCENE5_PHASE_MS, {
    paused,
    instant: reduced,
  })

  /* 답변 문장이 하나씩 올라온다. 타이머는 그 리듬에 맞춰 흐른다 —
     문장이 다 나왔는데 시간만 계속 가면 「말은 끝났는데 시계가 도는」 화면이 된다. */
  const sentenceTick = usePhase(
    SHOWCASE_INTERVIEW.answer.length + 1,
    SCENE_ANSWER_STEP,
    { paused: paused || phase < P_ANSWER, instant: reduced || phase >= P_FEEDBACK },
  )
  const sentence2Tick = usePhase(
    SHOWCASE_INTERVIEW.answer2.length + 1,
    SCENE_ANSWER_STEP,
    { paused: paused || phase < P_ANSWER2, instant: reduced || phase >= P_FEEDBACK2 },
  )

  const collapsed = phase >= P_COLLAPSE

  return (
    <TourSceneLayout
      scene={5}
      tall
      stage={
        <div className="w-full max-w-[440px] lg:max-w-none mx-auto space-y-2 text-left">
          <div {...cue(SCENE, 'topBar')} className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium text-info bg-info/10 border border-info/30 px-2 py-0.5 rounded-full">
              {SHOWCASE_INTERVIEW_STEP}
            </span>
            <p className="text-[11px] text-text-tertiary">
              대비 · 예상 질문 {collapsed ? 2 : 1}/{SHOWCASE_INTERVIEW.totalQuestions}
            </p>
            <span className="ml-auto font-mono text-[11px] text-text-secondary tabular-nums">
              {formatElapsed(
                collapsed
                  ? SHOWCASE_INTERVIEW.elapsedSec2
                  : scene5ElapsedAt(sentenceTick, SHOWCASE_INTERVIEW.answer.length),
              )}
            </span>
          </div>

          {/* ── 질문 1 ── 끝나면 한 줄로 접힌다 (4장 자소서와 같은 문법) */}
          {collapsed ? (
            <div className="bg-card border border-line rounded-xl px-3 py-2 flex items-center gap-2 animate-fadeInUp motion-reduce:animate-none">
              <span
                className="shrink-0 w-4 h-4 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center text-brand"
                aria-hidden="true"
              >
                <Check size={9} strokeWidth={3} />
              </span>
              <span className="text-[12px] text-text-secondary truncate">
                {SHOWCASE_INTERVIEW.summary}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-text-quaternary">
                답변 완료 ✓
              </span>
            </div>
          ) : (
            <>
              <div {...cue(SCENE, 'question', 'shell')}>
                <QuestionCard text={SHOWCASE_INTERVIEW.question} />
              </div>
              <div {...cue(SCENE, 'bubble')}>
                <AnswerBubble
                  sentences={SHOWCASE_INTERVIEW.answer}
                  shown={sentenceTick}
                />
              </div>
              {/* 🔴 핵심 한 방 — 피드백 2줄이 팝으로 뜬다 (0.25s 간격) */}
              <div className="space-y-1.5">
                {SHOWCASE_INTERVIEW.feedback.map((f, i) => (
                  <FeedbackRow
                    key={f}
                    text={f}
                    {...cue(SCENE, 'feedback', 'pop', i * 250)}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── 질문 2 ── 실제로 열려 한 판 더 돈다 */}
          {collapsed && (
            <div className="space-y-2 animate-fadeInUp motion-reduce:animate-none">
              <QuestionCard text={SHOWCASE_INTERVIEW.question2} />
              <AnswerBubble
                sentences={SHOWCASE_INTERVIEW.answer2}
                shown={sentence2Tick}
              />
              {phase >= P_FEEDBACK2 &&
                SHOWCASE_INTERVIEW.feedback2.map((f) => (
                  <FeedbackRow key={f} text={f} className="animate-fadeInUp" />
                ))}
            </div>
          )}
        </div>
      }
      title="면접, 실제처럼 답해 보고 피드백까지"
      description="예상 질문에 직접 답해 보면 AI 가 무엇을 고치면 좋을지 짚어 줘요."
    />
  )
}

function QuestionCard({ text }: { text: string }) {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-3.5 shadow-sm">
      <div className="flex gap-2">
        <span
          className="font-mono text-brand text-[11px] mt-[3px] shrink-0"
          aria-hidden="true"
        >
          Q
        </span>
        <p className="text-sm text-text-primary font-medium leading-relaxed break-keep">
          {text}
        </p>
      </div>
    </div>
  )
}

/** 내 답변 — 오른쪽 정렬 말풍선. 문장이 하나씩 올라온다 */
function AnswerBubble({
  sentences,
  shown,
}: {
  sentences: readonly string[]
  shown: number
}) {
  if (shown <= 0) return null
  return (
    <div className="flex justify-end">
      <div className="max-w-[92%] bg-brand/10 border border-brand/25 rounded-xl rounded-tr-sm px-3 py-2 space-y-1">
        {sentences.slice(0, shown).map((s) => (
          <p
            key={s}
            className="text-sm text-text-secondary leading-relaxed break-keep animate-fadeInUp motion-reduce:animate-none"
          >
            {s}
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * AI 피드백 — 「연습만 하고 끝」이 아니라는 증거.
 * 안무 props(`data-anim` + 지연)를 그대로 받아 넘긴다 — 등장 시각은 `choreo.ts` 가 쥔다.
 */
function FeedbackRow({
  text,
  className = '',
  ...anim
}: {
  text: string
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...anim}
      className={`flex items-start gap-2 bg-card border border-line rounded-xl rounded-tl-sm px-3 py-2 motion-reduce:animate-none ${className}`}
    >
      <Sparkles
        size={12}
        strokeWidth={1.75}
        className="text-brand shrink-0 mt-[3px]"
        aria-hidden="true"
      />
      <p className="text-sm text-text-secondary leading-relaxed break-keep">{text}</p>
    </div>
  )
}

/** `00:41` — 초 단위만 쓰는 짧은 연습이라 분은 항상 00 이다 */
function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
