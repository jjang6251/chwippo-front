/**
 * 학력 모달 — 지원서 실측으로 늘어난 칸(본/분교 · 주야 · 입학구분 · 총이수학점 · 검정고시)
 * 과 재학 기간 보조 칩.
 *
 * 근거: 지원서 8/11 이 이 칸들을 묻는다 (`autofill-census-2026-09.md` 최종 갭 목록 🟠 학력 확장).
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 대학교 — 본/분교·주야·입학구분 세그먼트가 나오고 기본값은 본교·주간·입학
 *  2. 🔴 고등학교로 바꾸면 그 셋이 사라지고 **검정고시 체크박스**가 나온다
 *  3. 총 이수 학점은 대학 이상에서만 묻는다
 *  4. 저장 페이로드에 새 칸이 계약대로 실린다 (총이수학점은 숫자)
 *  5. 🔴 검정고시는 고등학교에서만 true 로 나간다 (다른 단계면 false 로 잘린다)
 *  6. 총 이수 학점이 숫자가 아니면 저장하지 않는다
 *  7. 기간 칩 「+1학기」 → 입학일 + 6개월이 졸업일에 채워진다
 *  8. 학점 옆 만점 기준 도움말이 있다
 *  9. 편집 모드 — 저장된 새 칸이 그대로 복원된다
 *  ── 증빙 파일 2칸 (CEO 2026-09-05)
 * 10. 「성적증명서」·「졸업(예정)증명서」 두 칸이 나온다
 * 11. 🔴 각 칸의 첨부가 **제 필드로** 실린다 (transcript_* / graduation_*)
 * 12. 아무것도 안 붙이면 두 칸 다 null 로 나간다
 * 13. 옛 `file_url` 이 있으면 「기타 증빙(구분 없음)」이 읽기 전용으로 보인다
 * 14. 🔴 옛 증빙 삭제 → body 의 `file_url` 이 빈 문자열 (백엔드 EmptyToNull)
 * 15. 옛 `file_url` 이 없으면 「기타 증빙」 자리 자체가 없다
 *  ── 계열 · 해외 학교 · 라벨 · 단계 프리셋 (대장 44)
 * 16. 🔴 「계열」은 고등학교에서만 묻고 코드값(track)으로 실린다
 * 17. 대학교로 되돌리면 계열은 실리지 않는다
 * 18. 🔴 「해외 학교」 예 → 국가 칸이 열리고 country 로 실린다 · 아니오면 비운다
 * 19. 편집 — country 가 있으면 해외 학교가 켜진 채 열린다
 * 20. 증명서 라벨은 「재학·졸업(예정)증명서」
 * 21. 🔴 단계 프리셋 — `initialDegree` 로 열면 학교 단계가 미리 골라져 있다 (고등학교는 만점 5.0)
 */
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Education } from '@/api/myinfo'
import type { FileSlot } from '@/utils/fileSlot'
import { EducationModal } from './EducationModal'

