import { Check, Sparkles } from 'lucide-react'
import { TourSceneLayout } from '@/components/tour/TourSceneLayout'
import { usePhase } from '@/components/tour/usePhase'
import { useTypewriter } from '@/components/tour/useTypewriter'
import { cue, cueEach } from '@/components/tour/choreo'
import { SCENE4_PHASE_MS } from '@/components/tour/scenePhases'
import { SHOWCASE_COVERLETTER } from '@/components/tour/showcase'

/**
 * 장면 4 — **「자소서, AI 가 초안까지 써 줘요」**
 *
 * 결과가 아니라 **과정**을 보여준다: 문항이 열리고 → 「AI 초안」이 눌리고 → 글자가
 * 흘러나오고 → 점검 배지가 붙는다. 완성본만 띄우면 「AI 가 있다」는 알겠는데
 * **어떻게 쓰는지**는 여전히 모른다.
 *
 * ## 안무 (`choreo.ts` `CHOREO[4]`)
 *
 * 틀 → 문항 → 「AI 초안」 버튼 → **눌림(상태)** → **타이핑(상태)** →
 * 점검 배지 3개, **「두괄식 ✓」가 마지막 팝(핵심 한 방)** → 제목 → 설명.
 */
interface Props {
  paused?: boolean
  reduced?: boolean
}

const SCENE = 4
const P_PRESS = 1
const P_TYPING = 2
const P_CHECKS = 3

export function Scene4({ paused = false, reduced = false }: Props) {
  const phase = usePhase(SCENE4_PHASE_MS.length + 1, SCENE4_PHASE_MS, {
    paused,
    instant: reduced,
  })
  const typing = useTypewriter(SHOWCASE_COVERLETTER.draft, {
    paused,
    instant: reduced || phase >= P_CHECKS,
  })
  const typingStarted = phase >= P_TYPING

  return (
    <TourSceneLayout
      scene={4}
      stage={
        <div className="w-full max-w-[440px] lg:max-w-none mx-auto lg:grid lg:grid-cols-[190px_1fr] lg:gap-3 text-left">
          {/* 데스크탑 — 문항 목록 (자소서는 문항이 여러 개다). 틀과 같은 시각에 선다 */}
          <div
            {...cue(SCENE, 'shell', 'shell')}
            className="hidden lg:block bg-surface-2 border border-line rounded-xl p-3.5"
          >
            <p className="text-[11px] font-semibold text-text-tertiary mb-2">자소서 문항</p>
            <ul className="space-y-1.5">
              {SHOWCASE_COVERLETTER.questionList.map((q) => (
                <li key={q.label} className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className={`shrink-0 mt-px w-4 h-4 rounded border flex items-center justify-center ${
                      q.state === 'done'
                        ? 'bg-brand border-brand text-bg'
                        : q.state === 'writing'
                          ? 'border-brand/60 bg-brand/10'
                          : 'border-line-strong bg-card'
                    }`}
                  >
                    {q.state === 'done' && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span
                    className={`text-[12px] leading-snug break-keep ${
                      q.state === 'writing'
                        ? 'text-text-primary font-medium'
                        : 'text-text-tertiary'
                    }`}
                  >
                    {q.label}
                    {q.state === 'writing' && (
                      <span className="block text-[10px] text-brand mt-0.5">작성 중</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div
            {...cue(SCENE, 'shell', 'shell')}
            className="bg-surface-2 border border-line rounded-xl p-4 shadow-sm"
          >
            <div {...cue(SCENE, 'question')}>
              <p className="text-[11px] text-text-tertiary">자소서 문항</p>
              <p className="text-sm text-text-primary font-medium mt-0.5 break-keep">
                {SHOWCASE_COVERLETTER.question}
              </p>
            </div>

            {/* 「AI 초안」 버튼이 **눌리는** 연출 — 사람이 하는 동작을 그대로 보여준다 */}
            <span
              {...cue(SCENE, 'aiButton', 'pop')}
              aria-hidden="true"
              className={`mt-3 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all duration-200 ${
                phase >= P_PRESS
                  ? 'bg-brand/10 border-brand/40 text-brand scale-95'
                  : 'bg-brand/[0.04] border-brand/25 text-brand'
              }`}
            >
              <Sparkles size={12} strokeWidth={1.75} />
              AI 초안
            </span>

            <div className="mt-3 space-y-1.5 min-h-[108px]">
              {typingStarted &&
                typing.lines.map((line, i) =>
                  line === '' ? null : (
                    <p
                      key={i}
                      className="text-sm text-text-secondary leading-relaxed break-keep"
                    >
                      {line}
                      {!reduced && typing.activeLine === i && (
                        <span
                          aria-hidden="true"
                          className="inline-block align-[-0.1em] ml-0.5 w-[2px] h-[0.95em] bg-brand animate-pulse"
                        />
                      )}
                    </p>
                  ),
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {SHOWCASE_COVERLETTER.checks.map((c, i) => {
                const isLast = i === SHOWCASE_COVERLETTER.checks.length - 1
                return (
                  <span
                    key={c}
                    // 🔴 마지막(「두괄식 ✓」)만 팝 — 이 장면의 핵심 한 방이다
                    {...cueEach(SCENE, 'checks', 'checkStep', i, isLast ? 'pop' : 'rise')}
                    className="text-[10px] font-medium text-success bg-success/10 border border-success/25 px-2 py-0.5 rounded-full"
                  >
                    {c}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      }
      title="자소서, AI 가 초안까지 써 줘요"
      description="회사 조사를 그대로 근거로 삼아 초안을 쓰고, 글자수·키워드·구조까지 점검해 줘요."
    />
  )
}
