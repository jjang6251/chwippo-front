/**
 * 「우대·기타」 — 보훈 조건부 펼침 · **장애 민감정보 동의 게이트** · 추가 정보 동적 렌더.
 *
 * 🔴 이 spec 의 심장은 **동의 게이트**다. 동의 전에는 장애 칸이 렌더조차 되지 않아야 하고,
 *    동의 후 저장에는 `sensitive_consent: true` 가 **반드시** 실려야 한다 (빠지면 백엔드 400).
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  ── 보훈
 *   1. 🔴 저장 전에는 **아무것도 안 눌려 있고** 「한 번 눌러 확인」 안내가 보인다
 *   1-a. 「비대상」이 저장돼 있으면 그게 눌리고 안내는 「여기서 끝」으로 바뀐다
 *   2. 비대상일 땐 번호·관계·비율 칸이 없다
 *   3. 「대상」 클릭 → patriot_yn: true 저장 + 칸 3개 펼침
 *   4. 관계·비율 클릭 → 코드값/숫자로 저장 (라벨이 아니라)
 *   5. 번호는 blur 에 저장, 비우면 null
 *  ── 장애 (민감정보)
 *   6. 🔴 동의 전에는 장애 칸이 하나도 없다 → 저장 경로 자체가 없다
 *   7. 동의 카드에 5요소(항목·목적·보유기간·거부권·거부 시 불이익)가 다 있다
 *   8. 고정 문장 「이 정보는 AI 에 전달되지 않습니다.」 노출
 *   9. [동의] → sensitive_consent: true 저장 + 칸 열림
 *   9-a. 동의가 있어도 장애 여부를 저장하기 전엔 아무것도 안 눌려 있다
 *  10. 🔴 동의 후 장애 값 저장에 sensitive_consent 가 같이 실린다
 *  11. [동의하지 않음] → 칸이 안 열리고 아무것도 저장되지 않는다
 *  12. 서버에 sensitive_consent_at 이 이미 있으면 동의 카드 없이 바로 열린다
 *  ── 장애 동의 철회 (동의 카드가 약속한 「철회 시 즉시 삭제」의 실행 경로)
 *  18. 동의 전에는 「동의 철회」가 없다 (철회할 게 없다)
 *  19. 동의 후에는 「동의 철회」가 보인다
 *  20. 클릭 → 확인 모달 문구가 뜨고 아직 아무것도 저장하지 않는다
 *  21. 🔴 확인 → body 가 **정확히** { sensitive_consent: false } — 민감 필드를 동봉하지 않는다
 *  22. 성공 → 카드가 동의 전 상태로 돌아가고 지운 값이 되살아나지 않는다
 *  23. 취소 → 아무 요청도 나가지 않는다
 *  ── 추가 정보 (필드 사전)
 *  13. storage:'extra' 항목만 그린다 (column 은 제외)
 *  14. sensitive·forbidden 항목은 그리지 않는다
 *  15. 타입별 렌더 — text · select · date · bool
 *  16. 저장은 PATCH extra-fields, 빈 값은 null
 *  17. 사전 호출이 실패하면 블록이 통째로 사라진다 (페이지는 살아 있다)
 *  ── 게이지 칩 → 그 토글로 (focus)
 *  24. focus="patriot" → 보훈 토글로 스크롤하고 첫 버튼에 포커스
 *  25. focus="disability" — 동의 전이면 동의 카드의 [동의] 에 선다
 *  26. 같은 칩을 다시 누르면(seq 증가) 다시 움직인다
 *  ── 미선택은 미선택으로 (보훈 여부에서 고친 규칙을 나머지 토글에도)
 *  27. 🔴 관계·가점 비율 — 「대상」 직후엔 아무것도 안 눌려 있다 (「본인」·「0%」 아님)
 *  28. 저장된 값이 있으면 그게 눌린다 (회귀 방어)
 *  29. 🔴 장애 정도 — 「대상」 직후엔 아무것도 안 눌려 있다 (「심하지 않은 장애」 아님)
 *  30. 🔴 추가 정보 예/아니오 — 값이 없으면 「아니오」가 미리 눌리지 않는다
 *  31. 저장된 「false」 는 「아니오」로 눌려 보인다 (미선택과 구분된다)
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { FieldDictionary, UserProfile } from '@/api/myinfo'
import { ExtrasSectionBody } from './ExtrasSection'

const h = vi.hoisted(() => ({
  profile: {} as Partial<UserProfile>,
  updateProfile: vi.fn(),
  updateExtra: vi.fn(),
  dictionary: undefined as FieldDictionary | undefined,
  dictError: false,
}))

vi.mock('@/hooks/useMyinfo', () => ({
  useProfile: () => ({ data: h.profile }),
  useUpdateProfile: () => ({ mutate: h.updateProfile, isPending: false }),
  useFieldDictionary: () => ({ data: h.dictionary, isError: h.dictError }),
  useUpdateExtraFields: () => ({ mutate: h.updateExtra }),
}))
vi.mock('@/stores/toastStore', () => ({ toast: { error: vi.fn(), show: vi.fn() } }))

const draw = (props: Partial<ComponentProps<typeof ExtrasSectionBody>> = {}) =>
  render(<ExtrasSectionBody onSaved={vi.fn()} {...props} />)
/** mutate 에 실린 dto (첫 인자) */
const lastProfileDto = () => h.updateProfile.mock.calls.at(-1)?.[0]
const lastExtraDto = () => h.updateExtra.mock.calls.at(-1)?.[0]

