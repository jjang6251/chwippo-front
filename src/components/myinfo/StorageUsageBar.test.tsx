/**
 * StorageUsageBar 테스트
 *
 * 시나리오:
 * 1. 로딩 상태 → skeleton
 * 2. 에러 → "사용량 조회 실패"
 * 3. 정상 데이터 → "X MB / Y MB" 표시
 * 4. <80%: 평소 톤 (text-text-primary)
 * 5. 80-94%: 노란색 (warning)
 * 6. ≥95%: 빨간색 + 안내 문구 (danger)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StorageUsageBar } from './StorageUsageBar'
import { useStorageUsage } from '@/hooks/useStorageUsage'

vi.mock('@/hooks/useStorageUsage', () => ({
  useStorageUsage: vi.fn(),
}))

const mocked = vi.mocked(useStorageUsage)

describe('StorageUsageBar', () => {
  beforeEach(() => {
    mocked.mockReset()
  })

  it('로딩 상태 → skeleton 표시 (아이콘만, 텍스트 없음)', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('에러 상태 → "사용량 조회 실패" 노출', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('500'),
    } as unknown as ReturnType<typeof useStorageUsage>)

    render(<StorageUsageBar />)
    expect(screen.getByText('사용량 조회 실패')).toBeTruthy()
  })

  it('50% 사용 → 평소 톤 (warning/danger 클래스 없음, H-5 미달)', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 50 * 1024 * 1024,
        limitBytes: 100 * 1024 * 1024,
        usedMB: 50,
        limitMB: 100,
        percentage: 50,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar />)
    expect(screen.getByText(/50.*100MB/)).toBeTruthy()
    // 진행 바가 brand 색
    expect(container.querySelector('.bg-brand')).toBeTruthy()
    expect(container.querySelector('.bg-warning')).toBeNull()
    expect(container.querySelector('.bg-danger')).toBeNull()
  })

  it('80% 사용 → warning 톤 (H-5)', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 80 * 1024 * 1024,
        limitBytes: 100 * 1024 * 1024,
        usedMB: 80,
        limitMB: 100,
        percentage: 80,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar />)
    expect(container.querySelector('.bg-warning')).toBeTruthy()
    expect(container.querySelector('.bg-danger')).toBeNull()
  })

  it('95% 사용 → danger 톤 + 경고 문구 (H-6)', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 95 * 1024 * 1024,
        limitBytes: 100 * 1024 * 1024,
        usedMB: 95,
        limitMB: 100,
        percentage: 95,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar />)
    expect(container.querySelector('.bg-danger')).toBeTruthy()
    expect(screen.getByText(/저장 공간이 거의 찼습니다/)).toBeTruthy()
  })

  it('신규 유저 (0/100) → 0MB 표시, 경고 없음 (E-1)', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 0,
        limitBytes: 100 * 1024 * 1024,
        usedMB: 0,
        limitMB: 100,
        percentage: 0,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar />)
    expect(screen.getByText(/0.*100MB/)).toBeTruthy()
    expect(container.querySelector('.bg-warning')).toBeNull()
    expect(container.querySelector('.bg-danger')).toBeNull()
  })

  it('100MB 이상 사용 시 정수 포맷 (소수점 제거)', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 150 * 1024 * 1024,
        limitBytes: 200 * 1024 * 1024,
        usedMB: 150,
        limitMB: 200,
        percentage: 75,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    render(<StorageUsageBar />)
    expect(screen.getByText(/^150 \/ 200MB$/)).toBeTruthy()
  })
})
