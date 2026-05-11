import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { goBack } from './navigation'

describe('goBack', () => {
  let originalHistoryLength: number

  beforeEach(() => {
    originalHistoryLength = window.history.length
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('history.length > 1 → navigate(-1) 호출', () => {
    Object.defineProperty(window.history, 'length', { value: 5, configurable: true })
    const navigate = vi.fn()
    goBack(navigate as any, '/board')
    expect(navigate).toHaveBeenCalledWith(-1)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('history.length === 1 → fallback으로 replace navigate', () => {
    Object.defineProperty(window.history, 'length', { value: 1, configurable: true })
    const navigate = vi.fn()
    goBack(navigate as any, '/board')
    expect(navigate).toHaveBeenCalledWith('/board', { replace: true })
  })

  it('history.length === 0 (이론상 케이스) → fallback', () => {
    Object.defineProperty(window.history, 'length', { value: 0, configurable: true })
    const navigate = vi.fn()
    goBack(navigate as any, '/dashboard')
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('history.length 복원', () => {
    Object.defineProperty(window.history, 'length', { value: originalHistoryLength, configurable: true })
    expect(window.history.length).toBe(originalHistoryLength)
  })
})
