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

const DEFAULT_CONFIG: AlarmConfig = {
  master: true,
  briefingEnabled: true,
  deadlinePoints: 'd3',
  briefingHour: 8,
  eventToggles: {
    deadline: true,
    interview: true,
    exam: true,
    resultDate: true,
    todo: true,
  },
  deadlineUrgentEnabled: true,
  imminentEnabled: true,
}

const h = vi.hoisted(() => ({
  config: {} as AlarmConfig,
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
  h.config = { ...DEFAULT_CONFIG, eventToggles: { ...DEFAULT_CONFIG.eventToggles } }
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

describe('AlarmSettings — 전체 알림 (채널 select-all)', () => {
  it('채널 전부 ON → 전체 알림 ON 표시 (파생값)', () => {
    render(<AlarmSettings />)
    expect(screen.getByRole('switch', { name: '전체 알림' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('채널 하나라도 OFF → 전체 알림 OFF 표시 (커스텀 상태)', () => {
    h.config.imminentEnabled = false
    render(<AlarmSettings />)
    expect(screen.getByRole('switch', { name: '전체 알림' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('전부 ON 상태에서 클릭 → 채널 3종 전부 OFF patch', () => {
    render(<AlarmSettings />)
    fireEvent.click(screen.getByRole('switch', { name: '전체 알림' }))
    expect(h.mutate).toHaveBeenCalledWith(
      {
        briefingEnabled: false,
        deadlineUrgentEnabled: false,
        imminentEnabled: false,
      },
      expect.any(Object),
    )
  })

  it('커스텀(하나 OFF) 상태에서 클릭 → 채널 3종 전부 ON patch', () => {
    h.config.briefingEnabled = false
    render(<AlarmSettings />)
    fireEvent.click(screen.getByRole('switch', { name: '전체 알림' }))
    expect(h.mutate).toHaveBeenCalledWith(
      {
        briefingEnabled: true,
        deadlineUrgentEnabled: true,
        imminentEnabled: true,
      },
      expect.any(Object),
    )
  })

  it('채널 OFF 상태여도 하위 토글 항상 조작 가능 (master disabled 제거)', () => {
    h.config.briefingEnabled = false
    h.config.deadlineUrgentEnabled = false
    h.config.imminentEnabled = false
    render(<AlarmSettings />)

    const urgent = screen.getByRole('switch', { name: '마감 당일 알림' })
    expect(urgent).not.toBeDisabled()
    fireEvent.click(urgent)
    expect(h.mutate).toHaveBeenCalledWith(
      { deadlineUrgentEnabled: true },
      expect.any(Object),
    )
  })

  it('전체 알림 설명 카피 = "모든 알림을 한 번에 켜고 꺼요."', () => {
    render(<AlarmSettings />)
    expect(screen.getByText('모든 알림을 한 번에 켜고 꺼요.')).toBeInTheDocument()
  })
})

describe('AlarmSettings — 임박 알림 채널 토글', () => {
  it('"일정 2시간 전 알림" 토글 렌더 + 설명 카피', () => {
    render(<AlarmSettings />)
    expect(
      screen.getByRole('switch', { name: '일정 2시간 전 알림' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('시간이 입력된 면접·시험 2시간 전에 알려드려요'),
    ).toBeInTheDocument()
  })

  it('클릭(현재 ON) → patch({ imminentEnabled: false })', () => {
    render(<AlarmSettings />)
    fireEvent.click(screen.getByRole('switch', { name: '일정 2시간 전 알림' }))
    expect(h.mutate).toHaveBeenCalledWith(
      { imminentEnabled: false },
      expect.any(Object),
    )
  })
})

describe('AlarmSettings — ⑧ 브리핑 시각 4택', () => {
  it('7·8·9·10시 칩 렌더 · 현재값(8시) aria-pressed', () => {
    render(<AlarmSettings />)
    for (const h of ['7시', '8시', '9시', '10시']) {
      expect(screen.getByRole('button', { name: h })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '8시' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('9시 칩 클릭 → patch({ briefingHour: 9 })', () => {
    render(<AlarmSettings />)
    fireEvent.click(screen.getByRole('button', { name: '9시' }))
    expect(h.mutate).toHaveBeenCalledWith(
      { briefingHour: 9 },
      expect.any(Object),
    )
  })
})

describe('AlarmSettings — ⑨ 유형 토글 5종', () => {
  it('5종 토글 칩 렌더 (서류 마감·면접·시험·결과 발표·할 일)', () => {
    render(<AlarmSettings />)
    for (const label of ['서류 마감', '면접', '시험', '결과 발표', '할 일']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('면접 토글 클릭(현재 on) → patch({ eventToggles: { interview: false } })', () => {
    render(<AlarmSettings />)
    fireEvent.click(screen.getByRole('button', { name: '면접' }))
    expect(h.mutate).toHaveBeenCalledWith(
      { eventToggles: { interview: false } },
      expect.any(Object),
    )
  })
})

describe('AlarmSettings — 누적 프리셋 카피', () => {
  it('포인트 설명 카피가 누적 의미 노출 (D-3부터 = D-3·D-1·당일)', () => {
    render(<AlarmSettings />)
    expect(screen.getByText(/D-3부터/)).toBeInTheDocument()
    expect(screen.getByText(/당일 아침까지 모두/)).toBeInTheDocument()
  })

  it('상단 카피 "꼭 필요한 순간에만 보내요 — 아침 브리핑 1통 + 임박 알림" · "하루 최대 2번" 제거', () => {
    render(<AlarmSettings />)
    expect(screen.getByText(/꼭 필요한 순간에만 보내요/)).toBeInTheDocument()
    expect(screen.getByText(/아침 브리핑 1통 \+ 임박 알림/)).toBeInTheDocument()
    expect(screen.queryByText(/하루 최대 2번/)).toBeNull()
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
