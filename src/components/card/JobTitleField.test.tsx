/**
 * JobTitleField — 직무 입력 2겹 UI (`plans/job-role-first.md` 묶음 2).
 *
 * ## 시나리오 (먼저 나열하고 코드를 짰다)
 *
 * ### ① 사전 드롭다운
 *  1. 한 글자라도 치면 드롭다운이 뜬다 (「간호」 → 간호사·간호조무사…)
 *  2. 항목을 탭하면 입력이 완성되고 출처가 `'suggestion'` 이다
 *  3. 키보드 ↓ ↓ ↵ 로도 고를 수 있다
 *  4. Esc 로 닫힌다 (입력은 남는다)
 *
 * ### ② 계열 판정 행
 *  5. confident → 계열 칩 + 「다르게 고르기」, 부모엔 `manual=false` 로 알린다
 *  6. 「다르게 고르기」 → **14계열이 한 화면에** 전부 나온다 (더보기 없음)
 *  7. 🔴 수동 선택은 **추론을 이긴다** — 그 뒤 다른 직무를 쳐도 안 뒤집힌다
 *  8. 「자동으로」 → 추론으로 복귀
 *  9. ambiguous → 후보 pill, 탭하면 `manual=true`
 * 10. none(2자 이상) → 「못 찾았어요」 안내 + 「직접 고르기」
 * 11. 🔴 `fallbackSeriesLabel` 은 **표시만** — `onSeriesChange` 를 그 값으로 부르지 않는다
 * 12. 판정 행은 `aria-live="polite"` (계열이 바뀐 걸 스크린리더가 듣는다)
 *
 * ### ③ 입력 껍데기 variant (2026-08-28 카드 추가 모달 A안)
 * 13. 🔴 기본값은 `box` — 채움 배경 + 「지원 직무」 라벨 그대로 (다른 화면 회귀 방어)
 * 14. `underline` → 밑줄 입력 + 캡션 라벨 「직무」
 * 15. variant 는 **모양만** 바꾼다 — 드롭다운·판정 행은 underline 에서도 그대로 돈다
 */
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JobTitleField } from './JobTitleField'
import { JOB_SERIES } from '@/utils/jobRole'

interface HarnessProps {
  initialValue?: string
  /** 부모가 이미 들고 있는 계열 (내 정보처럼 저장된 값이 있는 화면) */
  initialSeriesId?: string | null
  fallbackSeriesLabel?: string
  seriesIsSaved?: boolean
  variant?: 'box' | 'underline'
  onChangeSpy?: (value: string, source: 'typed' | 'suggestion') => void
  onSeriesSpy?: (seriesId: string | null, manual: boolean) => void
}

/** 제어 컴포넌트라 부모가 필요하다 — 실제 사용처(모달)와 같은 배선 */
function Harness({
  initialValue = '',
  initialSeriesId = null,
  fallbackSeriesLabel,
  seriesIsSaved,
  variant,
  onChangeSpy,
  onSeriesSpy,
}: HarnessProps) {
  const [value, setValue] = useState(initialValue)
  const [seriesId, setSeriesId] = useState<string | null>(initialSeriesId)
  return (
    <JobTitleField
      value={value}
      onChange={(v, source) => {
        setValue(v)
        onChangeSpy?.(v, source)
      }}
      seriesId={seriesId}
      onSeriesChange={(id, manual) => {
        setSeriesId(id)
        onSeriesSpy?.(id, manual)
      }}
      fallbackSeriesLabel={fallbackSeriesLabel}
      seriesIsSaved={seriesIsSaved}
      variant={variant}
    />
  )
}

function type(text: string) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: text } })
}

/**
 * 판정 행만 골라낸다 — 드롭다운 행에도 계열 라벨이 보조 표기로 붙어서,
 * 문서 전체로 찾으면 「추천 목록에 보이는 라벨」과 「판정 결과」가 구분되지 않는다.
 */
function verdictRow(): HTMLElement {
  const el = document.querySelector('[aria-live="polite"]')
  if (!el) throw new Error('판정 행(aria-live)이 없다')
  return el as HTMLElement
}

