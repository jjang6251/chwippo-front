/**
 * AlarmSettings — 저장 피드백(U24) + 웹 안내 배너(U3) 시나리오:
 * 1. (U24) 설정 변경 성공 → "저장됨 ✓" aria-live 노출
 * 2. (U24) 저장 중(isPending) → 토글 disabled (연타 방지)
 * 3. (U3) 웹(비네이티브) → "웹에서는 푸시 알림이 오지 않아요" 배너 노출
 * 4. (U3) 네이티브 → 웹 배너 미노출 · 대신 기기 권한 CTA
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AlarmSettings } from './AlarmSettings'
import type { AlarmConfig } from '@/types/notification'

const h = vi.hoisted(() => ({
  config: {
    master: true,
    briefingEnabled: true,
    deadlinePoints: 'd3',
    deadlineUrgentEnabled: true,
  } as AlarmConfig,
  isPending: false,
  isNative: false,
  mutate: vi.fn(),
}))

vi.mock('@/hooks/useNotifications', () => ({
  useAlarmConfig: () => ({ data: h.config, isLoading: false, isError: false }),
  useUpdateAlarmConfig: () => ({ mutate: h.mutate, isPending: h.isPending }),
}))
vi.mock('@/hooks/useNativeMode', () => ({
  useNativeMode: () => h.isNative,
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

beforeEach(() => {
  h.isPending = false
  h.isNative = false
  h.mutate.mockReset()
})

describe('AlarmSettings — 저장 피드백 (U24)', () => {
  it('1. 설정 변경 성공 → "저장됨 ✓" (aria-live)', () => {
    h.mutate.mockImplementation(
      (_partial: unknown, opts?: { onSuccess?: () => void }) =>
        opts?.onSuccess?.(),
    )
    render(<AlarmSettings />)

    // 저장 전에는 미노출
    expect(screen.queryByText('저장됨 ✓')).toBeNull()

    fireEvent.click(screen.getByRole('switch', { name: '아침 브리핑' }))

    const saved = screen.getByText('저장됨 ✓')
    expect(saved).toBeInTheDocument()
    // aria-live 조상에 담겨 스크린리더 통지
    expect(saved.closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('2. 저장 중(isPending) → 토글 disabled (연타 방지)', () => {
    h.isPending = true
    render(<AlarmSettings />)
    expect(screen.getByRole('switch', { name: '전체 알림' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: '아침 브리핑' })).toBeDisabled()
  })
})

describe('AlarmSettings — 웹 안내 배너 (U3)', () => {
  it('3. 웹(비네이티브) → 웹 안내 배너 노출', () => {
    h.isNative = false
    render(<AlarmSettings />)
    expect(
      screen.getByText('웹에서는 푸시 알림이 오지 않아요'),
    ).toBeInTheDocument()
  })

  it('4. 네이티브 → 웹 배너 미노출 · 기기 권한 CTA 노출', () => {
    h.isNative = true
    render(<AlarmSettings />)
    expect(screen.queryByText('웹에서는 푸시 알림이 오지 않아요')).toBeNull()
    expect(screen.getByText('기기 알림 권한')).toBeInTheDocument()
  })
})
