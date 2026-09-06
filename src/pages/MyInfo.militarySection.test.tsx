/**
 * 내 정보 › 병역사항 — **상태 9종 select + 조건부 펼침** (대장 44 · 웹 선행 릴리즈).
 *
 * 왜 바꿨나: 지원서 폼 11곳 중 9곳이 병역을 묻는데 상태가 「군필/미필」 둘이 아니다
 * (현대차 9종 · 현대카드 6종). 상세 칸은 해당 상태에서만 편다.
 *
 * 🔴 입력은 세그먼트 9칸에서 **select** 로 바꿨다 — 모바일에서 두 줄로 접혀 「어느 게 골라진
 * 건가」를 매번 다시 읽게 만들었다. 그리고 기본값을 없앴다: 저장 전에는 「선택」이다
 * (「비대상」이 미리 눌려 있으면 답한 것처럼 보이는데 서버에는 값이 없다).
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 여성이면 섹션이 안내만 보여준다 (기존 규칙 유지)
 *  2. 상태 9종이 전부 select 옵션으로 나온다 (+ 「선택」 placeholder)
 *  2-a. 🔴 저장 전이면 placeholder 가 골라져 있다 (「비대상」이 아니다)
 *  2-b. 🔴 「선택」으로 되돌리면 military_status: null 로 비운다
 *  2-c. select 는 프로젝트 패턴 그대로 — appearance-none · h-12 · text-base · 라벨 연결
 *  3. 🔴 비대상 — 군별·계급·병과·기간·제대구분·사유가 **하나도 없다**
 *  4. 🔴 군필/복무중/전역예정/특례 → 상세 6칸이 펴진다
 *  5. 🔴 미필·면제 → 사유 한 칸만, 상세는 없다
 *  6. 복무 중이면 전역일이 잠기고, 남아 있던 전역일은 null 로 지운다
 *  7. 제대 구분은 코드값 + 옛 한글 라벨을 같이 저장한다 (하위 호환)
 *  8. 병과는 새 칸과 옛 `military_unit` 을 같이 저장한다 (하위 호환)
 *  9. 옛 데이터 매핑 — `military_type: '복무 중'` → 상태 serving
 * 10. 옛 데이터 매핑 — 옛 칸만 차 있으면 군필 + 제대구분 코드 변환
 * 11. 🔴 복무 기간 칩 — 입대일 + 18개월 **− 1일**이 전역일이다
 * 12. 전역일이 입대일보다 빠르면 저장하지 않는다
 *  ── 빈 섹션은 편집으로 · 게이지 칩 지시 (대장 44)
 * 13. 🔴 남성인데 병역이 통째로 비었으면 처음부터 편집이다
 * 14. 상태가 저장돼 있으면 보기 모드로 시작한다
 * 15. 🔴 게이지 「병역」 칩 {edit} → 바로 편집으로 열린다
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '@/api/myinfo'
import { MilitarySection, type SectionIntent } from './MyInfo'

const h = vi.hoisted(() => ({
  profile: {} as Partial<UserProfile>,
  update: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/hooks/useMyinfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMyinfo')>()),
  useProfile: () => ({ data: h.profile }),
  useUpdateProfile: () => ({ mutate: h.update }),
}))
vi.mock('@/stores/toastStore', () => ({ toast: { error: h.toastError, show: vi.fn() } }))

const draw = (intent?: SectionIntent | null) => render(<MilitarySection sectionRef={() => {}} intent={intent} />)
const lastDto = () => h.update.mock.calls.at(-1)?.[0]

/** 접힌 섹션을 펴고 편집 모드로 들어간다 */
function openEditing() {
  draw()
  fireEvent.click(screen.getByRole('button', { name: /병역사항/ }))
  const edit = screen.queryByRole('button', { name: '편집' })
  if (edit) fireEvent.click(edit)
}

/** 병역 상태 select — 라벨로 잡는다 (`SelectField` 가 `<label for>` 를 건다) */
const statusSelect = () => screen.getByLabelText('병역 상태') as HTMLSelectElement
/** 화면 라벨 → 저장 코드값 (select 는 값으로 바뀐다) */
const STATUS_VALUE: Record<string, string> = {
  '비대상': 'not_applicable', '군필': 'completed', '복무 중': 'serving',
  '전역예정': 'discharge_expected', '미필': 'not_completed', '면제': 'exempted',
  '특례 복무 중': 'alt_service_serving', '특례 필': 'alt_service_completed',
  '의가사 전역': 'medical_discharge',
}
const pickStatus = (label: string) =>
  fireEvent.change(statusSelect(), { target: { value: STATUS_VALUE[label] } })