describe('JobTitleField — ① 사전 드롭다운', () => {
  it('1) 한 글자 이상 타이핑 → 사전 추천이 뜬다', () => {
    render(<Harness />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    type('간호')

    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    // 각 행에 표현 + 계열 라벨 보조 표기
    expect(within(options[0]).getByText('의료·보건·복지')).toBeInTheDocument()
  })

  it('2) 항목 탭 → 입력 완성 + 출처는 suggestion', () => {
    const onChangeSpy = vi.fn()
    render(<Harness onChangeSpy={onChangeSpy} />)

    type('간호')
    fireEvent.mouseDown(screen.getByText('간호조무사'))

    expect(onChangeSpy).toHaveBeenLastCalledWith('간호조무사', 'suggestion')
    expect(screen.getByRole('combobox')).toHaveValue('간호조무사')
    // 고르고 나면 닫힌다
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('3) 키보드 ↓ ↓ ↑ ↵ 로 고를 수 있다', () => {
    const onChangeSpy = vi.fn()
    render(<Harness onChangeSpy={onChangeSpy} />)

    type('간호')
    const input = screen.getByRole('combobox')
    const first = screen.getAllByRole('option')[0].textContent

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChangeSpy).toHaveBeenLastCalledWith(expect.any(String), 'suggestion')
    expect(first).toContain(onChangeSpy.mock.calls[onChangeSpy.mock.calls.length - 1][0])
  })

  it('4) Esc → 드롭다운만 닫힌다 (입력은 남는다)', () => {
    render(<Harness />)
    type('간호')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('간호')
  })
})

describe('JobTitleField — ② 계열 판정 행', () => {
  it('5) confident → 계열 칩 + 「다르게 고르기」, 부모엔 manual=false', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness onSeriesSpy={onSeriesSpy} />)

    type('백엔드 개발자')

    expect(within(verdictRow()).getByText(/IT·개발/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다르게 고르기' })).toBeInTheDocument()
    expect(onSeriesSpy).toHaveBeenLastCalledWith('it', false)
  })

  it('6) 「다르게 고르기」 → 14계열이 한 화면에 전부 (더보기 없음)', () => {
    render(<Harness />)
    type('백엔드 개발자')
    fireEvent.click(screen.getByRole('button', { name: '다르게 고르기' }))

    for (const s of JOB_SERIES) {
      expect(screen.getByRole('button', { name: s.label })).toBeInTheDocument()
    }
    expect(JOB_SERIES).toHaveLength(14)
    expect(screen.queryByText(/더 보기/)).not.toBeInTheDocument()
  })

  it('7) 🔴 수동 선택이 추론을 이긴다 — 그 뒤 다른 직무를 쳐도 안 뒤집힌다', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness onSeriesSpy={onSeriesSpy} />)

    type('백엔드 개발자')
    fireEvent.click(screen.getByRole('button', { name: '다르게 고르기' }))
    fireEvent.click(screen.getByRole('button', { name: '금융·보험' }))

    expect(onSeriesSpy).toHaveBeenLastCalledWith('finance', true)

    // 추론이 의료를 가리켜도 사용자가 고른 금융이 남는다
    type('간호사')
    expect(within(verdictRow()).getByText(/금융·보험/)).toBeInTheDocument()
    expect(within(verdictRow()).queryByText(/의료·보건·복지/)).not.toBeInTheDocument()
    expect(onSeriesSpy).toHaveBeenLastCalledWith('finance', true)
  })

  it('8) 「자동으로」 → 추론으로 복귀', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness onSeriesSpy={onSeriesSpy} />)

    type('간호사')
    fireEvent.click(screen.getByRole('button', { name: '다르게 고르기' }))
    fireEvent.click(screen.getByRole('button', { name: '금융·보험' }))
    expect(onSeriesSpy).toHaveBeenLastCalledWith('finance', true)

    fireEvent.click(screen.getByRole('button', { name: '다르게 고르기' }))
    fireEvent.click(screen.getByRole('button', { name: '자동으로' }))

    expect(onSeriesSpy).toHaveBeenLastCalledWith('health', false)
    expect(within(verdictRow()).getByText(/의료·보건·복지/)).toBeInTheDocument()
  })

  it('9) ambiguous → 후보 pill, 탭하면 manual=true', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness onSeriesSpy={onSeriesSpy} />)

    // 「엔지니어」는 IT·제조 R&D·기계가 다 쓰는 말이라 일부러 하나로 안 찍는다
    type('엔지니어')
    expect(screen.getByText('어느 쪽에 가까워요?')).toBeInTheDocument()
    // 계열 기준 dedupe — 후보는 2~3개
    expect(onSeriesSpy).toHaveBeenLastCalledWith(null, false)

    fireEvent.click(screen.getByRole('button', { name: 'IT·개발' }))
    expect(onSeriesSpy).toHaveBeenLastCalledWith('it', true)
  })

  it('10) none(2자 이상) → 안내 + 「직접 고르기」', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness onSeriesSpy={onSeriesSpy} />)

    type('가나다라')

    expect(screen.getByText(/계열을 못 찾았어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '직접 고르기' })).toBeInTheDocument()
    // 못 찾아도 원문은 그대로 — 계열만 비운다
    expect(onSeriesSpy).toHaveBeenLastCalledWith(null, false)
    expect(screen.getByRole('combobox')).toHaveValue('가나다라')
  })

  it('11) 🔴 fallback 라벨은 표시만 — 그 값으로 onSeriesChange 를 부르지 않는다', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness fallbackSeriesLabel="IT·개발" onSeriesSpy={onSeriesSpy} />)

    expect(screen.getByText(/온보딩 기준: IT·개발 \(추정\)/)).toBeInTheDocument()
    // 빌려온 값은 저장으로 승격되지 않는다 — 부모가 받는 건 언제나 null
    for (const call of onSeriesSpy.mock.calls) {
      expect(call[0]).toBeNull()
    }
  })

  it('12) 판정 행은 aria-live="polite"', () => {
    const { container } = render(<Harness />)
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })
})

