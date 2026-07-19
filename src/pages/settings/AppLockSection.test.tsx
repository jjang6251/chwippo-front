/**
 * AppLockSection — 네이티브 전용 "앱 잠금" 설정 섹션 시나리오:
 * 1. 웹(비네이티브) → 미렌더 + get-app-lock 미전송
 * 2. 네이티브 · 상태 회신 전 → 미렌더
 * 3. 네이티브 · 미지원(supported:false) 회신 → 미렌더
 * 4. 네이티브 · 지원 + enabled:false → 섹션 렌더 (토글 off) + 설명 카피
 * 5. 네이티브 · 지원 + enabled:true → 토글 on
 * 6. 마운트 시 get-app-lock 전송 (네이티브)
 * 7. 토글 클릭 → set-app-lock(반전) 전송 + 낙관적 UI 반영
 * 8. 잘못된 detail 회신 → 무시 (미렌더 유지)
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppLockSection } from './AppLockSection'

const h = vi.hoisted(() => ({
  isNative: true,
  postToNative: vi.fn(),
}))

vi.mock('@/hooks/useNativeMode', () => ({
  useNativeMode: () => h.isNative,
}))
vi.mock('@/utils/nativeBridge', () => ({
  postToNative: h.postToNative,
}))

function emitState(detail: unknown) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('chwippo:app-lock-state', { detail }),
    )
  })
}

beforeEach(() => {
  h.isNative = true
  h.postToNative.mockReset()
})

describe('AppLockSection — 노출 조건', () => {
  it('1. 웹(비네이티브) → 미렌더 + get-app-lock 미전송', () => {
    h.isNative = false
    const { container } = render(<AppLockSection />)
    expect(container).toBeEmptyDOMElement()
    expect(h.postToNative).not.toHaveBeenCalled()
  })

  it('2. 네이티브 · 상태 회신 전 → 미렌더', () => {
    const { container } = render(<AppLockSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('3. 네이티브 · 미지원 회신 → 미렌더', () => {
    render(<AppLockSection />)
    emitState({ supported: false, enabled: false })
    expect(screen.queryByText('앱 잠금')).toBeNull()
  })

  it('8. 잘못된 detail 회신 → 무시 (미렌더 유지)', () => {
    render(<AppLockSection />)
    emitState({ supported: 'yes' }) // 타입 불일치
    emitState(undefined)
    expect(screen.queryByText('앱 잠금')).toBeNull()
  })
})

describe('AppLockSection — 지원 기기 렌더', () => {
  it('4. 지원 + enabled:false → 섹션 렌더 (토글 off) + 설명 카피', () => {
    render(<AppLockSection />)
    emitState({ supported: true, enabled: false })

    expect(screen.getByText('앱 잠금')).toBeInTheDocument()
    expect(
      screen.getByText('앱을 열 때 Face ID · Touch ID로 잠금을 해제해요.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '앱 잠금' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('5. 지원 + enabled:true → 토글 on', () => {
    render(<AppLockSection />)
    emitState({ supported: true, enabled: true })
    expect(screen.getByRole('switch', { name: '앱 잠금' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

describe('AppLockSection — 브릿지', () => {
  it('6. 마운트 시 get-app-lock 전송', () => {
    render(<AppLockSection />)
    expect(h.postToNative).toHaveBeenCalledWith({ type: 'get-app-lock' })
  })

  it('7. 토글 클릭(현재 off) → set-app-lock(true) 전송 + 낙관적 on', () => {
    render(<AppLockSection />)
    emitState({ supported: true, enabled: false })

    fireEvent.click(screen.getByRole('switch', { name: '앱 잠금' }))

    expect(h.postToNative).toHaveBeenCalledWith({
      type: 'set-app-lock',
      enabled: true,
    })
    // 낙관적 UI — 회신 없이도 즉시 on 반영
    expect(screen.getByRole('switch', { name: '앱 잠금' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
