/**
 * 「지원서 기본 세트 N/7」 게이지.
 *
 * ## 왜 7 인가
 * 옛 게이지는 「N/8 **섹션** 작성」이었다. 섹션 수를 세다 보니 자소서 소재·시험 일정처럼
 * **지원서와 무관한 것**까지 분모에 들어가, 사용자가 「확장을 쓰려면 이걸 다 채워야 하나」로
 * 읽었다. 실측(`autofill-census-2026-09.md` 11곳)이 준 답은 반대다 — **기본 7개면 되고,
 * 나머지는 있으면 채워진다.** 그 답을 화면에 그대로 박는다.
 *
 * 계산은 `computeCoreSet` 에 있다 (여기는 그리기만).
 */
import { useState } from 'react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { useMyinfoProgress } from '@/hooks/useMyinfoProgress'
import type { JumpOptions, SectionId } from '@/utils/myinfoProgress'

const RADIUS = 38
const STROKE = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const SIZE = (RADIUS + STROKE / 2) * 2

function stageColor(percent: number): string {
  if (percent === 100) return 'text-success'
  if (percent >= 70) return 'text-brand'
  if (percent >= 30) return 'text-warning'
  return 'text-danger'
}

/** 카드 껍데기 — 로딩 스켈레톤과 본체가 **같은 박스**를 쓴다(높이 어긋남 = CLS) */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface-2 border border-line rounded-xl p-4">{children}</div>
}