/**
 * ④ `seriesIsSaved` — 계열이 **이미 저장된 사용자 값**일 때 (내 정보 희망 직무 칸).
 *
 * 🔴 온보딩에서 **계열만 고른 사용자가 다수**다(직무 타이핑은 선택이었다). 그들에겐
 * 이 칸이 처음부터 비어 있는데, 빈 입력의 판정(`null`)이 그대로 부모에 올라가면
 * **화면을 스치기만 해도 계열이 지워진다** (2026-08-28 재현 확인 — `{seriesId:null}` 이
 * 실제로 저장 요청까지 나갔다).
 *
 * 16. 빈 값 + 저장된 계열 → 칩과 「다르게 고르기」가 보인다 (안 보이면 바꿀 길이 없다)
 * 17. 🔴 마운트 시 `onSeriesChange` 미호출 — 판정 없음을 저장값 위에 덮지 않는다
 * 18. 빈 값에서도 「다르게 고르기」로 바꾸면 `manual=true` 로 올라간다
 * 19. 🔴 **기본값(off)은 예전 그대로** — 카드 모달은 직무를 지우면 계열도 비워야 한다
 */
describe('JobTitleField — ④ seriesIsSaved (저장된 계열 보호)', () => {
  it('16) 빈 값 + 저장된 계열 → 칩 + 「다르게 고르기」', () => {
    render(<Harness seriesIsSaved initialSeriesId="health" />)

    expect(screen.getByRole('combobox')).toHaveValue('')
    // 「(추정)」이 아니라 본인 값이라 그냥 계열로 그린다
    expect(within(verdictRow()).getByText(/의료·보건·복지/)).toBeInTheDocument()
    expect(screen.queryByText(/추정/)).toBeNull()
    expect(screen.getByRole('button', { name: '다르게 고르기' })).toBeInTheDocument()
  })

  it('17) 🔴 마운트만으로는 onSeriesChange 를 부르지 않는다 (계열 유실 회귀)', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness seriesIsSaved initialSeriesId="health" onSeriesSpy={onSeriesSpy} />)

    expect(onSeriesSpy).not.toHaveBeenCalled()
  })

  it('17-b) 사전이 못 알아듣는 말을 쳐도 저장된 계열을 지우지 않는다', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness seriesIsSaved initialSeriesId="health" onSeriesSpy={onSeriesSpy} />)

    type('龍龍龍')

    // 판정 실패는 「모르겠다」지 「지워라」가 아니다
    expect(onSeriesSpy).not.toHaveBeenCalled()
    expect(within(verdictRow()).getByText(/의료·보건·복지/)).toBeInTheDocument()
  })

  it('18) 빈 값에서 「다르게 고르기」 → manual=true 로 올라간다', () => {
    const onSeriesSpy = vi.fn()
    render(<Harness seriesIsSaved initialSeriesId="health" onSeriesSpy={onSeriesSpy} />)

    fireEvent.click(screen.getByRole('button', { name: '다르게 고르기' }))
    fireEvent.click(screen.getByRole('button', { name: '공공·공무원·군인' }))

    expect(onSeriesSpy).toHaveBeenLastCalledWith('public', true)
    expect(within(verdictRow()).getByText(/공공·공무원·군인/)).toBeInTheDocument()
  })

  it('19) 🔴 기본값(off) 은 예전 그대로 — 직무를 지우면 계열도 null 로 내려간다', () => {
    const onSeriesSpy = vi.fn()
    // 카드 추가 모달의 프리필 상태 그대로 (직무 있음 + 그에서 추론한 계열)
    render(<Harness initialValue="간호사" initialSeriesId="health" onSeriesSpy={onSeriesSpy} />)

    type('')

    /*
      🔴 여기서 계열이 안 내려가면 **직무 없는 카드에 「의료·보건·복지」가 저장**되고,
      `resolveJobText` 가 그 라벨을 직무로 읽어 AI 가 계열 이름으로 자소서를 쓴다.
    */
    expect(onSeriesSpy).toHaveBeenLastCalledWith(null, false)
    expect(within(verdictRow()).queryByText(/의료·보건·복지/)).toBeNull()
  })
})