const h = vi.hoisted(() => ({ toastError: vi.fn(), resolveFileForSubmit: vi.fn() }))
vi.mock('@/stores/toastStore', () => ({ toast: { error: h.toastError, show: vi.fn() } }))
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false, useMediaQuery: () => false }))
vi.mock('./SchoolAutocomplete', () => ({
  SchoolAutocomplete: ({ value, onChange, inputClassName }: {
    value: string; onChange: (v: string) => void; inputClassName?: string
  }) => (
    <input
      aria-label="학교명"
      className={inputClassName}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))
vi.mock('./MajorAutocomplete', () => ({
  MajorAutocomplete: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="전공" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))
/** 실제 업로드 UI 대신 「파일을 골랐다」만 흉내낸다 — 감싸는 라벨은 모달 쪽에 있다 */
vi.mock('./FileUpload', () => ({
  FileUpload: ({ slot, onChange }: { slot: FileSlot; onChange: (s: FileSlot) => void }) => (
    <button
      type="button"
      onClick={() => onChange({ kind: 'pending', file: new File(['x'], 'proof.pdf', { type: 'application/pdf' }) })}
    >
      {slot.kind === 'empty' ? '파일 첨부' : '파일 교체'}
    </button>
  ),
}))
vi.mock('@/utils/fileSlot', () => ({
  EMPTY_SLOT: { kind: 'empty' },
  slotFromExisting: (url?: string | null, size?: number | null): FileSlot =>
    url ? { kind: 'existing', url, size: size ?? null } : { kind: 'empty' },
  resolveFileForSubmit: h.resolveFileForSubmit,
}))

function draw(initial: Education | null = null, initialDegree?: string) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const view = render(
    <EducationModal initial={initial} initialDegree={initialDegree} onClose={vi.fn()} onSave={onSave} />,
  )
  return { ...view, onSave }
}

const degreeSelect = () => screen.getByRole('combobox', { name: '학교 단계' })
/** 「추가」는 복수전공 칩에도 있다 — 저장 버튼은 푸터(마지막)다 */
const saveBtn = () => {
  const all = screen.getAllByRole('button', { name: /^(추가|수정)$/ })
  return all[all.length - 1]
}
function chip(groupName: string, label: string): HTMLElement {
  const group = screen.getByRole('group', { name: groupName })
  const found = [...group.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!found) throw new Error(`칩을 찾지 못함: ${groupName}/${label}`)
  return found
}

/** 증빙 칸 — 「성적증명서」/「졸업(예정)증명서」 라벨로 감싼 묶음 */
const proofGroup = (label: string) => screen.getByRole('group', { name: label })

beforeEach(() => {
  h.toastError.mockReset()
  // 기본은 「아무것도 안 붙였다」 — 붙이는 케이스만 테스트에서 덮는다
  h.resolveFileForSubmit.mockReset().mockResolvedValue({ file_url: null, file_size_bytes: null })
})
afterEach(cleanup)

describe('학력 모달 — 지원서 실측 칸', () => {
  it('대학교 — 본/분교·주야·입학구분이 나오고 기본은 본교·주간·입학', () => {
    draw()
    expect(chip('캠퍼스', '본교')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('주·야간', '주간')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('입학 구분', '입학')).toHaveAttribute('aria-pressed', 'true')
  })

  it('🔴 고등학교로 바꾸면 셋이 사라지고 검정고시 체크박스가 나온다', () => {
    draw()
    fireEvent.change(degreeSelect(), { target: { value: '고등학교' } })
    expect(screen.queryByRole('group', { name: '캠퍼스' })).toBeNull()
    expect(screen.queryByRole('group', { name: '주·야간' })).toBeNull()
    expect(screen.queryByRole('group', { name: '입학 구분' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: '검정고시' })).toBeInTheDocument()
  })

  it('총 이수 학점은 대학 이상에서만 묻는다', () => {
    draw()
    expect(screen.getByLabelText('총 이수 학점')).toBeInTheDocument()
    fireEvent.change(degreeSelect(), { target: { value: '고등학교' } })
    expect(screen.queryByLabelText('총 이수 학점')).toBeNull()
  })

  it('🔴 저장 페이로드에 새 칸이 계약대로 실린다 (학점은 숫자)', async () => {
    const { onSave } = draw()
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: '서울대학교' } })
    fireEvent.click(chip('캠퍼스', '분교'))
    fireEvent.click(chip('주·야간', '야간'))
    fireEvent.click(chip('입학 구분', '타교 편입'))
    fireEvent.change(screen.getByLabelText('총 이수 학점'), { target: { value: '130' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      school_name: '서울대학교',
      campus_type: 'branch',
      day_night: 'night',
      admission_type: 'transfer_other',
      total_credits: 130,
      is_ged: false,
    })
  })

  it('🔴 검정고시는 고등학교에서만 true 로 나간다', async () => {
    const { onSave } = draw()
    fireEvent.change(degreeSelect(), { target: { value: '고등학교' } })
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: '한국고등학교' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '검정고시' }))
    fireEvent.click(saveBtn())
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].is_ged).toBe(true)

    // 다시 대학으로 되돌리면 켜진 채로 넘어가지 않는다
    fireEvent.change(degreeSelect(), { target: { value: '대학교 (학사)' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][0].is_ged).toBe(false)
  })

  it('총 이수 학점이 숫자가 아니면 저장하지 않는다', async () => {
    const { onSave } = draw()
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: '서울대학교' } })
    fireEvent.change(screen.getByLabelText('총 이수 학점'), { target: { value: '백삼십' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('기간 칩 「+1학기」 → 입학일 + 6개월이 졸업일에 채워진다', () => {
    draw()
    fireEvent.change(screen.getByLabelText('입학'), { target: { value: '2022-03-02' } })
    fireEvent.click(screen.getByRole('button', { name: '+1학기' }))
    expect(screen.getByLabelText('졸업/예정')).toHaveValue('2022-09-02')
  })

  it('학점 옆 만점 기준 도움말이 있다', () => {
    draw()
    expect(screen.getByText(/4\.3·4\.0 만점은 만점 기준을 고르세요/)).toBeInTheDocument()
  })

  it('편집 모드 — 저장된 새 칸이 복원된다', () => {
    draw({
      id: 'e1',
      school_name: '연세대학교',
      degree: '대학교 (학사)',
      campus_type: 'branch',
      day_night: 'night',
      admission_type: 'transfer',
      total_credits: 142,
      is_ged: false,
    })
    expect(chip('캠퍼스', '분교')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('주·야간', '야간')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('입학 구분', '편입')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('총 이수 학점')).toHaveValue('142')
  })
})

/**
 * 🔴 증명서는 슬롯이 아니라 **여기가 원본**이다 (CEO 2026-09-05) — 두 군데 저장되면
 * 어느 쪽이 최신인지 사용자도 우리도 모른다.
 */
describe('증빙 파일 — 성적증명서 · 졸업(예정)증명서 두 칸', () => {
  it('두 칸이 나온다', () => {
    draw()
    expect(proofGroup('성적증명서')).toBeInTheDocument()
    expect(proofGroup('재학·졸업(예정)증명서')).toBeInTheDocument()
  })

  it('🔴 각 칸의 첨부가 제 필드로 실린다', async () => {
    const { onSave } = draw()
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: '서울대학교' } })
    fireEvent.click(within(proofGroup('성적증명서')).getByRole('button', { name: '파일 첨부' }))
    fireEvent.click(within(proofGroup('재학·졸업(예정)증명서')).getByRole('button', { name: '파일 첨부' }))

    // 저장은 성적증명서 → 졸업증명서 순으로 해석한다
    h.resolveFileForSubmit
      .mockResolvedValueOnce({ file_url: 'https://files.test/transcript.pdf', file_size_bytes: 111 })
      .mockResolvedValueOnce({ file_url: 'https://files.test/graduation.pdf', file_size_bytes: 222 })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      transcript_file_url: 'https://files.test/transcript.pdf',
      transcript_file_size_bytes: 111,
      graduation_file_url: 'https://files.test/graduation.pdf',
      graduation_file_size_bytes: 222,
    })
  })

  it('아무것도 안 붙이면 두 칸 다 null 로 나간다', async () => {
    const { onSave } = draw()
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: '서울대학교' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      transcript_file_url: null,
      transcript_file_size_bytes: null,
      graduation_file_url: null,
      graduation_file_size_bytes: null,
    })
  })

  it('옛 file_url 이 있으면 「기타 증빙(구분 없음)」이 읽기 전용으로 보인다', () => {
    draw({ id: 'e1', school_name: 'OO대학교', file_url: 'https://files.test/old.pdf' })
    expect(screen.getByText('기타 증빙(구분 없음)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /파일 보기/ })).toHaveAttribute('href', 'https://files.test/old.pdf')
    // 새로 올리는 자리가 아니다 — 첨부 버튼은 두 칸(성적·졸업)에만 있다
    expect(screen.getAllByRole('button', { name: '파일 첨부' })).toHaveLength(2)
  })

  it('🔴 옛 증빙 삭제 → body 의 file_url 이 빈 문자열', async () => {
    const { onSave } = draw({ id: 'e1', school_name: 'OO대학교', file_url: 'https://files.test/old.pdf' })
    fireEvent.click(screen.getByRole('button', { name: '기타 증빙 삭제' }))
    expect(screen.queryByText('기타 증빙(구분 없음)')).toBeNull()

    fireEvent.click(saveBtn())
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ file_url: '', file_size_bytes: null })
  })

  it('옛 file_url 이 없으면 「기타 증빙」 자리 자체가 없다', () => {
    draw({ id: 'e1', school_name: 'OO대학교' })
    expect(screen.queryByText('기타 증빙(구분 없음)')).toBeNull()
    expect(screen.queryByRole('button', { name: '기타 증빙 삭제' })).toBeNull()
  })
})

