/**
 * 내 정보 「경험」 경량 폼 — **저장소는 활동(`Activity`)** (계획 A′).
 *
 * 🔴 이 spec 이 지키는 것: 이 폼이 만드는 게 `myinfo experiences` 가 아니라 **`POST /activities`**
 *    라는 것, 그리고 그 페이로드에 `applicationSummary`·`country` 계약이 들어간다는 것.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  ── 모드 (경력 · 경험) — 입구가 둘이라 칩 목록·제목이 갈린다 (CEO 2026-09-06)
 *  1-a. 🔴 경력 모드 — 칩은 경력 5종뿐 (「💼 경력」 그룹 하나)
 *  1-b. 🔴 경험 모드 — 칩에 경력 5종이 없고 나머지 10종이 나온다
 *  1-c. 제목 — 「경력 추가」 / 「경력 편집」
 *  1-d. 제목 — 「경험 추가」 / 「경험 편집」
 *  1-e. 🔴 경험 모드 기본 선택은 **칩에 있는 값**(동아리)이다 — 안 고르고 저장해도 경력이 안 된다
 *  1-f. 🔴 첫 칸의 말도 갈린다 — 경력 「경력 정보 · 경력명 · 예: 화장품 브랜드 마케팅 인턴」 /
 *       경험 「활동 정보 · 활동명 · 예: 마케팅 학회」 (CEO 실기 2026-09-06)
 *  2. 이름 칸이 비면 저장 버튼이 비활성 (막다른 저장 시도 자체를 막는다)
 *  3. 🔴 저장 → create 에 계약대로 실린다 (name·type·org·role·기간·outcome·applicationSummary)
 *  4. 빈 선택 칸은 페이로드에 아예 넣지 않는다 (빈 문자열로 덮어쓰지 않는다)
 *  5. 국가는 「해외 경험」에서만 묻고, 그때만 실린다
 *  6. 유형을 바꾸면 국가 칸이 사라지고 값도 안 실린다
 *  7. 지원서용 요약 카운터 — 최대 500, 초과하면 저장 버튼 비활성
 *  8. 종료일이 시작일보다 빠르면 저장하지 않는다
 *  9. 편집 모드 — 기존 값이 채워지고 update 로 나간다 (요약은 비우면 null 로 지운다)
 *  ── 경력 5유형 — 회사·부서·직위·재직 중 (대장 44)
 * 10. 정규직에선 라벨이 회사·직위·직급·담당 업무로 바뀌고 부서·재직 중 칸이 열린다
 * 11. 동아리에선 기관·회사/역할 그대로이고 부서·재직 중이 없다
 * 12. 🔴 재직 중 「예」 → 종료 칸이 사라지고 { orgDepartment, isCurrent: true } 로 실린다 (endedAt 없음)
 * 13. 🔴 경력 모드에는 경력 밖 칩이 없다 — 재직 중이 켜진 채 동아리로 새는 경로 자체가 없다
 * 14. 편집 — 부서·재직 중이 복원되고 update 에도 실린다 (종료일은 보내지 않는다)
 *  ── 오류를 **칸에서** 말한다 (토스트는 5초 뒤 사라진다)
 * 15. 🔴 기간 역전 — 종료 칸 아래 role=alert · 그 칸에 aria-invalid · 포커스가 그 칸으로
 * 16. 고치면 오류 줄이 스스로 사라진다
 * 17. 열자마자는 오류가 없다 (빈 폼에 빨간 글씨를 먼저 띄우지 않는다)
 * 18. 🔴 요약 초과 — 누르기 전에도 role=alert (초과하면 [추가] 가 비활성이라 이유가 보여야 한다)
 * 19. 요약 오류 줄은 textarea 의 aria-describedby 로 이어진다 (도움말 pill 과 함께)
 * 20. 🔴 「담당 업무」 textarea 가 라벨과 이어져 있다 (getByLabelText 로 잡힌다)
 */
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '@/types/activity'
import { ExperienceFormModal, type ExperienceFormMode } from './ExperienceFormModal'

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/hooks/useActivities', () => ({
  useCreateActivity: () => ({ mutateAsync: h.create }),
  useUpdateActivity: () => ({ mutateAsync: h.update }),
}))
vi.mock('@/stores/toastStore', () => ({ toast: { error: h.toastError, show: vi.fn() } }))
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false, useMediaQuery: () => false }))

