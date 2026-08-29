import { useState } from 'react'
import { Check } from 'lucide-react'
import type { ApplicationStep, ApplicationStatus } from '@/types/application'

interface StepBarProps {
  steps: ApplicationStep[]
  currentStepIndex: number
  status?: ApplicationStatus
  onStepClick?: (index: number) => void
  /** 「현재: {스텝명}」 줄(md 하단) 전용 — 스텝 상세로. 열(노드+레이블)과는 다른 요소다 */
  onStepNameClick?: (stepId: string) => void
  size?: 'sm' | 'md'
}

function ProgressBar({ progress, isPassed, height = 'h-1.5' }: { progress: number; isPassed?: boolean; height?: string }) {
  return (
    <div
      className={`w-full bg-line-strong rounded-full overflow-hidden ${height}`}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={isPassed ? '최종 합격' : `진행률 ${progress}%`}
    >
      <div
        data-step-progress
        className={`h-full rounded-full transition-all duration-500 ease-out ${isPassed ? 'bg-success' : 'bg-brand'}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export function StepBar({ steps, currentStepIndex, status, onStepClick, onStepNameClick, size = 'sm' }: StepBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  /**
   * 🔴 **터치에는 hover 가 없다.** 예전엔 `hover:scale-125` 가 유일한 반응이라
   * 모바일에서 눌러도 아무 신호가 없었고, 그래서 「노드를 눌러도 단계가 움직인다」는 걸
   * 아무도 몰랐다 (2026-08-24 실사용 보고). 눌린 순간을 눈에 보이게 만드는 게 이 state 다.
   */
  const [pressedIndex, setPressedIndex] = useState<number | null>(null)
  if (steps.length === 0) return null

  const sorted = [...steps].sort((a, b) => a.orderIndex - b.orderIndex)
  /**
   * 🔴 **음수 인덱스를 막는다.** 「지원 예정」 미리보기(`PlannedGuide`)가 **아직 아무
   * 단계도 밟지 않았다**는 뜻으로 `-1` 을 넘긴다 — 그대로 계산하면 `-25%` 가 나와
   * `width: -25%`(무효) + `aria-valuenow="-25"`(범위 밖)가 된다.
   * 기존 호출부는 전부 0 이상이라 값이 달라지지 않는다.
   */
  const progress = Math.max(
    0,
    Math.round((currentStepIndex / Math.max(sorted.length - 1, 1)) * 100),
  )
  /** 아직 시작 전 — 이름 붙일 「현재」가 없으므로 하단 요약 줄을 내지 않는다 */
  const started = currentStepIndex >= 0
  const nodeSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const checkSize = size === 'sm' ? 6 : 8

  /**
   * 🔴 **스텝바는 한 가지 일만 한다 — 단계 이동.** 보드 카드도 카드 상세도 같다.
   *
   * 예전엔 노드(위)와 레이블(아래)이 8px 사이로 붙어 **서로 다른 일**을 했다 —
   * 위는 단계 이동, 아래는 스텝 상세로 화면 전환. 게다가 레이블은 15px 높이라
   * 노드보다도 누르기 나빴다. 그 애매함이 「노드를 누르다 딴 데로 간다」의 절반이었다.
   *
   * 이제 열 하나가 통째로 한 타깃이다 — 노드 32 + 간격 12 + 레이블 15 = **49px**.
   * 셀 폭과 합쳐 44×44 기준을 **두 축 모두** 넘긴다 (12×12 대비 면적 14배).
   *
   * 스텝 상세는 **현재 스텝 카드의 「스텝 열기」**와 **md 하단 「현재: …」 줄**이 맡는다 —
   * 열은 겸하지 않는다 (CEO 결정 2026-08-25). 둘은 서로 떨어진 별개 요소라
   * 예전처럼 8px 사이에서 헷갈리지 않는다.
   */
  const canMove = !!onStepClick

  return (
    /*
      🔴 `data-no-card-nav` — **빗나간 탭이 카드 상세로 튀는 걸 막는 표식**
      (`CompanyCard.handleCardClick` 이 읽는다).

      노드를 61×32 로 키워도 빗나감은 남는다. 실측하면 히트 영역 밖 18px 부터 다시
      카드 상세로 튀었다. 바뀌어야 하는 건 **빗나갔을 때의 대가**라서, 스텝바 구역 전체를
      「아무 일도 안 일어나는 곳」으로 둔다.

      ⚠️ 진행률 바·「현재: …」 줄을 눌러도 카드 상세로 안 간다 — 의도한 맞바꿈이다.
      카드 상단(회사명·직무·태그)이 이동을 맡고, 이 아래 구역은 **단계 조작 전용**이 된다.
      노드 행에만 걸면 표식이 하는 일이 없다 — 그 범위는 이미 버튼들이 덮고 있어서
      `closest('button')` 로 걸러진다 (2026-08-25 실측으로 확인).
    */
    <div className="w-full" data-no-card-nav>
      {/* ── 노드 행 ──
          모든 셀: [flex-1 왼쪽] [노드] [flex-1 오른쪽]
          첫/마지막 셀의 바깥쪽 spacer는 투명(invisible)하게만 처리 → 노드가 모든 셀 정중앙 고정 */}
      <div className="flex">
        {sorted.map((step, i) => {
          const isDone = i < currentStepIndex
          const isCurrent = i === currentStepIndex
          const isFirst = i === 0
          const isLast = i === sorted.length - 1
          const isHovered = hoveredIndex === i
          const isPressed = pressedIndex === i

          return (
            /*
              🔴 `min-w-0` — 레이블이 셀 **안**으로 들어오면서 필요해졌다.
              레이블은 `whitespace-nowrap` 이라 min-content 가 글자 전체 폭이고, 셀의
              자동 최소 크기가 거기에 밀린다. 그러면 「1차 결과 대기」 셀만 50px 로 벌어져
              **노드 간격이 어긋난다**(다른 셀 41px, 실측). 예전엔 레이블이 별도 행이라
              자기 `min-w-0` 로 해결됐는데, 한 단계 깊어지면서 셀에도 필요해졌다.
            */
            /* `data-step-cell` — 시각 무변경 훅. 앱 소개 투어 1장이 노드를 왼쪽부터
               차례로 점등시킬 때 잡는다 (`index.css` 의 `.tour-stage-1`) */
            <div
              key={step.id}
              data-step-cell
              className="relative flex-1 min-w-0 flex flex-col items-center"
            >
              {/*
                🔴 **히트 영역은 셀 전체 × 32px** — 점(12×12)을 그대로 누르게 두면 안 된다.
                44px 기준 대비 면적이 1/13 이라 모바일에서 거의 안 눌린다 (2026-08-24 실사용 보고).

                폭을 셀에 맞추는 게 핵심이다. 고정 44px 로 넓히면 **기본 7단계에서 간격이
                43.5px**(375px 실측)이라 이웃과 겹쳐 **엉뚱한 단계로 이동**한다. 셀 폭이면
                겹치지도 비지도 않는다 — 어느 좌표든 가장 가까운 노드 하나로만 간다.

                세로는 **셀 바닥까지** 간다 — 레이블(15px)과 그 위 간격(12px)까지 삼켜
                한 열이 49px 이 된다. 레이블은 `<span>` 이라 훔칠 버튼이 없다.
                위 10px 는 태그 행의 `mb-3` 여백에 떨어진다.
              */}
              <button
                type="button"
                onClick={() => onStepClick?.(i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => { setHoveredIndex(null); setPressedIndex(null) }}
                onPointerDown={() => setPressedIndex(i)}
                onPointerUp={() => setPressedIndex(null)}
                onPointerCancel={() => setPressedIndex(null)}
                disabled={!canMove}
                aria-label={`${step.name}${isDone ? ' (완료)' : isCurrent ? ' (현재)' : ''}`}
                className={`
                  absolute inset-x-0 -top-[10px] bottom-0 z-10 rounded-md
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60
                  ${canMove ? 'cursor-pointer' : 'cursor-default'}
                `}
              />
              <div className="flex items-center w-full">

                {/* 왼쪽: 첫 셀은 투명 spacer, 나머지는 실제 연결선 */}
                <div className="flex-1 flex items-center">
                  {!isFirst && (
                    <div className="w-full h-px overflow-hidden bg-line-strong">
                      <div
                        className="h-full bg-brand transition-all duration-500 ease-out"
                        style={{ width: i <= currentStepIndex ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </div>

                {/* 노드 + 툴팁 */}
                <div className="relative shrink-0">
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      <div className="bg-surface-3 border border-line text-text-primary text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                        {step.name}
                        {isDone && <Check size={12} strokeWidth={2.25} className="inline-block align-[-0.125em] ml-1.5 text-brand" aria-hidden="true" />}
                        {isCurrent && <span className="ml-1.5 text-brand">← 현재</span>}
                      </div>
                      <div className="w-1.5 h-1.5 bg-surface-3 border-r border-b border-line rotate-45 mx-auto -mt-1" />
                    </div>
                  )}
                  {/*
                    점은 **보이기만 한다** — 누르는 건 위 오버레이 버튼이다.
                    ⚠️ 그래서 hover·press 를 `hover:`·`active:` CSS 로 못 건다 (오버레이는
                    이 점의 형제가 아니라 조상 셀의 자식이라 선택자가 닿지 않는다).
                    상태로 칠하는 이유가 그것이고, 툴팁이 이미 같은 방식이다.
                  */}
                  <div
                    aria-hidden="true"
                    className={`
                      relative flex-none rounded-full transition-all duration-200 flex items-center justify-center
                      ${nodeSize}
                      ${isDone ? 'bg-brand shadow-[0_0_6px_rgb(var(--brand)/0.4)]' : ''}
                      ${isCurrent ? 'bg-brand shadow-[0_0_10px_rgb(var(--brand)/0.6)]' : ''}
                      ${!isDone && !isCurrent ? 'bg-line-strong border border-line-strong' : ''}
                      ${canMove && isPressed ? 'scale-125 shadow-[0_0_0_5px_rgb(var(--brand)/0.28)]' : ''}
                      ${canMove && !isPressed && isHovered ? 'scale-125 shadow-[0_0_12px_rgb(var(--brand)/0.5)]' : ''}
                    `}
                  >
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-brand/50 animate-ping" />
                    )}
                    {isDone && (
                      <svg className="text-text-primary" width={checkSize} height={checkSize} viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2.5 2.5L7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 마지막 셀은 투명 spacer, 나머지는 실제 연결선 */}
                <div className="flex-1 flex items-center">
                  {!isLast && (
                    <div className="w-full h-px overflow-hidden bg-line-strong">
                      <div
                        className="h-full bg-brand transition-all duration-500 ease-out"
                        style={{ width: i < currentStepIndex ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </div>

              </div>

              {/* ── 스텝명 레이블 (sm + md 공통) ──
                  🔴 **셀 안에 있다** — 예전엔 별도 행이었는데, 그러면 노드 히트 영역이
                  레이블까지 덮을 수가 없다(오버레이의 기준 상자가 셀이라서).
                  `w-full` — 셀이 `flex-col` 이라 `flex-1` 을 쓰면 세로로 늘어난다.
                  overflow-hidden truncate → 노드 간격만큼 잘리고 ... 처리 */}
              {/* 위 오버레이가 여기까지 덮으므로 버튼일 이유가 없다. `title` 도 없다 —
                  hover 가 이 요소에 안 닿고, 같은 이름을 노드 툴팁이 이미 보여준다.
                  🔴 예전엔 미도달 단계가 text-faint 였다 — DESIGN.md 가 「장식 전용·본문성
                  정보 금지」로 규정한 토큰인데 전형 단계 이름은 정보다 (다크 2.65 · 라이트 2.88,
                  2026-08-17 실측). 약하게 두되 읽히도록 tertiary 로 올렸다. */}
              <span
                aria-hidden="true"
                className={`
                  w-full min-w-0 mt-3 text-center overflow-hidden text-ellipsis whitespace-nowrap
                  leading-tight px-0.5 py-0.5
                  ${size === 'sm' ? 'text-[8px]' : 'text-[9px] font-medium'}
                  ${isCurrent ? 'text-brand' : 'text-text-tertiary'}
                `}
              >
                {step.name}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── sm 하단: 현재 단계 + 진행률 바 ── */}
      {/* `data-step-summary` — 시각 무변경 훅. 투어 1장에서 노드와 함께 켜진다
          (안 잡으면 빈 카드 껍데기 안에 「현재: …  25%」만 떠 있는 프레임이 생긴다) */}
      {size === 'sm' && started && (
        <div data-step-summary className="mt-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-text-quaternary text-[10px] truncate">
              현재:{' '}
              <span className="text-text-secondary font-medium">
                {sorted[currentStepIndex]?.name ?? '완료'}
              </span>
            </span>
            <span className="text-text-secondary text-[10px] font-mono font-semibold tabular-nums shrink-0 ml-2">
              {progress}%
            </span>
          </div>
          <ProgressBar progress={progress} isPassed={status === 'PASSED'} height="h-1.5" />
        </div>
      )}

      {/* ── md 하단: 현재 단계 + % + 진행률 바 ── */}
      {size === 'md' && started && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const cur = sorted[currentStepIndex]
                if (cur && onStepNameClick) onStepNameClick(cur.id)
              }}
              disabled={!onStepNameClick}
              className={`flex items-center gap-1.5 group/cur ${onStepNameClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="w-2 h-2 rounded-full bg-brand shadow-[0_0_6px_rgb(var(--brand)/0.6)] inline-block shrink-0" />
              <span
                className={`text-text-secondary text-sm font-medium transition-colors ${
                  onStepNameClick ? 'group-hover/cur:text-text-primary group-hover/cur:underline underline-offset-2' : ''
                }`}
              >
                현재: {sorted[currentStepIndex]?.name ?? '완료'}
              </span>
            </button>
            <span className="text-text-secondary text-sm font-mono font-semibold tabular-nums shrink-0 ml-2">
              {progress}%
            </span>
          </div>
          <ProgressBar progress={progress} isPassed={status === 'PASSED'} height="h-2" />
        </div>
      )}
    </div>
  )
}
