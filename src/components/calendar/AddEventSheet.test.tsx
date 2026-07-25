/**
 * U19 — AddEventSheet 메모 입력 시나리오 (백엔드 varchar(200) 정합):
 * 1. 메모 textarea maxLength=200
 * 2. 카운터는 150자+ 만 노출 (149 미노출 · 200 노출)
 *
 * (데스크탑 모달 경로 — jsdom matchMedia 미구현 → useIsMobile=false)
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddEventSheet } from './AddEventSheet'

vi.mock('@/hooks/useCalendar', () => ({
  useCreateDailyNote: () => ({ mutate: vi.fn(), isPending: false }),
}))

function openMemoView() {
  render(<AddEventSheet open defaultDate="2026-07-16" onClose={vi.fn()} />)
  fireEvent.click(screen.getByText('이 날 할 일 · 메모'))
  return screen.getByPlaceholderText('예: 자소서 초안 다듬기') as HTMLTextAreaElement
}

describe('AddEventSheet — 메모 200자 (U19)', () => {
  it('1) textarea maxLength=200', () => {
    const textarea = openMemoView()
    expect(textarea.maxLength).toBe(200)
  })

  it('2) 카운터 150 경계', () => {
    const textarea = openMemoView()
    fireEvent.change(textarea, { target: { value: 'a'.repeat(149) } })
    expect(screen.queryByText('149/200')).toBeNull()

    fireEvent.change(textarea, { target: { value: 'a'.repeat(150) } })
    expect(screen.getByText('150/200')).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'a'.repeat(200) } })
    expect(screen.getByText('200/200')).toBeInTheDocument()
  })
})

/**
 * U14 — 작성 중인 메모 닫기 확인 시나리오:
 * 1. 메모 입력 있음 + 오버레이 클릭 → 확인 다이얼로그 노출 · onClose 미호출
 * 2. 확인 [닫기] → onClose 호출
 * 3. 확인 [취소] → 시트 유지 · 입력 보존
 * 4. 메모 빈 상태 닫기 → 확인 없이 즉시 onClose
 * 5. ESC 도 같은 확인 경로 (데스크탑 분기에 ESC 신설)
 *
 * (데스크탑 모달 경로 — jsdom matchMedia 미구현 → useIsMobile=false)
 */
const CONFIRM_TITLE = '작성 중인 메모가 있어요'

function openMemoViewWith(onClose: () => void) {
  render(<AddEventSheet open defaultDate="2026-07-16" onClose={onClose} />)
  fireEvent.click(screen.getByText('이 날 할 일 · 메모'))
  return screen.getByPlaceholderText('예: 자소서 초안 다듬기') as HTMLTextAreaElement
}

/** 데스크탑 분기의 오버레이 = dialog 의 부모 */
function clickOverlay() {
  fireEvent.click(screen.getByRole('dialog').parentElement!)
}

describe('AddEventSheet — 작성 중 닫기 확인 (U14)', () => {
  it('1) 메모 입력 + 오버레이 클릭 → 확인 노출 · onClose 미호출', () => {
    const onClose = vi.fn()
    const textarea = openMemoViewWith(onClose)
    fireEvent.change(textarea, { target: { value: '자소서 초안' } })

    clickOverlay()

    expect(screen.getByText(CONFIRM_TITLE)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('2) 확인 [닫기] → onClose 호출', () => {
    const onClose = vi.fn()
    const textarea = openMemoViewWith(onClose)
    fireEvent.change(textarea, { target: { value: '자소서 초안' } })
    clickOverlay()

    fireEvent.click(screen.getByRole('button', { name: '닫기' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('3) 확인 [취소] → 시트 유지 · 입력 보존', () => {
    const onClose = vi.fn()
    const textarea = openMemoViewWith(onClose)
    fireEvent.change(textarea, { target: { value: '자소서 초안' } })
    clickOverlay()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByText(CONFIRM_TITLE)).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(
      (screen.getByPlaceholderText('예: 자소서 초안 다듬기') as HTMLTextAreaElement).value,
    ).toBe('자소서 초안')
  })

  it('4) 메모 빈 상태 → 확인 없이 즉시 onClose', () => {
    const onClose = vi.fn()
    openMemoViewWith(onClose)

    clickOverlay()

    expect(screen.queryByText(CONFIRM_TITLE)).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('5) ESC → 입력 있으면 확인 · 없으면 즉시 닫기', () => {
    const onClose = vi.fn()
    const textarea = openMemoViewWith(onClose)
    fireEvent.change(textarea, { target: { value: '자소서 초안' } })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByText(CONFIRM_TITLE)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    // 확인 위에서 한 번 더 ESC → 확인만 닫힘 (시트 유지)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(CONFIRM_TITLE)).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
