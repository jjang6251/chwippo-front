/**
 * U13 — 토스트 액션 슬롯 시나리오:
 * 1. toast.action → info 타입 + action 슬롯 저장
 * 2. toast.action 기본 5초 후 자동 소멸
 * 3. durationMs 오버라이드 존중
 * 4. remove(id) → 해당 토스트만 제거 (연속 토스트 독립)
 * 5. 기존 toast.show/error/success 후방 호환 (action 없음 · 3.5초)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore, toast } from './toastStore'

describe('toastStore — 액션 슬롯 (U13)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('1) toast.action → info 타입 + action 슬롯', () => {
    const onAction = vi.fn()
    toast.action('삭제됨', { label: '되돌리기', onAction })
    const [t] = useToastStore.getState().toasts
    expect(t.type).toBe('info')
    expect(t.action?.label).toBe('되돌리기')
    t.action!.onAction()
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('2) toast.action 기본 5초 후 자동 소멸', () => {
    toast.action('삭제됨', { label: '되돌리기', onAction: vi.fn() })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4999)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('3) durationMs 오버라이드 존중', () => {
    toast.action('삭제됨', { label: '되돌리기', onAction: vi.fn() }, { durationMs: 1000 })
    vi.advanceTimersByTime(1000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('4) 연속 토스트 → remove 는 해당 토스트만 (독립 동작)', () => {
    toast.action('A 삭제됨', { label: '되돌리기', onAction: vi.fn() })
    toast.action('B 삭제됨', { label: '되돌리기', onAction: vi.fn() })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(2)
    useToastStore.getState().remove(toasts[0].id)
    const after = useToastStore.getState().toasts
    expect(after).toHaveLength(1)
    expect(after[0].message).toBe('B 삭제됨')
  })

  it('5) toast.show 후방 호환 — action 없음 · 3.5초 소멸', () => {
    toast.show('저장됐어요')
    const [t] = useToastStore.getState().toasts
    expect(t.action).toBeUndefined()
    expect(t.type).toBe('info')
    vi.advanceTimersByTime(3500)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