beforeEach(() => {
  h.profile = { user_id: 'u1' }
  h.dictionary = undefined
  h.dictError = false
  h.updateProfile.mockReset()
  h.updateExtra.mockReset()
  // jsdom 에는 스크롤이 없다 — 칩 포커스 effect 가 부른다
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('보훈', () => {
  it('🔴 저장 전에는 아무것도 눌려 있지 않고 「한 번 눌러 확인」 안내가 보인다', () => {
    draw()
    const group = screen.getByRole('group', { name: '보훈 대상 여부' })
    expect(group.querySelector('[aria-pressed="true"]')).toBeNull()
    expect(screen.getByText('한 번 눌러 확인해 주세요 — 비대상이면 그대로 끝이에요')).toBeInTheDocument()
  })

  it('「비대상」이 저장돼 있으면 그게 눌려 있고 안내는 「여기서 끝」으로 바뀐다', () => {
    h.profile = { user_id: 'u1', patriot_yn: false }
    draw()
    const group = screen.getByRole('group', { name: '보훈 대상 여부' })
    expect(group.querySelector('[aria-pressed="true"]')?.textContent).toBe('비대상')
    expect(screen.queryByText(/한 번 눌러 확인해 주세요/)).toBeNull()
    expect(screen.getByText(/비대상이면 여기서 끝이에요/)).toBeInTheDocument()
  })

  it('비대상일 땐 번호·관계·비율 칸이 없다', () => {
    draw()
    expect(screen.queryByLabelText(/보훈 번호/)).toBeNull()
    expect(screen.queryByRole('group', { name: '보훈 대상과의 관계' })).toBeNull()
    expect(screen.queryByRole('group', { name: '보훈 가점 비율' })).toBeNull()
  })

  it('「대상」 → patriot_yn: true 저장 + 칸 3개 펼침', () => {
    draw()
    const group = screen.getByRole('group', { name: '보훈 대상 여부' })
    fireEvent.click(within(group, '대상'))
    expect(lastProfileDto()).toEqual({ patriot_yn: true })
    expect(screen.getByRole('group', { name: '보훈 대상과의 관계' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '보훈 가점 비율' })).toBeInTheDocument()
  })

  it('관계·비율은 코드값/숫자로 저장한다 (라벨이 아니라)', () => {
    h.profile = { user_id: 'u1', patriot_yn: true }
    draw()
    fireEvent.click(within(screen.getByRole('group', { name: '보훈 대상과의 관계' }), '유족'))
    expect(lastProfileDto()).toEqual({ patriot_relation: 'bereaved' })

    fireEvent.click(within(screen.getByRole('group', { name: '보훈 가점 비율' }), '10%'))
    expect(lastProfileDto()).toEqual({ patriot_rate: 10 })
  })

  it('보훈 번호는 blur 에 저장하고, 비우면 null 로 보낸다', () => {
    h.profile = { user_id: 'u1', patriot_yn: true, patriot_number: 'A-1' }
    draw()
    const input = screen.getByDisplayValue('A-1')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(lastProfileDto()).toEqual({ patriot_number: null })
  })
})

describe('장애 — 민감정보 동의 게이트', () => {
  it('🔴 동의 전에는 장애 칸이 하나도 없다 (저장 경로 자체가 없다)', () => {
    draw()
    expect(screen.queryByRole('group', { name: '장애 여부' })).toBeNull()
    expect(screen.queryByRole('group', { name: '장애 정도' })).toBeNull()
    expect(screen.queryByLabelText(/장애 유형/)).toBeNull()
    expect(screen.queryByLabelText(/장애인 등록번호/)).toBeNull()
  })

  it('동의 카드에 5요소가 모두 있다', () => {
    draw()
    for (const term of ['수집 항목', '이용 목적', '보유 기간', '거부할 권리', '거부 시 불이익']) {
      expect(screen.getByText(term)).toBeInTheDocument()
    }
  })

  it('고정 문장 「이 정보는 AI 에 전달되지 않습니다.」 가 보인다', () => {
    draw()
    expect(screen.getByText(/이 정보는 AI 에 전달되지 않습니다\./)).toBeInTheDocument()
  })

  it('[동의] → sensitive_consent: true 를 저장하고 칸이 열린다', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: '동의' }))
    expect(lastProfileDto()).toEqual({ sensitive_consent: true })
    expect(screen.getByRole('group', { name: '장애 여부' })).toBeInTheDocument()
  })

  it('🔴 동의 후 장애 값 저장에 sensitive_consent 가 같이 실린다', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: '동의' }))
    fireEvent.click(within(screen.getByRole('group', { name: '장애 여부' }), '대상'))
    expect(lastProfileDto()).toEqual({ disability_yn: true, sensitive_consent: true })

    fireEvent.click(within(screen.getByRole('group', { name: '장애 정도' }), '심한 장애'))
    expect(lastProfileDto()).toEqual({ disability_grade: 'severe', sensitive_consent: true })
  })

  it('[동의하지 않음] → 칸이 안 열리고 아무것도 저장하지 않는다', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: /동의하지 않음/ }))
    expect(h.updateProfile).not.toHaveBeenCalled()
    expect(screen.queryByRole('group', { name: '장애 여부' })).toBeNull()
    // 마음이 바뀌면 다시 볼 수 있어야 한다
    fireEvent.click(screen.getByRole('button', { name: '동의 안내 다시 보기' }))
    expect(screen.getByRole('button', { name: '동의' })).toBeInTheDocument()
  })

  it('서버에 동의 기록이 있으면 카드 없이 바로 열린다', () => {
    h.profile = { user_id: 'u1', sensitive_consent_at: '2026-09-05T00:00:00Z' }
    draw()
    expect(screen.queryByRole('button', { name: '동의' })).toBeNull()
    expect(screen.getByRole('group', { name: '장애 여부' })).toBeInTheDocument()
  })

  it('동의가 있어도 장애 여부를 저장하기 전엔 아무것도 눌려 있지 않다', () => {
    h.profile = { user_id: 'u1', sensitive_consent_at: '2026-09-05T00:00:00Z' }
    draw()
    const group = screen.getByRole('group', { name: '장애 여부' })
    expect(group.querySelector('[aria-pressed="true"]')).toBeNull()
  })
})