const BASE: Activity = {
  id: 'a-1',
  userId: 'u-1',
  name: '카카오 하계 인턴',
  type: 'intern',
  org: '카카오',
  role: '백엔드',
  resultUrl: null,
  outcome: '응답 40% 개선',
  startedAt: '2025-07-01',
  endedAt: '2025-08-31',
  archivedAt: null,
  legacyExperienceId: null,
  summaryReflection: null,
  applicationSummary: '요약 원문',
  country: null,
  createdAt: '',
  updatedAt: '',
}

/** 기본은 경력 모드 — 옛 케이스들이 인턴·정규직으로 쓰여 있어 그쪽을 기본으로 둔다 */
const drawAdd = (mode: ExperienceFormMode = 'career') =>
  render(<ExperienceFormModal mode={mode} editing={null} onClose={vi.fn()} />)
const saveBtn = () => screen.getByRole('button', { name: /^(추가|수정)$/ })
/**
 * 첫 칸 — 라벨이 모드마다 다르다 (경력명 / 활동명).
 * 필수 칸이라 접근 이름 뒤에 「필수 입력」이 붙는다 — 그래서 앞부분만 맞춘다.
 */
const nameInput = () => screen.getByLabelText(/^(경력명|활동명)/)
const typeChip = (label: string) => screen.getByRole('button', { name: new RegExp(`^\\S*\\s*${label}$`) })
/**
 * 유형 칩 그룹만 — 바깥 「유형」 그룹 **안**의 묶음들이다.
 * (「재직 중」 토글도 role="group" 이지만 그 바깥에 있어 자연히 빠진다.
 *  이름이 「유형 필수」인 이유는 필수 표시가 sr-only 글자로도 읽히기 때문.)
 */
const typeGroups = () =>
  within(screen.getByRole('group', { name: /^유형/ })).getAllByRole('group')
const chipCount = () =>
  typeGroups().reduce((n, g) => n + within(g).getAllByRole('button').length, 0)

const CAREER_CHIPS = ['인턴', '알바', '정규직', '계약직', '프리랜서']
const EXPERIENCE_CHIPS = [
  '동아리', '스터디', '팀 프로젝트', '사이드 프로젝트',
  '공모전·해커톤', '연구·학술', '해외 경험', '부트캠프·교육', '봉사', '기타',
]

beforeEach(() => {
  h.create.mockReset().mockResolvedValue({})
  h.update.mockReset().mockResolvedValue({})
  h.toastError.mockReset()
})
afterEach(cleanup)

describe('모드 — 경력 입구와 경험 입구는 다른 칩을 준다', () => {
  it('1-a) 🔴 경력 모드 — 「💼 경력」 그룹 하나 · 칩 5개뿐', () => {
    drawAdd('career')
    expect(typeGroups().map((g) => g.getAttribute('aria-label'))).toEqual(['💼 경력'])
    expect(chipCount()).toBe(5)
    for (const label of CAREER_CHIPS) expect(typeChip(label)).toBeInTheDocument()
    for (const label of EXPERIENCE_CHIPS) {
      expect(screen.queryByRole('button', { name: new RegExp(`^\\S*\\s*${label}$`) }), label).toBeNull()
    }
  })

  it('1-b) 🔴 경험 모드 — 경력 5종이 없고 나머지 10종이 나온다', () => {
    drawAdd('experience')
    expect(chipCount()).toBe(10)
    for (const label of EXPERIENCE_CHIPS) expect(typeChip(label)).toBeInTheDocument()
    for (const label of CAREER_CHIPS) {
      expect(screen.queryByRole('button', { name: new RegExp(`^\\S*\\s*${label}$`) }), label).toBeNull()
    }
    expect(typeGroups().map((g) => g.getAttribute('aria-label'))).not.toContain('💼 경력')
  })

  it('1-c) 제목 — 경력 추가 / 경력 편집', () => {
    drawAdd('career')
    expect(screen.getByRole('heading', { name: '경력 추가' })).toBeInTheDocument()
    cleanup()
    render(<ExperienceFormModal mode="career" editing={BASE} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '경력 편집' })).toBeInTheDocument()
  })

  it('1-d) 제목 — 경험 추가 / 경험 편집', () => {
    drawAdd('experience')
    expect(screen.getByRole('heading', { name: '경험 추가' })).toBeInTheDocument()
    cleanup()
    render(<ExperienceFormModal mode="experience" editing={{ ...BASE, type: 'club' }} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '경험 편집' })).toBeInTheDocument()
  })

  it('1-e) 🔴 경험 모드 기본 선택은 칩에 있는 값이다 — 그대로 저장해도 경력이 안 된다', async () => {
    drawAdd('experience')
    expect(typeChip('동아리')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(nameInput(), { target: { value: '이름만' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.create).toHaveBeenCalled())
    expect(h.create).toHaveBeenCalledWith({ name: '이름만', type: 'club' })
  })

  it('1-f) 🔴 첫 칸의 말 — 경력 「경력 정보 · 경력명」 / 경험 「활동 정보 · 활동명」', () => {
    drawAdd('career')
    expect(screen.getByText('경력 정보')).toBeInTheDocument()
    expect(screen.getByLabelText(/^경력명/)).toHaveAttribute('placeholder', '예: 화장품 브랜드 마케팅 인턴')
    expect(screen.queryByText('활동 정보')).toBeNull()
    expect(screen.queryByLabelText(/^활동명/)).toBeNull()

    cleanup()
    drawAdd('experience')
    expect(screen.getByText('활동 정보')).toBeInTheDocument()
    expect(screen.getByLabelText(/^활동명/)).toHaveAttribute('placeholder', '예: 마케팅 학회')
    expect(screen.queryByText('경력 정보')).toBeNull()
    expect(screen.queryByLabelText(/^경력명/)).toBeNull()
  })

})

