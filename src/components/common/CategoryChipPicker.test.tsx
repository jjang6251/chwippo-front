/**
 * 질문 유형 **색 칩 피커.**
 *
 * 🔴 이 컴포넌트의 계약은 "고를 수 있다" 가 아니라 **순서와 노출량**이다.
 * - 칩 줄이 `CATEGORY_FLOW_ORDER` 순이라야 "고르면 그 자리로 들어간다" 가 시각으로 성립한다.
 *   정렬이 깨지면 문구만 남고 힌트가 거짓이 된다.
 * - 24종을 다 펴면 칩만 다섯 줄이라 질문 입력칸이 화면 밖으로 밀린다. 기본 9종이 계약이다.
 *
 * 시나리오:
 *  A. 기본(접힘) 노출
 *   A1. 미분류 + 기본 9종만 보이고 나머지(예: 인성·장단점)는 없다
 *   A2. 미분류 다음 첫 칩은 `self_intro`(흐름 10) — 흐름 순 정렬
 *   A3. 더보기 라벨이 숨긴 개수를 말한다
 *   A4. 🔴 `마지막 한마디`(흐름 99)가 접힘 상태에서 **맨 뒤 칩**이다 — 흐름이 닫힌다
 *   A5. 🔴 `nullLabel` 로 첫 칩 이름을 바꾼다 — 거르는 자리(「면접 보기」 설정)에선
 *     `null` 이 「미분류」가 아니라 **「전체」**다 (그대로 두면 미분류만 나오는 줄 안다)
 *  B. 더보기 펼침·접기
 *   B1. 펼치면 24종 전부 + 앞 10개(미분류+9종) 위치가 그대로다 (재정렬 없음)
 *   B2. 접으면 다시 기본만
 *   B3. 🔴 뒤 묶음을 고른 채 접으면 그 칩은 남는다 (안 보이는 값으로 저장되는 사고 방지)
 *  C. 선택
 *   C1. 칩 클릭 → onChange(slug)
 *   C2. 미분류 클릭 → onChange(null)
 *   C3. 고른 칩 재클릭 → onChange(null) (필터 행과 같은 토글)
 *  D. aria
 *   D1. 고른 칩만 aria-pressed=true · 기본값은 미분류가 눌린 상태
 *   D2. group 이름 · 더보기 aria-expanded
 *  E. 색 매핑 (필터 행과 동일 문법)
 *   E1. 🔴 미선택 칩은 **그 유형의 색**을 입는다 — 칩 줄이 색 지도여야 select 를 걷어낸 뜻이 산다
 *   E2. 선택 칩은 brand 채움 (색 위에서 "지금 이거" 를 말하는 유일한 결)
 *   E3. 미분류는 미선택일 때 중립색, 선택되면 같은 brand 채움
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CategoryChipPicker } from './CategoryChipPicker'
import {
  CATEGORY_FLOW_ORDER,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  CATEGORY_STYLE_FALLBACK,
} from '@/types/interviewPrep'

/**
 * 접힘 상태에 보여야 하는 9종 (컴포넌트의 `DEFAULT_VISIBLE` 과 같은 계약).
 * **흐름 순으로 적는다** — A4 가 마지막 원소를 맨 뒤 칩과 맞춰 본다.
 */
const DEFAULT_LABELS = [
  '자기소개',
  '지원동기',
  '자소서 기반',
  '직무 지식',
  '실패 극복',
  '협업·갈등',
  '입사 후 포부',
  '역질문',
  '마지막 한마디',
]
const ALL_COUNT = Object.keys(CATEGORY_LABEL).length
const HIDDEN_COUNT = ALL_COUNT - DEFAULT_LABELS.length

const group = () => screen.getByRole('group', { name: '질문 유형' })

/** 칩 라벨을 화면 순서대로 — 더보기 토글은 유형이 아니라 동작이라 뺀다 */
const chipLabels = () =>
  within(group())
    .getAllByRole('button')
    .map((b) => b.textContent ?? '')
    .filter((t) => t !== '접기' && !t.startsWith('+'))

function draw(initial: string | null = null, onChange = vi.fn()) {
  render(<CategoryChipPicker value={initial} onChange={onChange} />)
  return onChange
}