describe('장애 — 민감정보 동의 철회', () => {
  /** 서버에 동의 기록 + 장애 4필드가 저장된 상태 (철회의 실제 출발점) */
  const consentedProfile: Partial<UserProfile> = {
    user_id: 'u1',
    sensitive_consent_at: '2026-09-05T00:00:00Z',
    disability_yn: true,
    disability_grade: 'severe',
    disability_type: '지체',
    disability_number: 'D-1',
  }

  it('18. 동의 전에는 「동의 철회」가 없다', () => {
    draw()
    expect(screen.queryByRole('button', { name: '동의 철회' })).toBeNull()
  })

  it('19. 동의 후에는 「동의 철회」가 보인다', () => {
    h.profile = consentedProfile
    draw()
    expect(screen.getByRole('button', { name: '동의 철회' })).toBeInTheDocument()
  })

  it('20. 클릭 → 확인 모달 문구가 뜨고, 아직 아무것도 저장하지 않는다', () => {
    h.profile = consentedProfile
    draw()
    fireEvent.click(screen.getByRole('button', { name: '동의 철회' }))
    expect(screen.getByText('민감정보 동의를 철회할까요?')).toBeInTheDocument()
    expect(
      screen.getByText('저장된 장애 정보가 즉시 삭제돼요. 다시 입력하려면 동의가 다시 필요해요.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '철회하고 삭제' })).toBeInTheDocument()
    expect(h.updateProfile).not.toHaveBeenCalled()
  })

  it('21. 🔴 확인 → body 는 정확히 { sensitive_consent: false } — 민감 필드를 같이 보내지 않는다', () => {
    h.profile = consentedProfile
    draw()
    fireEvent.click(screen.getByRole('button', { name: '동의 철회' }))
    fireEvent.click(screen.getByRole('button', { name: '철회하고 삭제' }))
    // 같은 요청에 민감 필드가 섞이면 백엔드가 400 으로 막는다
    expect(lastProfileDto()).toEqual({ sensitive_consent: false })
  })

  it('22. 성공 → 카드가 동의 전 상태로 돌아가고, 지운 값이 되살아나지 않는다', () => {
    h.updateProfile.mockImplementation((_dto, opts) => opts?.onSuccess?.())
    h.profile = consentedProfile
    draw()
    fireEvent.click(screen.getByRole('button', { name: '동의 철회' }))
    fireEvent.click(screen.getByRole('button', { name: '철회하고 삭제' }))

    // 캐시의 sensitive_consent_at 이 아직 옛 값이어도 즉시 닫힌다
    expect(screen.getByRole('button', { name: '동의' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '장애 여부' })).toBeNull()
    expect(screen.queryByRole('button', { name: '동의 철회' })).toBeNull()

    // 다시 동의해도 방금 지운 값이 로컬에 남아 있으면 안 된다 — 서버가 지웠으니 **미선택**이다
    fireEvent.click(screen.getByRole('button', { name: '동의' }))
    const group = screen.getByRole('group', { name: '장애 여부' })
    expect(group.querySelector('[aria-pressed="true"]')).toBeNull()
  })

  it('23. 취소 → 아무 요청도 나가지 않는다', () => {
    h.profile = consentedProfile
    draw()
    fireEvent.click(screen.getByRole('button', { name: '동의 철회' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(h.updateProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: '장애 여부' })).toBeInTheDocument()
  })
})

describe('추가 정보 — 필드 사전 동적 렌더', () => {
  const dict: FieldDictionary = {
    version: '2026-09.1',
    fields: [
      { key: 'hobby', label: '취미', type: 'text', maxLength: 40, storage: 'extra' },
      { key: 'apply_route', label: '지원 경로', type: 'select', options: ['취업카페', '학교'], storage: 'extra' },
      { key: 'available_from', label: '입사 가능일', type: 'date', storage: 'extra' },
      { key: 'relocatable', label: '지방 근무 가능', type: 'bool', storage: 'extra' },
      { key: 'name', label: '이름', type: 'text', storage: 'column' },
      { key: 'disability_number', label: '장애인 등록번호', type: 'text', storage: 'extra', sensitive: true },
      { key: 'rrn', label: '주민등록번호', type: 'text', storage: 'extra', forbidden: true },
    ],
  }

  it("storage:'extra' 항목만 그린다 — column 은 여기 없다", () => {
    h.dictionary = dict
    draw()
    expect(screen.getByText('취미')).toBeInTheDocument()
    // 「이름」은 기본 인적사항의 정식 칸이라 여기서 또 그리면 안 된다
    expect(screen.queryByText('이름')).toBeNull()
  })

  it('🔴 sensitive·forbidden 항목은 슬롯에 그리지 않는다', () => {
    h.dictionary = dict
    draw()
    expect(screen.queryByText('장애인 등록번호')).toBeNull()
    expect(screen.queryByText('주민등록번호')).toBeNull()
  })

  it('타입별로 그린다 — text · select · date · bool', () => {
    h.dictionary = dict
    h.profile = { user_id: 'u1', extra_fields: { hobby: '등산' } }
    const { container } = draw()
    expect(screen.getByDisplayValue('등산')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '취업카페' })).toBeInTheDocument()
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '지방 근무 가능' })).toBeInTheDocument()
  })

  it('저장은 extra-fields PATCH — 빈 값은 null', () => {
    h.dictionary = dict
    h.profile = { user_id: 'u1', extra_fields: { hobby: '등산' } }
    draw()

    const hobby = screen.getByDisplayValue('등산')
    fireEvent.change(hobby, { target: { value: '독서' } })
    fireEvent.blur(hobby)
    expect(lastExtraDto()).toEqual({ hobby: '독서' })

    fireEvent.change(hobby, { target: { value: '   ' } })
    fireEvent.blur(hobby)
    expect(lastExtraDto()).toEqual({ hobby: null })
  })

  it('bool 은 문자열 true/false 로 저장한다', () => {
    h.dictionary = dict
    draw()
    fireEvent.click(within(screen.getByRole('group', { name: '지방 근무 가능' }), '예'))
    expect(lastExtraDto()).toEqual({ relocatable: 'true' })
  })

  it('사전 호출이 실패하면 블록이 통째로 사라진다 (페이지는 산다)', () => {
    h.dictError = true
    draw()
    expect(screen.queryByText('추가 정보')).toBeNull()
    // 보훈 섹션은 그대로 살아 있어야 한다
    expect(screen.getByRole('group', { name: '보훈 대상 여부' })).toBeInTheDocument()
  })

  it('사전에 extra 항목이 없으면 블록을 그리지 않는다', () => {
    h.dictionary = { version: 'v', fields: [{ key: 'name', label: '이름', type: 'text', storage: 'column' }] }
    draw()
    expect(screen.queryByText('추가 정보')).toBeNull()
  })
})