/**
 * ③ 껍데기 variant.
 *
 * 🔴 기본값이 `box` 인 게 핵심이다 — 이 컴포넌트를 쓰는 다른 화면이 카드 추가 모달
 * 재스타일에 딸려 바뀌면 안 된다. 그래서 「밑줄이 잘 나온다」보다 **「기본이 안 변했다」**를
 * 먼저 잰다.
 */
describe('JobTitleField — ③ 입력 껍데기 variant', () => {
  it('13) 🔴 기본값 box — 채움 배경 + 「지원 직무」 라벨 그대로 (회귀)', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')

    expect(input.className).toContain('bg-input')
    expect(input.className).toContain('rounded-lg')
    expect(input.className).not.toContain('border-b-[1.5px]')
    expect(screen.getByLabelText('지원 직무')).toBe(input)
  })

  it('14) underline → 밑줄 입력 + 캡션 라벨 「직무」', () => {
    render(<Harness variant="underline" />)
    const input = screen.getByRole('combobox')

    expect(input.className).toContain('border-b-[1.5px]')
    expect(input.className).toContain('bg-transparent')
    // 채움 박스 흔적이 남으면 밑줄 위에 상자가 겹쳐 보인다
    expect(input.className).not.toContain('bg-input')
    expect(screen.getByLabelText('직무')).toBe(input)
    expect(screen.queryByLabelText('지원 직무')).toBeNull()
  })

  it('15) variant 는 모양만 바꾼다 — 드롭다운·판정 행은 그대로 돈다', () => {
    render(<Harness variant="underline" />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '간호사' } })

    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    expect(within(verdictRow()).getByText(/의료·보건·복지/)).toBeInTheDocument()
    expect(screen.getByText(/자소서·면접 AI/)).toBeInTheDocument()
  })
})