/** 부모가 실제로 값을 들고 있는 하네스 — 접힘 유지 같은 건 왕복이 있어야 보인다 */
function Harness({ initial = null }: { initial?: string | null }) {
  const [v, setV] = useState<string | null>(initial)
  return <CategoryChipPicker value={v} onChange={setV} />
}

const moreBtn = () => screen.getByRole('button', { name: /더보기|접기/ })

describe('A. 기본(접힘) 노출', () => {
  it('A1. 미분류 + 기본 9종만 보이고 나머지는 숨는다', () => {
    draw()
    expect(chipLabels()).toHaveLength(DEFAULT_LABELS.length + 1) // +미분류
    DEFAULT_LABELS.forEach((label) =>
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('button', { name: '인성·장단점' })).toBeNull()
    expect(screen.queryByRole('button', { name: '컬처핏' })).toBeNull()
  })

  /** 🔴 흐름 순이 아니면 "고르면 그 자리로 들어간다" 힌트가 거짓말이 된다 */
  it('A2. 미분류 다음 첫 칩은 자기소개(흐름 10) 이고 전체가 흐름 오름차순이다', () => {
    draw()
    const labels = chipLabels()
    expect(labels[0]).toBe('미분류')
    expect(labels[1]).toBe('자기소개')

    const slugOf = (label: string) =>
      Object.keys(CATEGORY_LABEL).find((k) => CATEGORY_LABEL[k] === label)!
    const flows = labels.slice(1).map((l) => CATEGORY_FLOW_ORDER[slugOf(l)])
    expect(flows).toEqual([...flows].sort((a, b) => a - b))
  })

  it('A3. 더보기 라벨이 숨긴 개수를 말한다', () => {
    draw()
    expect(
      screen.getByRole('button', { name: `+ ${HIDDEN_COUNT}종 더보기` }),
    ).toBeInTheDocument()
  })

  /**
   * 🔴 접힘 상태에서 `마지막 한마디` 가 [더보기] 안에 있으면 칩 줄이 `역질문`(90)에서
   * 끊겨 **면접 흐름이 열린 채로** 보인다. 흐름 99 라 펼치지 않아도 맨 뒤여야 한다.
   */
  it('A4. 마지막 한마디가 접힘 상태에서 맨 뒤 칩이다', () => {
    draw()
    const labels = chipLabels()
    expect(labels).toContain('마지막 한마디')
    expect(labels[labels.length - 1]).toBe('마지막 한마디')
  })

  /** 🔴 필터로 쓰는 화면에서 첫 칩이 「미분류」면 *미분류 질문만* 나오는 줄 알고 시작한다 */
  it('A5. nullLabel 을 주면 첫 칩 이름만 바뀐다 (동작은 그대로 null)', () => {
    const onChange = vi.fn()
    render(
      <CategoryChipPicker value={null} onChange={onChange} nullLabel="전체" />,
    )
    expect(chipLabels()[0]).toBe('전체')
    expect(screen.queryByRole('button', { name: '미분류' })).toBeNull()

    const all = screen.getByRole('button', { name: '전체' })
    expect(all).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '자기소개' }))
    expect(onChange).toHaveBeenCalledWith('self_intro')
  })
})