describe('게이지 칩 → 그 토글로 (focus)', () => {
  it('focus="patriot" → 보훈 토글로 스크롤하고 첫 버튼에 포커스한다', () => {
    draw({ focus: 'patriot', focusSeq: 1 })
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    const group = screen.getByRole('group', { name: '보훈 대상 여부' })
    expect(group.querySelector('button')).toHaveFocus()
  })

  it('focus="disability" — 동의 전이면 동의 카드의 [동의] 에 선다', () => {
    draw({ focus: 'disability', focusSeq: 1 })
    expect(screen.getByRole('button', { name: '동의' })).toHaveFocus()
  })

  it('같은 칩을 다시 누르면(seq 증가) 다시 움직인다', () => {
    const view = draw({ focus: 'patriot', focusSeq: 1 })
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    view.rerender(<ExtrasSectionBody onSaved={vi.fn()} focus="patriot" focusSeq={2} />)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('지시가 없으면 움직이지 않는다', () => {
    draw()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })
})

/**
 * 🔴 「본인」·「0%」·「심하지 않은 장애」·「아니오」가 **저장 전부터 눌려 보이면** 사용자는
 * 이미 답한 줄 알고 넘어간다. 그런데 서버에는 값이 없다 — 보훈 여부에서 이미 고친 규칙을
 * 나머지 토글에도 그대로 적용한다.
 */
describe('미선택은 미선택으로', () => {
  /** 그 group 안에 눌린 버튼이 하나도 없다 */
  const nothingPressed = (name: string) =>
    expect(screen.getByRole('group', { name }).querySelector('[aria-pressed="true"]')).toBeNull()

  it('🔴 관계·가점 비율 — 「대상」을 켠 직후엔 아무것도 안 눌려 있다', () => {
    h.profile = { user_id: 'u1', patriot_yn: true }
    draw()
    nothingPressed('보훈 대상과의 관계')
    nothingPressed('보훈 가점 비율')
  })

  it('저장된 값이 있으면 그게 눌린다 (회귀 방어)', () => {
    h.profile = { user_id: 'u1', patriot_yn: true, patriot_relation: 'bereaved', patriot_rate: 10 }
    draw()
    expect(within(screen.getByRole('group', { name: '보훈 대상과의 관계' }), '유족'))
      .toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: '보훈 가점 비율' }), '10%'))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('🔴 장애 정도 — 「대상」을 켠 직후엔 아무것도 안 눌려 있다', () => {
    h.profile = { user_id: 'u1', sensitive_consent_at: '2026-09-01T00:00:00Z', disability_yn: true }
    draw()
    nothingPressed('장애 정도')
  })

  it('🔴 추가 정보 예/아니오 — 저장된 값이 없으면 「아니오」가 미리 눌리지 않는다', () => {
    h.dictionary = {
      version: '2026-09.1',
      fields: [{ key: 'relocatable', label: '지방 근무 가능', type: 'bool', storage: 'extra' }],
    }
    draw()
    nothingPressed('지방 근무 가능')

    // 눌러야 저장되고, 그때부터 눌린 상태가 된다
    fireEvent.click(within(screen.getByRole('group', { name: '지방 근무 가능' }), '아니오'))
    expect(lastExtraDto()).toEqual({ relocatable: 'false' })
    expect(within(screen.getByRole('group', { name: '지방 근무 가능' }), '아니오'))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('저장된 「false」 는 「아니오」로 눌려 보인다 (미선택과 구분된다)', () => {
    h.dictionary = {
      version: '2026-09.1',
      fields: [{ key: 'relocatable', label: '지방 근무 가능', type: 'bool', storage: 'extra' }],
    }
    h.profile = { user_id: 'u1', extra_fields: { relocatable: 'false' } }
    draw()
    expect(within(screen.getByRole('group', { name: '지방 근무 가능' }), '아니오'))
      .toHaveAttribute('aria-pressed', 'true')
  })
})

/** group 안에서 라벨로 버튼 찾기 — 같은 라벨(「대상」)이 여러 group 에 있어서 범위를 좁힌다 */
function within(group: HTMLElement, label: string): HTMLElement {
  const found = [...group.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!found) throw new Error(`버튼을 찾지 못함: ${label}`)
  return found
}