describe('경험 경량 폼', () => {
  it('이름 칸이 비면 저장 버튼이 비활성', () => {
    drawAdd()
    expect(saveBtn()).toBeDisabled()
  })

  it('🔴 저장 → POST /activities 계약대로 실린다', async () => {
    drawAdd()
    fireEvent.change(nameInput(), { target: { value: '카카오 인턴' } })
    fireEvent.change(screen.getByPlaceholderText('예: 아모레퍼시픽'), { target: { value: '카카오' } })
    // 인턴은 경력 유형이라 역할 칸이 「직위·직급」이다
    fireEvent.change(screen.getByLabelText('직위·직급'), { target: { value: '백엔드' } })
    fireEvent.change(screen.getByPlaceholderText('예: 인스타그램 팔로워 30% 증가'), { target: { value: '지표 개선' } })
    fireEvent.change(screen.getByPlaceholderText(/지원서 활동 칸에 그대로/), { target: { value: '요약 문장' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1))
    expect(h.create).toHaveBeenCalledWith({
      name: '카카오 인턴',
      type: 'intern',
      org: '카카오',
      role: '백엔드',
      outcome: '지표 개선',
      applicationSummary: '요약 문장',
    })
  })

  it('빈 칸은 페이로드에 아예 넣지 않는다', async () => {
    drawAdd()
    fireEvent.change(nameInput(), { target: { value: '이름만' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.create).toHaveBeenCalled())
    expect(h.create).toHaveBeenCalledWith({ name: '이름만', type: 'intern' })
  })

  it('국가는 「해외 경험」에서만 묻고, 그때만 실린다', async () => {
    drawAdd('experience')
    expect(screen.queryByPlaceholderText('예: 미국')).toBeNull()

    fireEvent.click(typeChip('해외 경험'))
    fireEvent.change(nameInput(), { target: { value: '교환학생' } })
    fireEvent.change(screen.getByPlaceholderText('예: 미국'), { target: { value: '독일' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.create).toHaveBeenCalled())
    expect(h.create).toHaveBeenCalledWith({ name: '교환학생', type: 'overseas', country: '독일' })
  })

  it('유형을 되돌리면 국가 칸이 사라지고 값도 안 실린다', async () => {
    drawAdd('experience')
    fireEvent.click(typeChip('해외 경험'))
    fireEvent.change(screen.getByPlaceholderText('예: 미국'), { target: { value: '독일' } })
    fireEvent.click(typeChip('동아리'))
    expect(screen.queryByPlaceholderText('예: 미국')).toBeNull()

    fireEvent.change(nameInput(), { target: { value: '동아리' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.create).toHaveBeenCalled())
    expect(h.create).toHaveBeenCalledWith({ name: '동아리', type: 'club' })
  })

  it('지원서용 요약 — 500자 카운터, 초과하면 저장 버튼이 잠긴다', () => {
    drawAdd()
    fireEvent.change(nameInput(), { target: { value: '이름' } })
    const summary = screen.getByPlaceholderText(/지원서 활동 칸에 그대로/)

    fireEvent.change(summary, { target: { value: '가'.repeat(500) } })
    expect(screen.getByText('500 / 500')).toBeInTheDocument()
    expect(saveBtn()).not.toBeDisabled()

    fireEvent.change(summary, { target: { value: '가'.repeat(501) } })
    expect(screen.getByText('501 / 500')).toBeInTheDocument()
    expect(saveBtn()).toBeDisabled()
  })

  it('종료일이 시작일보다 빠르면 저장하지 않는다', async () => {
    const { container } = drawAdd()
    fireEvent.change(nameInput(), { target: { value: '이름' } })
    const dates = container.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dates[0], { target: { value: '2026-05-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-04-01' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    expect(h.create).not.toHaveBeenCalled()
  })

  it('편집 모드 — 기존 값이 채워지고 update 로 나간다 · 요약을 비우면 null', async () => {
    render(<ExperienceFormModal mode="career" editing={BASE} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('카카오 하계 인턴')).toBeInTheDocument()
    expect(screen.getByDisplayValue('요약 원문')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('요약 원문'), { target: { value: '' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1))
    expect(h.update).toHaveBeenCalledWith({
      name: '카카오 하계 인턴',
      type: 'intern',
      org: '카카오',
      role: '백엔드',
      startedAt: '2025-07-01',
      endedAt: '2025-08-31',
      outcome: '응답 40% 개선',
      applicationSummary: null,
      country: null,
      orgDepartment: null,
      isCurrent: false,
    })
    expect(h.create).not.toHaveBeenCalled()
  })
})

describe('경력 5유형 — 회사·부서·직위·재직 중 (대장 44)', () => {
  const currentToggle = () => screen.getByRole('group', { name: '재직 중' })

  it('10) 정규직에선 라벨이 회사·직위·직급·담당 업무로 바뀌고 부서·재직 중 칸이 열린다', () => {
    drawAdd()
    fireEvent.click(typeChip('정규직'))
    expect(screen.getByLabelText('회사')).toBeInTheDocument()
    expect(screen.getByLabelText('부서')).toBeInTheDocument()
    expect(screen.getByLabelText('직위·직급')).toBeInTheDocument()
    expect(currentToggle()).toBeInTheDocument()
    expect(screen.getByText('담당 업무')).toBeInTheDocument()
    expect(screen.queryByText('지원서용 요약')).toBeNull()
  })

  it('11) 동아리에선 기관·회사/역할 그대로이고 부서·재직 중이 없다', () => {
    drawAdd('experience')
    fireEvent.click(typeChip('동아리'))
    expect(screen.getByLabelText('기관·회사')).toBeInTheDocument()
    expect(screen.getByLabelText('역할')).toBeInTheDocument()
    expect(screen.queryByLabelText('부서')).toBeNull()
    expect(screen.queryByRole('group', { name: '재직 중' })).toBeNull()
    expect(screen.getByText('지원서용 요약')).toBeInTheDocument()
  })

  it('12) 🔴 재직 중 「예」 → 종료 칸이 사라지고 { orgDepartment, isCurrent: true } 로 실린다', async () => {
    drawAdd()
    fireEvent.click(typeChip('정규직'))
    fireEvent.change(nameInput(), { target: { value: '카카오 백엔드' } })
    fireEvent.change(screen.getByLabelText('부서'), { target: { value: '결제플랫폼팀' } })
    expect(screen.getByLabelText('종료')).toBeInTheDocument()

    fireEvent.click(within(currentToggle()).getByRole('button', { name: '예' }))
    expect(screen.queryByLabelText('종료')).toBeNull()
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.create).toHaveBeenCalled())
    expect(h.create).toHaveBeenCalledWith({
      name: '카카오 백엔드', type: 'fulltime', orgDepartment: '결제플랫폼팀', isCurrent: true,
    })
  })

  /**
   * 옛 spec 은 「재직 중을 켠 채 동아리로 바꾸면 부서·재직 중이 안 실린다」를 지켰다.
   * 모드가 갈린 뒤로 그 경로는 **화면에 없다** — 경력 입구에 동아리 칩이 아예 없다.
   * 값을 흘리는 방어는 코드에 남아 있고, 여기서는 새는 입구가 없다는 것을 못 박는다.
   */
  it('13) 🔴 경력 모드에는 경력 밖 칩이 없다 — 재직 중이 켜진 채 새는 경로가 없다', () => {
    drawAdd('career')
    fireEvent.click(typeChip('정규직'))
    fireEvent.click(within(currentToggle()).getByRole('button', { name: '예' }))
    expect(screen.queryByLabelText('종료')).toBeNull()
    expect(screen.queryByRole('button', { name: /^\S*\s*동아리$/ })).toBeNull()
    // 다른 경력 유형으로 옮겨도 재직 중은 그대로다
    fireEvent.click(typeChip('계약직'))
    expect(within(currentToggle()).getByRole('button', { name: '예' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('종료')).toBeNull()
  })

  it('14) 편집 — 부서·재직 중이 복원되고 update 에도 실린다 (종료일은 보내지 않는다)', async () => {
    render(
      <ExperienceFormModal
        mode="career"
        editing={{ ...BASE, type: 'fulltime', orgDepartment: '결제팀', isCurrent: true, endedAt: null }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('부서')).toHaveValue('결제팀')
    expect(within(currentToggle()).getByRole('button', { name: '예' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('종료')).toBeNull()
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.update).toHaveBeenCalledTimes(1))
    const dto = h.update.mock.calls[0][0]
    expect(dto).toMatchObject({ type: 'fulltime', orgDepartment: '결제팀', isCurrent: true })
    expect(dto.endedAt).toBeUndefined()
  })
})

/**
 * 🔴 토스트만으로는 **어느 칸이 문제인지** 알 수 없다 — 5초 뒤 사라지고, 칸이 열두 개인 폼에서
 * 사용자는 처음부터 다시 읽는다. 오류는 그 칸 아래에 남고 포커스도 그 칸으로 간다.
 */
describe('오류를 칸에서 말한다', () => {
  const summaryBox = () => screen.getByPlaceholderText(/지원서 활동 칸에 그대로/)
  /** 기간 역전을 만든다 — 종료가 시작보다 빠르다 */
  function makeInverted(container: HTMLElement) {
    fireEvent.change(nameInput(), { target: { value: '이름' } })
    const dates = container.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dates[0], { target: { value: '2026-05-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-04-01' } })
    return dates
  }

  it('15) 🔴 기간 역전 — 종료 칸 아래 alert · aria-invalid · 그 칸으로 포커스', async () => {
    const { container } = drawAdd()
    const dates = makeInverted(container)
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('종료일은 시작일 이후여야 해요.')
    expect(dates[1]).toHaveAttribute('aria-invalid', 'true')
    expect(dates[1]).toHaveAttribute('aria-describedby', alert.id)
    expect(dates[1]).toHaveFocus()
    expect(h.create).not.toHaveBeenCalled()
  })

  it('16) 고치면 오류 줄이 스스로 사라진다', async () => {
    const { container } = drawAdd()
    const dates = makeInverted(container)
    fireEvent.click(saveBtn())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.change(dates[1], { target: { value: '2026-06-01' } })
    expect(screen.queryByRole('alert')).toBeNull()
    // 「검증에 걸리지 않았다」를 값으로 말한다 (속성을 지우는 게 아니라 false 로 둔다)
    expect(dates[1]).toHaveAttribute('aria-invalid', 'false')
  })

  it('17) 열자마자는 오류가 없다 — 빈 폼에 빨간 글씨를 먼저 띄우지 않는다', () => {
    drawAdd()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(nameInput()).toHaveAttribute('aria-invalid', 'false')
  })

  it('18) 🔴 요약 초과 — 누르기 전에도 alert (초과하면 [추가] 가 잠기니 이유가 보여야 한다)', () => {
    drawAdd()
    fireEvent.change(summaryBox(), { target: { value: '가'.repeat(501) } })

    expect(screen.getByRole('alert')).toHaveTextContent('담당 업무은 500자까지예요.')
    expect(summaryBox()).toHaveAttribute('aria-invalid', 'true')
    expect(saveBtn()).toBeDisabled()
  })

  it('19) 요약 오류 줄이 textarea 의 aria-describedby 에 도움말과 함께 들어간다', () => {
    drawAdd()
    const helpOnly = summaryBox().getAttribute('aria-describedby')
    expect(helpOnly).toBeTruthy()

    fireEvent.change(summaryBox(), { target: { value: '가'.repeat(501) } })
    const ids = summaryBox().getAttribute('aria-describedby')?.split(' ') ?? []
    expect(ids).toContain(screen.getByRole('alert').id)
    expect(ids).toContain(helpOnly)
  })

  it('20) 🔴 「담당 업무」 textarea 가 라벨과 이어져 있다', () => {
    drawAdd()
    expect(screen.getByLabelText('담당 업무')).toBe(summaryBox())
  })
})
