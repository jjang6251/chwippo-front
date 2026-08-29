import { buildJobCandidateList } from '@/utils/postingJobList'

interface Props {
  candidates: string[]
  /** 배지 판정 기준 — 내 희망 직무 */
  profileJobTitle?: string | null
  onPick: (value: string) => void
  /** 「직접 입력…」 — 후보에 없는 부문을 고르는 마지막 줄 */
  onTypeOwn: () => void
  /** 모바일(카드 안·시트)에서는 줄 높이 44px */
  dense?: boolean
}

/**
 * 「어느 직무로 지원하세요?」 — **세로 목록**.
 *
 * ## 왜 칩도 드롭다운도 아닌가 (CEO 2026-08-29)
 *
 * 후보는 「사무영업(IT)」·「문산차량/전기」처럼 **길고 서로 닮았다**. 칩으로 깔면 줄바꿈이
 * 제멋대로라 무엇과 무엇이 형제인지 안 보이고, 드롭다운은 닫혀 있는 동안 **선택지가 몇 개인지
 * 조차** 숨긴다. 한 줄에 하나씩 세우면 개수와 계층이 그대로 보인다.
 *
 * ## 탭하면 곧바로 선택된다
 *
 * 확인 버튼을 두지 않는다 — 고르는 순간이 곧 답이고, 잘못 골랐으면 카드에서 직무를 고치면
 * 된다(되돌리기도 있다). 확인 버튼은 「한 번 더 누르게 하는 값」밖에 없다.
 *
 * `role="listbox"`/`option` — 화면에는 「목록에서 하나 고르기」로 보이므로 보조기술에도 그렇게 알린다.
 */
export function JobPickList({
  candidates,
  profileJobTitle,
  onPick,
  onTypeOwn,
  dense,
}: Props) {
  const entries = buildJobCandidateList(candidates, profileJobTitle)
  const rowCls = `flex items-center gap-2 w-full ${
    dense ? 'min-h-[44px] text-[15px]' : 'min-h-[36px] text-sm'
  } px-1.5 rounded-md text-left text-text-primary border-b border-line hover:bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60`

  return (
    <div role="listbox" aria-label="직무 후보" className="flex flex-col">
      {entries.map((e, i) =>
        e.kind === 'group' ? (
          <p
            key={`g-${e.label}-${i}`}
            className="text-[11px] font-semibold tracking-wide text-text-quaternary mt-3.5 first:mt-0 mb-0.5"
          >
            {e.label}
          </p>
        ) : (
          <button
            key={`i-${e.value}`}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onPick(e.value)}
            className={`${rowCls} ${e.indented ? 'pl-4' : ''}`}
          >
            <span className="flex-1 min-w-0 truncate">{e.label}</span>
            {e.closeMatch && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold text-brand bg-brand/15">
                ✦ 내 직무와 가까움
              </span>
            )}
            <Chevron />
          </button>
        ),
      )}
      {/* 마지막 줄 — 공고 표기가 내 부문을 못 담을 때 (「비공개(외국계 제조사)」 같은 자유 입력) */}
      <button
        type="button"
        role="option"
        aria-selected={false}
        onClick={onTypeOwn}
        className={`${rowCls} border-b-0 border-t border-dashed border-line-strong mt-0.5 text-text-tertiary`}
      >
        <span className="flex-1 min-w-0 truncate">직접 입력…</span>
        <Chevron />
      </button>
    </div>
  )
}

function Chevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-text-quaternary"
    >
      <path
        d="M4.5 3L7.5 6L4.5 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
