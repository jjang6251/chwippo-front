/**
 * 내 정보 › 자격증 — 「등급」 칸 (대장 44 · 백엔드 `grade` ≤40) + 자동완성 칸 48px.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 추가 모달에 「등급」 칸(≤40 · placeholder 「예: 기사 · 1급」)이 있고 페이로드에 grade 가 실린다
 *  2. 편집 — 저장된 등급이 복원되고 목록 제목은 「자격증명 · 등급」
 *  3. 자동완성 input 이 공용 Field 톤(h-12 · text-base · rounded-xl)을 받는다
 *  4. 🔴 「자격증명」 라벨이 자동완성 칸을 가리킨다 (for ↔ id) — 안 이으면 「콤보박스」로만 읽힌다
 */
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Cert } from '@/api/myinfo'
import { CertsSection } from './MyInfo'

const h = vi.hoisted(() => ({
  certs: [] as Cert[],
  create: vi.fn(),
  update: vi.fn(),
  lastInputClass: undefined as string | undefined,
  lastInputId: undefined as string | undefined,
}))

vi.mock('@/hooks/useMyinfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMyinfo')>()),
  useCerts: () => ({ data: h.certs, isLoading: false }),
  useCreateCert: () => ({ mutateAsync: h.create }),
  useUpdateCert: () => ({ mutateAsync: h.update }),
  useDeleteCert: () => ({ mutate: vi.fn() }),
}))
/** 카탈로그 자동완성 대신 — 받은 클래스·id·값만 드러낸다 */
vi.mock('@/components/myinfo/CertAutocomplete', () => ({
  CertAutocomplete: ({ value, onChange, inputClassName, id }: {
    value: string; onChange: (v: string) => void; inputClassName?: string; id?: string
  }) => {
    h.lastInputClass = inputClassName
    h.lastInputId = id
    return <input id={id} aria-label="자격증명" value={value} onChange={(e) => onChange(e.target.value)} />
  },
}))
vi.mock('@/components/myinfo/FileUpload', () => ({ FileUpload: () => null }))
vi.mock('@/utils/fileSlot', () => ({
  EMPTY_SLOT: { kind: 'empty' },
  slotFromExisting: () => ({ kind: 'empty' }),
  resolveFileForSubmit: vi.fn().mockResolvedValue({ file_url: null, file_size_bytes: null }),
}))
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false, useMediaQuery: () => false }))
vi.mock('@/stores/toastStore', () => ({ toast: { error: vi.fn(), show: vi.fn() } }))

const draw = () => render(<CertsSection sectionRef={() => {}} />)
const openAdd = () => fireEvent.click(screen.getByRole('button', { name: /자격증 추가/ }))
/** 「추가」는 빈 상태 카드에도 있다 — 저장 버튼은 모달 푸터(마지막)다 */
const saveBtn = () => {
  const all = screen.getAllByRole('button', { name: /^(추가|수정)$/ })
  return all[all.length - 1]
}

beforeEach(() => {
  h.certs = []
  h.create.mockReset().mockResolvedValue({})
  h.update.mockReset().mockResolvedValue({})
  h.lastInputClass = undefined
})
afterEach(cleanup)

describe('자격증 — 등급', () => {
  it('1) 🔴 「등급」 칸 → 저장 페이로드에 grade', async () => {
    draw()
    openAdd()
    fireEvent.change(screen.getByLabelText('자격증명'), { target: { value: '정보처리기사' } })
    const grade = screen.getByLabelText('등급')
    expect(grade).toHaveAttribute('maxlength', '40')
    expect(grade).toHaveAttribute('placeholder', '예: 기사 · 1급')
    fireEvent.change(grade, { target: { value: '기사' } })
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.create).toHaveBeenCalled())
    expect(h.create.mock.calls[0][0]).toMatchObject({ name: '정보처리기사', grade: '기사' })
  })

  it('2) 편집 — 저장된 등급이 복원되고 목록 제목은 「자격증명 · 등급」', () => {
    h.certs = [{ id: 'c1', name: '정보처리기사', grade: '기사' }]
    draw()
    expect(screen.getByText('정보처리기사 · 기사')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '편집' }))
    expect(screen.getByLabelText('등급')).toHaveValue('기사')
  })
})

describe('자동완성 칸 48px', () => {
  it('3) CertAutocomplete 가 공용 Field 톤(h-12 · text-base · rounded-xl)을 받는다', () => {
    draw()
    openAdd()
    expect(h.lastInputClass).toContain('h-12')
    expect(h.lastInputClass).toContain('text-base')
    expect(h.lastInputClass).toContain('rounded-xl')
  })

  /**
   * 🔴 자동완성 칸은 `Field` 가 아니라, 라벨을 **직접** 이어 줘야 한다.
   * 안 이으면 화면엔 「자격증명」이 있는데 스크린리더는 「콤보박스」라고만 읽는다.
   */
  it('4) 🔴 「자격증명」 라벨이 자동완성 칸을 가리킨다 (for ↔ id)', () => {
    const { container } = draw()
    openAdd()
    expect(h.lastInputId).toBeTruthy()
    const label = container.querySelector(`label[for="${h.lastInputId}"]`)
    expect(label).not.toBeNull()
    expect(label?.textContent).toContain('자격증명')
    // 필수 표시가 글자로도 읽힌다
    expect(label?.textContent).toContain('필수')
  })
})