export function MyinfoProgressGauge({ onJump }: {
  onJump?: (id: SectionId, opts?: JumpOptions) => void
}) {
  const { coreSet, isLoading } = useMyinfoProgress()
  const [optionalOpen, setOptionalOpen] = useState(false)

  /**
   * 칩 클릭 — 부모가 「펼치고 · 편집으로 열고 · 그 칸에 포커스」를 안다.
   * 없으면 스크롤만이라도 한다 (옵션은 부모가 없으면 실행할 방법도 없다).
   */
  const jump = (id: SectionId, opts?: JumpOptions) => {
    if (onJump) { onJump(id, opts); return }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading) {
    /*
      🔴 **로딩 자리는 실제 카드와 같은 높이여야 한다** (2026-08-11 CLS 0.179 사고).
      높이를 숫자로 박아 두면 카드가 바뀔 때마다 어긋나므로, 같은 `Shell` 안에 같은
      구조(원 + 두 줄 + 접이식 줄)를 회색으로 세운다.
    */
    return (
      <Shell>
        <div className="animate-pulse">
          <div className="flex items-center gap-4">
            <div className="flex-none rounded-full bg-card-strong" style={{ width: SIZE, height: SIZE }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-card-strong" />
              <div className="h-7 w-56 rounded bg-card-strong" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-line">
            <div className="h-[44px] sm:h-7 w-48 rounded bg-card-strong" />
          </div>
        </div>
      </Shell>
    )
  }

  const { items, done, total, percent, optional, optionalDone, optionalTotal } = coreSet
  const complete = done === total
  const color = stageColor(percent)
  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE
  const missing = items.filter((i) => !i.done)

  return (
    <Shell>
      <div className="flex items-center gap-4">
        {/* 원형 게이지 */}
        <div className="relative flex-none" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`지원서 기본 세트 ${done}/${total}`}
            className={`${color} transition-colors duration-300`}
          >
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold font-mono tabular-nums ${color}`}>
              {percent}<span className="text-sm">%</span>
            </span>
          </div>
        </div>

        {/* 우측 — 제목 + 미완료 칩 */}
        <div className="flex-1 min-w-0">
          {/* 칩을 눌러 칸을 채우면 이 숫자가 바로 오른다 — 그 변화가 들려야 「됐다」를 안다 */}
          <p aria-live="polite" className="text-sm font-semibold text-text-primary">
            지원서 기본 세트{' '}
            <span className={`font-mono tabular-nums ${color}`}>{done}</span>
            <span className="text-text-quaternary">/{total}</span>
          </p>

          {complete ? (
            <p className="text-success text-[13px] mt-1.5 leading-relaxed">
              기본 세트 완성. 이제 지원서마다 다시 적을 일이 없어요
            </p>
          ) : (
            <>
              <p className="text-text-tertiary text-[13px] mt-1 leading-relaxed">
                이 7개만 있으면 돼요 — 나머지는 있으면 채워져요
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* `title` 은 지웠다 — 칩에 이미 같은 글자(`item.hint`)가 보이는데 툴팁이 그걸 되풀이했다 */}
                {missing.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => jump(item.sectionId, item.jump)}
                    className="min-h-[44px] sm:min-h-[30px] px-2.5 rounded-full border border-line bg-card text-[11px] font-medium text-text-secondary hover:text-brand hover:border-brand/30 hover:bg-card-hover active:bg-card-strong touch-manipulation transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                  >
                    {item.hint ?? item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 「있으면 자동으로 채워져요」 ─────────────────── */}
      <div className="mt-3 pt-3 border-t border-line">
        <button
          type="button"
          onClick={() => setOptionalOpen((v) => !v)}
          aria-expanded={optionalOpen}
          aria-controls="myinfo-optional-list"
          className="w-full min-h-[44px] sm:min-h-0 sm:py-1 flex items-center justify-between gap-2 text-left text-text-tertiary hover:text-text-secondary touch-manipulation transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
        >
          <span className="text-[13px]">
            있으면 자동으로 채워져요{' '}
            <span className="font-mono tabular-nums text-text-quaternary">
              ({optionalDone}/{optionalTotal})
            </span>
          </span>
          <CollapsibleChevron open={optionalOpen} />
        </button>

        {/*
          🔴 접혀 있을 때도 **`<ul>` 은 있어야 한다** — 위 버튼의 `aria-controls` 가 없는 id 를
          가리키면 「무엇을 펼치는 버튼인지」가 끊긴다. 보이고 안 보이고는 `hidden` 이 정한다.
          ✓/○ 는 글자가 아니라 상태다 — `role="img"` 으로 이름을 붙여야 「채움」으로 읽힌다.
        */}
        {/*
          🔴 `hidden` **속성만으로는 안 숨는다** — UA 의 `[hidden]{display:none}` 은 작성자
          스타일시트의 `.flex{display:flex}` 에 진다 (같은 함정이 `index.css` 의
          `detailsContent[hidden]` 에도 있었다). 속성은 접근성용, 클래스가 실제로 숨긴다.
        */}
        <ul
          id="myinfo-optional-list"
          hidden={!optionalOpen}
          className={`mt-1 ${optionalOpen ? 'flex' : 'hidden'} flex-wrap gap-x-2 gap-y-1`}
        >
          {optional.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => jump(o.sectionId, o.jump)}
                className="min-h-[44px] sm:min-h-[28px] px-1.5 inline-flex items-center gap-1.5 rounded text-[13px] text-text-tertiary hover:text-brand touch-manipulation transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                {o.done ? (
                  <span role="img" aria-label="채움" className="text-success text-[11px]">✓</span>
                ) : (
                  <span role="img" aria-label="비어 있음" className="text-text-quaternary text-[11px]">○</span>
                )}
                <span>{o.label}</span>
                {o.consentRequired && (
                  <span className="text-[10px] text-text-quaternary">선택</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/*
        「이걸 채우면 어디에 쓰이나」 — 창고는 그 답이 안 보이면 채울 이유가 없는 화면이다.
        약속이 아니라 **지금 동작하는 것만** 적는다.
      */}
      <p className="mt-3 pt-3 border-t border-line text-xs text-text-tertiary">
        지금 쓰이는 곳: 자소서 AI 초안 · 면접 준비 · 복사 버튼
      </p>
    </Shell>
  )
}
