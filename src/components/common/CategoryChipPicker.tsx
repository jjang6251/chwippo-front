import { useState } from 'react'
import {
  CATEGORY_FLOW_FALLBACK,
  CATEGORY_FLOW_ORDER,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  CATEGORY_STYLE_FALLBACK,
} from '@/types/interviewPrep'

/**
 * 질문 유형 **색 칩 피커** — 고르는 자리에서도 목록·카드와 **같은 색 언어**를 쓴다.
 *
 * 🔴 select 를 대체하는 이유가 취향이 아니다. 이 화면은 필터 행도 카드 태그도
 * `CATEGORY_STYLE` 색으로 묶음을 말하는데, **정작 고르는 자리만 폭 전체 회색 select** 라
 * "내가 지금 고르는 게 저 파란 묶음이다" 가 연결되지 않았다. 칩으로 두면 고르기 전에
 * 결과 색이 보인다.
 *
 * 🔴 나열은 `CATEGORY_FLOW_ORDER` **오름차순**이다 — 목록이 면접 진행 순서로 정렬돼서
 * 새 질문은 맨 끝이 아니라 카테고리가 정한 자리로 들어간다. 칩 줄 자체가 그 흐름이면
 * "고르면 그 자리로 들어간다" 가 문장이 아니라 **시각으로** 성립한다.
 *
 * 카테고리는 24종이라 전부 펴면 칩만 5줄이 된다. 직접 적는 질문이 실제로 몰리는 9종만
 * 먼저 두고 나머지는 접는다.
 *
 * 소비처는 **고르는 자리 전부**다 — 직접 적기·붙여넣기·카드 인라인 편집(질문 은행).
 * `CategorySelect`(select)는 `GenerateQuestionsModal` 하나에만 남아 있다: 거긴 빈 값이
 * 「미분류」가 아니라 「전체 = 부족한 유형 위주」라 뜻이 다르고, 좁은 모달이라 칩 줄이
 * 세로를 너무 먹는다.
 */

/**
 * 접기 상태에서 보이는 9종 — 직접 적는 기출이 실제로 몰리는 결.
 *
 * 🔴 `closing_remark`(마지막 한마디)는 **흐름을 닫는 자리**라 여기 있다. 면접이 실제로
 * 그 질문으로 끝나서 기출을 적는 사람이 거의 반드시 만나는데, [더보기] 안에 있으면
 * 칩 줄이 `역질문`(90)에서 끊겨 **흐름이 열린 채로 보인다.** 순서(99)라 자연히 맨 뒤다.
 */
const DEFAULT_VISIBLE = [
  'self_intro',
  'motivation',
  'coverletter_based',
  'collaboration',
  'failure',
  'domain_knowledge',
  'aspiration',
  'reverse_question',
  'closing_remark',
]

const flowOf = (slug: string) =>
  CATEGORY_FLOW_ORDER[slug] ?? CATEGORY_FLOW_FALLBACK

/**
 * 흐름 순 정렬. `Array#sort` 는 stable 이고 입력이 `CATEGORY_LABEL` **키 정의 순**이라
 * 동률(예: `cs_tech`·`domain_knowledge` 둘 다 40)은 정의 순을 지킨다.
 */
const byFlow = (slugs: string[]) => [...slugs].sort((a, b) => flowOf(a) - flowOf(b))

const ALL_SLUGS = Object.keys(CATEGORY_LABEL)
/** 앞 묶음(기본 노출)과 뒤 묶음(더보기)을 각각 흐름 순으로 — 펼쳐도 앞이 안 움직인다 */
const HEAD = byFlow(ALL_SLUGS.filter((s) => DEFAULT_VISIBLE.includes(s)))
const TAIL = byFlow(ALL_SLUGS.filter((s) => !DEFAULT_VISIBLE.includes(s)))

/**
 * 🔴 색 매핑은 **같은 페이지 필터 행과 정확히 같다** (`InterviewSessionPage` 카테고리 칩).
 *
 * - 미선택 = **그 유형의 색** — 칩 줄 전체가 색 지도라 고르기 전에 묶음이 보인다
 * - 선택 = **brand 채움** — 색 위에서 "지금 이거" 를 말하려면 결이 다른 한 수가 필요하다
 *
 * 반대로(미선택 회색·선택만 색) 두면 칩 줄이 회색 단색이 돼, select 를 걷어낸 이유가
 * 그대로 사라진다 (2026-08-11 스크린샷 실측).
 */
const CHIP_BASE =
  'inline-flex items-center justify-center min-h-7 whitespace-nowrap text-[11px] px-2 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
const CHIP_ON = 'bg-brand text-text-primary border-brand font-medium'

interface Props {
  /** `null` = 미분류 (필터로 쓰는 화면에선 「전체」 — `nullLabel` 참조) */
  value: string | null
  onChange: (v: string | null) => void
  /** 한 화면에 피커가 둘 이상 뜰 때 칩 id 가 겹치지 않게 */
  idPrefix?: string
  /**
   * 첫 칩(`null`)의 라벨.
   *
   * 🔴 **고르는 자리와 거르는 자리에서 `null` 의 뜻이 다르다.** 질문을 적을 땐 「미분류」
   * (이 질문엔 유형이 없다)지만, 「면접 보기」 설정처럼 **필터**로 쓰면 「전체」
   * (유형을 안 가린다)다. 같은 칩에 「미분류」라고 쓰면 사용자는 *미분류 질문만* 나오는
   * 줄 알고 시험을 시작한다.
   */
  nullLabel?: string
}

export function CategoryChipPicker({
  value,
  onChange,
  idPrefix = 'cat',
  nullLabel = '미분류',
}: Props) {
  const [expanded, setExpanded] = useState(false)

  /*
    접은 상태에서 뒤 묶음의 유형이 골라져 있으면 그 칩만 앞에 붙여 둔다 — 안 그러면
    "고른 유형이 화면에 없는데 그 유형으로 저장되는" 상태가 된다 (연속 추가 중 접기).
  */
  const visible = expanded
    ? [...HEAD, ...TAIL]
    : value !== null && !HEAD.includes(value)
      ? [...HEAD, value]
      : HEAD

  return (
    <div
      role="group"
      aria-label="질문 유형"
      className="flex flex-wrap items-center gap-1.5"
    >
      <button
        type="button"
        id={`${idPrefix}-none`}
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={`${CHIP_BASE} ${
          value === null
            ? CHIP_ON
            : `${CATEGORY_STYLE_FALLBACK} hover:brightness-110`
        }`}
      >
        {nullLabel}
      </button>

      {visible.map((slug) => {
        const on = value === slug
        return (
          <button
            key={slug}
            type="button"
            id={`${idPrefix}-${slug}`}
            /* 고른 칩을 다시 누르면 미분류로 — 필터 행(`selectedCat`)과 같은 동작 */
            onClick={() => onChange(on ? null : slug)}
            aria-pressed={on}
            className={`${CHIP_BASE} ${
              on
                ? CHIP_ON
                : `${CATEGORY_STYLE[slug] ?? CATEGORY_STYLE_FALLBACK} hover:brightness-110`
            }`}
          >
            {CATEGORY_LABEL[slug] ?? slug}
          </button>
        )
      })}

      {TAIL.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          /* 점선 = 유형이 아니라 동작이라는 신호 (칩 리듬은 유지) */
          className={`${CHIP_BASE} border border-dashed border-line text-text-tertiary hover:text-text-secondary hover:border-line-strong`}
        >
          {expanded ? '접기' : `+ ${TAIL.length}종 더보기`}
        </button>
      )}
    </div>
  )
}
