/**
 * 「우대·기타」 — 보훈 조건부 펼침 · **장애 민감정보 동의 게이트**.
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
 *  ── 「추가 정보」 삭제 (취미·특기 등 — 지원서가 거의 안 묻는 칸이라 뺐다)
 *  13. 🔴 사전에 extra 항목이 와도 이 섹션은 그리지 않는다 (블록·제목·저장 경로 전부 없다)
 *  ── 게이지 칩 → 그 토글로 (focus)
 *  24. focus="patriot" → 보훈 토글로 스크롤하고 첫 버튼에 포커스
 *  25. focus="disability" — 동의 전이면 동의 카드의 [동의] 에 선다
 *  26. 같은 칩을 다시 누르면(seq 증가) 다시 움직인다
 *  ── 미선택은 미선택으로 (보훈 여부에서 고친 규칙을 나머지 토글에도)
 *  27. 🔴 관계·가점 비율 — 「대상」 직후엔 아무것도 안 눌려 있다 (「본인」·「0%」 아님)
 *  28. 저장된 값이 있으면 그게 눌린다 (회귀 방어)
 *  29. 🔴 장애 정도 — 「대상」 직후엔 아무것도 안 눌려 있다 (「심하지 않은 장애」 아님)
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

/**
 * 🔴 옛 「추가 정보」 블록(취미·특기·입사 가능 시기·희망 근무 지역·비자·회화 수준)을 없앴다.
 * 사전은 여전히 `storage:'extra'` 항목을 줄 수 있다 — 우대·기타는 **그걸 더 이상 보지 않는다**
 * (extra 자리는 이제 대학원 4키가 쓰고, 그건 「논문」 섹션의 몫이다).
 */
describe('「추가 정보」 삭제', () => {
  it("13) 🔴 사전에 storage:'extra' 항목이 와도 이 섹션은 아무것도 그리지 않는다", () => {
    h.dictionary = {
      version: '2026-09.1',
      fields: [
        { key: 'hobby', label: '취미', type: 'text', maxLength: 40, storage: 'extra' },
        { key: 'preferred_region', label: '희망 근무 지역', type: 'select', options: ['서울'], storage: 'extra' },
        { key: 'academic_advisor', label: '지도교수', type: 'text', maxLength: 40, storage: 'extra' },
      ],
    }
    h.profile = { user_id: 'u1', extra_fields: { hobby: '등산' } }
    draw()

    expect(screen.queryByText('추가 정보')).toBeNull()
    expect(screen.queryByText('취미')).toBeNull()
    expect(screen.queryByText('희망 근무 지역')).toBeNull()
    expect(screen.queryByText('지도교수')).toBeNull()
    expect(screen.queryByDisplayValue('등산')).toBeNull()
    // 보훈·장애는 그대로 살아 있다
    expect(screen.getByRole('group', { name: '보훈 대상 여부' })).toBeInTheDocument()
  })

  it('13-a) 저장 경로도 없다 — extra-fields PATCH 가 나갈 자리가 없다', () => {
    h.dictionary = {
      version: '2026-09.1',
      fields: [{ key: 'hobby', label: '취미', type: 'text', maxLength: 40, storage: 'extra' }],
    }
    draw()
    fireEvent.click(within(screen.getByRole('group', { name: '보훈 대상 여부' }), '비대상'))
    expect(h.updateExtra).not.toHaveBeenCalled()
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

})

/** group 안에서 라벨로 버튼 찾기 — 같은 라벨(「대상」)이 여러 group 에 있어서 범위를 좁힌다 */
function within(group: HTMLElement, label: string): HTMLElement {
  const found = [...group.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!found) throw new Error(`버튼을 찾지 못함: ${label}`)
  return found
}