describe('B. 더보기 펼침·접기', () => {
  it('B1. 펼치면 전부 보이고 앞 10칩 위치는 그대로다 (재정렬 없음)', () => {
    draw()
    const before = chipLabels()
    fireEvent.click(moreBtn())

    const after = chipLabels()
    expect(after).toHaveLength(ALL_COUNT + 1) // +미분류
    expect(after.slice(0, before.length)).toEqual(before)
    expect(screen.getByRole('button', { name: '인성·장단점' })).toBeInTheDocument()
  })

  it('B2. 접으면 다시 기본만 보인다', () => {
    draw()
    fireEvent.click(moreBtn())
    fireEvent.click(screen.getByRole('button', { name: '접기' }))

    expect(chipLabels()).toHaveLength(DEFAULT_LABELS.length + 1)
    expect(screen.queryByRole('button', { name: '인성·장단점' })).toBeNull()
  })

  /**
   * 🔴 접었다고 고른 값까지 숨기면, 화면엔 미분류처럼 보이는데 서버엔 `personality` 가
   * 나가는 어긋남이 생긴다. 고른 칩은 접혀도 남는다.
   */
  it('B3. 뒤 묶음을 고른 채 접어도 그 칩은 남는다', () => {
    render(<Harness />)
    fireEvent.click(moreBtn())
    fireEvent.click(screen.getByRole('button', { name: '인성·장단점' }))
    fireEvent.click(screen.getByRole('button', { name: '접기' }))

    const chip = screen.getByRole('button', { name: '인성·장단점' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chipLabels()).toHaveLength(DEFAULT_LABELS.length + 2) // 미분류 + 9 + 고른 것
  })
})

describe('C. 선택', () => {
  it('C1. 칩을 누르면 그 slug 로 onChange 한다', () => {
    const onChange = draw()
    fireEvent.click(screen.getByRole('button', { name: '자소서 기반' }))
    expect(onChange).toHaveBeenCalledWith('coverletter_based')
  })

  it('C2. 미분류를 누르면 null 로 onChange 한다', () => {
    const onChange = draw('self_intro')
    fireEvent.click(screen.getByRole('button', { name: '미분류' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('C3. 고른 칩을 다시 누르면 null (필터 행과 같은 토글)', () => {
    const onChange = draw('self_intro')
    fireEvent.click(screen.getByRole('button', { name: '자기소개' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('D. aria', () => {
  it('D1. 기본값은 미분류가 눌린 상태고, 고르면 그 칩 하나만 눌린다', () => {
    const { rerender } = render(
      <CategoryChipPicker value={null} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '미분류' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    rerender(<CategoryChipPicker value="motivation" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '미분류' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: '지원동기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      within(group())
        .getAllByRole('button', { pressed: true })
        .map((b) => b.textContent),
    ).toEqual(['지원동기'])
  })

  it('D2. group 에 이름이 있고 더보기는 aria-expanded 를 알린다', () => {
    draw()
    expect(group()).toBeInTheDocument()
    expect(moreBtn()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(moreBtn())
    expect(moreBtn()).toHaveAttribute('aria-expanded', 'true')
  })
})

/**
 * 🔴 필터 행(`InterviewSessionPage`)과 **같은 문법**이어야 한다. 뒤집으면(미선택 회색)
 * 칩 줄이 회색 단색이 돼서, 회색 select 를 걷어낸 이유가 그대로 사라진다.
 * 단언은 `CATEGORY_STYLE` 상수를 그대로 비교한다 — 색값이 바뀌어도 테스트가 안 낡는다.
 */
describe('E. 색 매핑 (필터 행과 동일)', () => {
  const chip = (name: string) => screen.getByRole('button', { name })

  it('E1. 미선택 칩은 그 유형의 색을 입는다 (묶음이 색으로 먼저 읽힌다)', () => {
    draw()
    // 자소서 기반 = 내 자료(warning) · 자기소개 = 공통 정형(info) — 결이 다른 둘
    expect(chip('자소서 기반').className).toContain(
      CATEGORY_STYLE.coverletter_based,
    )
    expect(chip('자기소개').className).toContain(CATEGORY_STYLE.self_intro)
    expect(chip('직무 지식').className).toContain(
      CATEGORY_STYLE.domain_knowledge,
    )
    expect(chip('자소서 기반').className).toContain('hover:brightness-110')
    // 회색 단색 금지 — 유형색이 걷히면 이 단언이 먼저 깨진다
    expect(chip('자기소개').className).not.toContain('bg-brand')
  })

  it('E2. 고른 칩만 brand 채움으로 바뀐다', () => {
    draw('self_intro')
    expect(chip('자기소개').className).toContain('bg-brand')
    expect(chip('자기소개').className).not.toContain(CATEGORY_STYLE.self_intro)
    // 나머지는 여전히 제 색
    expect(chip('지원동기').className).toContain(CATEGORY_STYLE.motivation)
  })

  it('E3. 미분류는 미선택이면 중립색, 고르면 같은 brand 채움', () => {
    const { rerender } = render(
      <CategoryChipPicker value="self_intro" onChange={vi.fn()} />,
    )
    expect(chip('미분류').className).toContain(CATEGORY_STYLE_FALLBACK)

    rerender(<CategoryChipPicker value={null} onChange={vi.fn()} />)
    expect(chip('미분류').className).toContain('bg-brand')
  })
})