/** 제대 구분은 그대로 세그먼트다 — 그 안에서 라벨로 버튼 찾기 */
function chip(group: HTMLElement, label: string): HTMLElement {
  const found = [...group.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!found) throw new Error(`칩을 찾지 못함: ${label}`)
  return found
}

beforeEach(() => {
  h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'not_applicable' }
  h.update.mockReset()
  h.toastError.mockReset()
  localStorage.clear()
})
afterEach(cleanup)

describe('병역사항 — 상태 select · 조건부 펼침', () => {
  it('여성이면 안내만 보여준다 (기존 규칙 유지)', () => {
    h.profile = { user_id: 'u1', gender: 'FEMALE' }
    draw()
    fireEvent.click(screen.getByRole('button', { name: /병역사항/ }))
    expect(screen.getByText(/성별을/)).toBeInTheDocument()
    expect(screen.queryByLabelText('병역 상태')).toBeNull()
  })

  it('상태 9종이 전부 나온다 (+ 「선택」 placeholder)', () => {
    openEditing()
    const labels = [...statusSelect().options].map((o) => o.textContent?.trim())
    expect(labels).toEqual([
      '선택',
      '비대상', '군필', '복무 중', '전역예정', '미필', '면제',
      '특례 복무 중', '특례 필', '의가사 전역',
    ])
  })

  it('2-a) 🔴 저장 전이면 「선택」이 골라져 있다 — 「비대상」이 미리 답으로 들어가지 않는다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE' }
    openEditing()
    expect(statusSelect()).toHaveValue('')
    expect(h.update).not.toHaveBeenCalled()
  })

  it('2-b) 🔴 「선택」으로 되돌리면 military_status 를 null 로 비운다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'completed' }
    openEditing()
    fireEvent.change(statusSelect(), { target: { value: '' } })
    expect(lastDto()).toEqual({ military_status: null })
  })

  it('2-c) select 는 프로젝트 패턴 그대로 — appearance-none · h-12 · text-base', () => {
    openEditing()
    const cls = statusSelect().className
    expect(cls).toContain('appearance-none')
    expect(cls).toContain('h-12')
    expect(cls).toContain('text-base')
    // 커스텀 chevron 은 그리기용이라 포인터를 먹지 않는다
    const chevron = statusSelect().parentElement!.querySelector('svg')!
    expect(chevron.getAttribute('class')).toContain('pointer-events-none')
    expect(chevron.getAttribute('class')).toContain('text-text-quaternary')
  })

  it('🔴 비대상 — 상세 칸도 사유 칸도 없다', () => {
    openEditing()
    expect(statusSelect()).toHaveValue('not_applicable')
    expect(screen.queryByRole('group', { name: '제대 구분' })).toBeNull()
    expect(screen.queryByPlaceholderText('병장, 하사 등')).toBeNull()
    expect(screen.queryByPlaceholderText('보병, 통신 등')).toBeNull()
    expect(screen.queryByPlaceholderText(/생계곤란/)).toBeNull()
  })

  it.each(['군필', '복무 중', '전역예정', '특례 복무 중', '특례 필', '의가사 전역'])(
    '🔴 %s → 상세 칸이 펴진다',
    (label) => {
      openEditing()
      pickStatus(label)
      expect(screen.getByPlaceholderText('병장, 하사 등')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('보병, 통신 등')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: '제대 구분' })).toBeInTheDocument()
      expect(screen.queryByPlaceholderText(/생계곤란/)).toBeNull()
    },
  )

  it.each(['미필', '면제'])('🔴 %s → 사유 한 칸만 (상세는 없다)', (label) => {
    openEditing()
    pickStatus(label)
    expect(screen.getByPlaceholderText(/생계곤란/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('병장, 하사 등')).toBeNull()
    expect(screen.queryByRole('group', { name: '제대 구분' })).toBeNull()
  })

  it('복무 중이면 전역일이 잠기고 남아 있던 값은 null 로 지운다', () => {
    h.profile = {
      user_id: 'u1', gender: 'MALE',
      military_status: 'completed', military_end: '2020-01-01',
    }
    openEditing()
    pickStatus('복무 중')
    expect(lastDto()).toEqual({ military_status: 'serving', military_end: null })
    expect(screen.getByLabelText(/전역일 \(복무 중\)/)).toBeDisabled()
  })

  it('제대 구분 — 코드값 + 옛 한글 라벨을 같이 저장한다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'completed' }
    openEditing()
    fireEvent.click(chip(screen.getByRole('group', { name: '제대 구분' }), '의병전역'))
    expect(lastDto()).toEqual({ military_discharge: 'medical', military_type: '의병전역' })
  })

  it('병과 — 새 칸과 옛 military_unit 을 같이 저장한다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'completed' }
    openEditing()
    const specialty = screen.getByPlaceholderText('보병, 통신 등')
    fireEvent.change(specialty, { target: { value: '통신' } })
    fireEvent.blur(specialty)
    expect(lastDto()).toEqual({ military_specialty: '통신', military_unit: '통신' })
  })

  it('옛 데이터 매핑 — military_type 「복무 중」 → 상태 serving', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_type: '복무 중' }
    openEditing()
    expect(statusSelect()).toHaveValue('serving')
  })

  it('옛 데이터 매핑 — 옛 칸만 차 있으면 군필 + 제대구분 코드로 변환', () => {
    h.profile = {
      user_id: 'u1', gender: 'MALE',
      military_branch: '육군', military_type: '만기전역', military_unit: '보병',
    }
    openEditing()
    expect(statusSelect()).toHaveValue('completed')
    expect(chip(screen.getByRole('group', { name: '제대 구분' }), '만기전역'))
      .toHaveAttribute('aria-pressed', 'true')
    // 옛 부대 칸의 값이 병과로 넘어와 있다
    expect(screen.getByPlaceholderText('보병, 통신 등')).toHaveValue('보병')
  })

  /**
   * 🔴 입대일은 복무 기간에 **들어간다** — 전역일은 「해당일 −1」이다. 옛 계산(2020-09-04)은
   * 하루 늦은 날짜라 지원서에 그대로 옮겨 적으면 틀린 값이 된다.
   */
  it('11) 🔴 복무 기간 칩 — 입대일 + 18개월 − 1일이 전역일이다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'completed', military_start: '2019-03-04' }
    openEditing()
    fireEvent.click(screen.getByRole('button', { name: '18개월' }))
    expect(lastDto()).toEqual({ military_end: '2020-09-03' })
  })

  it('11-a) 🔴 2020-01-01 입대 + 18개월 → 2021-06-30', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'completed', military_start: '2020-01-01' }
    openEditing()
    fireEvent.click(screen.getByRole('button', { name: '18개월' }))
    expect(lastDto()).toEqual({ military_end: '2021-06-30' })
  })

  it('전역일이 입대일보다 빠르면 저장하지 않는다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'completed', military_start: '2020-01-01' }
    openEditing()
    fireEvent.change(screen.getByLabelText('전역일'), { target: { value: '2019-01-01' } })
    expect(h.toastError).toHaveBeenCalled()
    expect(h.update).not.toHaveBeenCalled()
  })
})

describe('병역사항 — 빈 섹션은 편집으로 · 칩 지시', () => {
  it('13) 🔴 남성인데 병역이 통째로 비었으면 처음부터 편집이다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE' }
    draw()
    fireEvent.click(screen.getByRole('button', { name: /병역사항/ }))
    expect(screen.queryByRole('button', { name: '편집' })).toBeNull()
    expect(screen.queryByText(/병역사항 입력하기/)).toBeNull()
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument()
    expect(statusSelect()).toBeInTheDocument()
  })

  it('14) 상태가 저장돼 있으면 보기 모드로 시작한다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'not_applicable' }
    draw()
    fireEvent.click(screen.getByRole('button', { name: /병역사항/ }))
    expect(screen.getByRole('button', { name: '편집' })).toBeInTheDocument()
    expect(screen.queryByLabelText('병역 상태')).toBeNull()
  })

  it('15) 🔴 게이지 「병역」 칩 {edit} → 바로 편집으로 열린다', () => {
    h.profile = { user_id: 'u1', gender: 'MALE', military_status: 'completed' }
    draw({ section: 'military', opts: { edit: true }, seq: 1 })
    fireEvent.click(screen.getByRole('button', { name: /병역사항/ }))
    expect(statusSelect()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument()
  })
})
