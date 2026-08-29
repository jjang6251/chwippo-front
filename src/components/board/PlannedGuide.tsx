import { ArrowRight } from 'lucide-react'
import { StepBar } from '@/components/card/StepBar'
import type { Application } from '@/types/application'

/**
 * 「지원 예정」 카드 상세의 **첫 화면** — 「그래서 지금 뭘 하면 되나」에 답한다.
 *
 * ## 왜 필요한가 (CEO 실기 2026-08-29)
 *
 * 투어를 끝내고 지원 예정 카드에 들어가면 **빈 회사 메모 에디터 하나**가 전부였다.
 * 「전형 단계」 탭인데 전형이 안 보이는데(진행 상황 섹션이 `status !== 'PLANNED'` 조건이라
 * 통째로 빠진다), 보드 카드에는 있던 「지원 시작하기」도 여기엔 없었다 —
 * **같은 카드인데 화면마다 할 수 있는 일이 달랐다.**
 *
 * ## 세 가지를 한 블록에서 말한다
 *
 * ```
 * 지금 상태   지원 예정 · 아직 지원 전이에요
 * 앞으로      전형 미리보기 (이 카드에 이미 만들어져 있는 단계들)
 * 할 수 있는 것  지원했다면 → 지원 시작하기 / 아직이면 → 조사 보기 · 메모 남기기
 * ```
 *
 * 🔴 **전형을 「미리보기」로 보여주는 게 핵심이다.** 지원 예정 카드에도 단계는 이미
 * 템플릿으로 만들어져 있는데 화면에 안 나와서, 사용자는 「아직 아무것도 없는 카드」로
 * 오해했다. 실제 `StepBar` 를 **전부 미도달 톤**(`currentStepIndex: -1`)으로 세우면
 * 「지원을 시작하면 이 길을 걷는다」가 말이 아니라 그림으로 읽힌다.
 *
 * 🔴 **카드처럼 보이면 안 된다.** 좌측 accent 스트라이프(`border-l-2`)는 보드 카드의
 * 상태 표식이라, 상세 안에서 또 쓰면 「카드 안에 카드」가 된다
 * (`CardResearchReveal` 의 「같은 언어, 다른 그릇」 원칙). 면·테두리·라운드만 쓴다.
 */
interface Props {
  app: Application
  /** 조사 캐시에서 센 면접 키워드 수 — 0 이면 개수를 말하지 않는다 */
  keywordCount: number
  /** 「회사 알아보기」 탭이 실제로 있을 때만 그 링크를 낸다 */
  hasResearchTab: boolean
  onStart: () => void
  onOpenResearch: () => void
  onFocusMemo: () => void
}

/** 링크 두 개가 같은 규격을 본다 — 44px 타깃(모바일)과 밑줄이 한 곳에서 나온다 */
const LINK =
  'inline-flex items-center min-h-[44px] lg:min-h-0 lg:py-1 text-sm text-text-secondary underline underline-offset-2 hover:text-text-primary transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'

export function PlannedGuide({
  app,
  keywordCount,
  hasResearchTab,
  onStart,
  onOpenResearch,
  onFocusMemo,
}: Props) {
  const steps = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)

  return (
    <div
      data-planned-guide
      className="bg-surface-2 border border-line rounded-xl p-4 lg:p-5 mb-4"
    >
      {/* ① 지금 어디인가 */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-medium text-text-tertiary bg-card border border-line px-2 py-0.5 rounded-full">
          지원 예정
        </span>
        <p className="text-sm font-semibold text-text-primary">아직 지원 전이에요</p>
      </div>

      {/* ② 앞으로 — 🔴 `currentStepIndex: -1` 이라 전부 미도달 톤이다(진행 0%).
             `onStepClick` 을 주지 않아 눌러도 아무 일이 없다 — 아직 걷지 않은 길이다. */}
      <div className="mt-4">
        {steps.length > 0 ? (
          <StepBar steps={steps} currentStepIndex={-1} status="PLANNED" size="sm" />
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed break-keep">
            지원 시작하면 전형 단계가 자동으로 채워져요
          </p>
        )}
      </div>

      {/* ③ 할 수 있는 것 — 두 갈래. 「했다면」이 먼저다(그게 이 카드의 다음 상태다) */}
      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-xs text-text-tertiary">지원했다면</p>
        <button
          type="button"
          onClick={onStart}
          className="mt-1.5 inline-flex items-center gap-1.5 min-h-[44px] px-4 bg-brand hover:bg-accent active:bg-accent-hover text-bg text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
        >
          지원 시작하기
          <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
        {/* 마감일이 왜 이득인지 그 자리에서 말한다 — 모달을 열고 나서 알면 늦다 */}
        <p className="mt-1.5 text-xs text-text-tertiary break-keep">
          마감일을 넣으면 D-day 와 캘린더가 붙어요
        </p>

        <p className="mt-4 text-xs text-text-tertiary">아직이면</p>
        <div className="flex flex-col items-start lg:flex-row lg:items-center lg:gap-4">
          {hasResearchTab && (
            <button type="button" onClick={onOpenResearch} className={LINK}>
              {keywordCount > 0
                ? `회사 알아보기 · 면접 키워드 ${keywordCount}개 준비됨`
                : '회사 알아보기'}
            </button>
          )}
          <button type="button" onClick={onFocusMemo} className={LINK}>
            메모 남기기
          </button>
        </div>
      </div>
    </div>
  )
}