describe('학력 모달 — 계열 · 해외 학교 · 증명서 라벨 · 단계 프리셋', () => {
  const trackSelect = () => screen.getByRole('combobox', { name: '계열' })

  it('16) 🔴 「계열」은 고등학교에서만 묻고 코드값으로 실린다', async () => {
    const { onSave } = draw()
    expect(screen.queryByRole('combobox', { name: '계열' })).toBeNull()

    fireEvent.change(degreeSelect(), { target: { value: '고등학교' } })
    expect([...trackSelect().querySelectorAll('option')].map((o) => o.textContent))
      .toEqual(['선택', '인문', '자연', '예체능', '특성화', '기타'])
    fireEvent.change(trackSelect(), { target: { value: 'natural' } })
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: '한국고등학교' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].track).toBe('natural')
  })

  it('17) 대학교로 되돌리면 계열은 실리지 않는다', async () => {
    const { onSave } = draw()
    fireEvent.change(degreeSelect(), { target: { value: '고등학교' } })
    fireEvent.change(trackSelect(), { target: { value: 'arts' } })
    fireEvent.change(degreeSelect(), { target: { value: '대학교 (학사)' } })
    expect(screen.queryByRole('combobox', { name: '계열' })).toBeNull()
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: '서울대학교' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].track).toBeUndefined()
  })

  it('18) 🔴 「해외 학교」 예 → 국가 칸이 열리고 country 로 실린다 · 아니오면 비운다', async () => {
    const { onSave } = draw()
    expect(screen.queryByLabelText('국가')).toBeNull()

    fireEvent.click(chip('해외 학교', '예'))
    const country = screen.getByLabelText('국가')
    expect(country).toHaveAttribute('maxlength', '60')
    fireEvent.change(country, { target: { value: '미국' } })
    fireEvent.change(screen.getByLabelText('학교명'), { target: { value: 'MIT' } })
    fireEvent.click(saveBtn())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].country).toBe('미국')

    // 스위치를 끄면 적어 둔 값이 남아도 국내로 나간다
    fireEvent.click(chip('해외 학교', '아니오'))
    expect(screen.queryByLabelText('국가')).toBeNull()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(onSave.mock.calls[1][0].country).toBe('')
  })

  it('19) 편집 — country 가 있으면 해외 학교가 켜진 채 열린다', () => {
    draw({ id: 'e1', school_name: 'MIT', country: '미국' })
    expect(chip('해외 학교', '예')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('국가')).toHaveValue('미국')
  })

  it('20) 증명서 라벨은 「재학·졸업(예정)증명서」다', () => {
    draw()
    expect(screen.getByText('재학·졸업(예정)증명서')).toBeInTheDocument()
    expect(screen.queryByText(/^졸업\(예정\)증명서$/)).toBeNull()
  })

  it('21) 🔴 단계 프리셋 — initialDegree 로 열면 학교 단계가 미리 골라져 있다', () => {
    draw(null, '전문대')
    expect(degreeSelect()).toHaveValue('전문대')
    expect(screen.getByLabelText('만점')).toHaveValue('4.5')
    cleanup()

    draw(null, '고등학교')
    expect(degreeSelect()).toHaveValue('고등학교')
    expect(screen.getByLabelText('만점')).toHaveValue('5.0')
    expect(screen.getByRole('checkbox', { name: '검정고시' })).toBeInTheDocument()
  })
})
