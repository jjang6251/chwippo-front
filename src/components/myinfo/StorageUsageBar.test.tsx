/**
 * StorageUsageBar 테스트
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *   상태  1. 로딩 상태 → skeleton
 *         2. 에러 → "사용량 조회 실패"
 *         3. 정상 데이터 → "X MB / Y MB" 표시
 *   톤    4. <80%: 평소 톤 (text-text-primary)
 *         5. 80-94%: 노란색 (warning)
 *         6. ≥95%: 빨간색 + 안내 문구 (danger)
 *         7. 신규 유저 (0/100) → 0MB, 경고 없음
 *         8. 100MB 이상 → 정수 포맷
 *   분해  9. 🔴 둘 다 있음 → 두 출처가 각자 뜨고 **합이 바 수치와 같다**
 *        10. 🔴 한쪽 0 → 그래도 두 출처를 다 쓴다 (0 이라고 접지 않는다)
 *        11. 🔴 둘 다 0 → 역시 두 출처를 다 쓴다 (줄 수가 안 흔들린다)
 *        12. 🔴 breakdown 필드 없음(백엔드 롤아웃 창) → 분해 줄만 조용히 빠진다
 *        13. 1MB 미만은 KB — 「0.0MB」로 안 쓴 것처럼 보이면 안 된다
 *   경고 14. 🔴 노트 이미지가 더 큼 → **노트 이미지**를 지우라고 말한다 (구 문구 「항목」 아님)
 *        15. 🔴 증빙 파일이 더 큼 → **증빙 파일**을 지우라고 말한다
 *        16. 동률 → 한쪽을 찍지 않고 둘 다 부른다
 *        17. 🔴 분해값 없음 → 역시 한쪽을 단정하지 않는다
 *   변형 18. quiet = 카드 껍데기(테두리·배경)만 빠지고 값·바는 그대로
 *        19. 로딩 자리도 variant 를 따른다
 *        20. 🔴 compact = 껍데기 없음 + **폭 고정**(220px) + 우측 정렬 — 값·바·톤은 그대로
 *        21. 🔴 compact 분해 줄은 **짧은 라벨**(증빙 · 노트) — 220px 에서 안 접힌다
 *        22. 🔴 card·quiet 은 긴 라벨 그대로 — 두 벌이 갈라지지 않는다 (같은 파일·같은 상수)
 *        23. 🔴 95% 경고는 compact 에서도 나오고, **문장은 전체 이름**을 쓴다
 *            («증빙이 더 많이 쓰고 있어요» 는 무엇을 지우란 말인지 알 수 없다)
 *        24. compact 로딩 자리도 같은 껍데기 + 3줄 (도착해도 헤더가 안 밀린다)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { StorageUsage } from '@/api/myinfo'
import { StorageUsageBar } from './StorageUsageBar'
import { useStorageUsage } from '@/hooks/useStorageUsage'

vi.mock('@/hooks/useStorageUsage', () => ({
  useStorageUsage: vi.fn(),
}))

const mocked = vi.mocked(useStorageUsage)

const MB = 1024 * 1024
const LIMIT_BYTES = 100 * MB

/**
 * 픽스처가 서버 불변식(`usedBytes === myinfoBytes + noteImageBytes`)을 **구조적으로** 지킨다 —
 * 합계 케이스에서 손으로 적은 숫자가 어긋나면 검증이 아니라 오타 시험이 된다.
 */
function usage(myinfoBytes: number, noteImageBytes: number): StorageUsage {
  const usedBytes = myinfoBytes + noteImageBytes
  return {
    usedBytes,
    limitBytes: LIMIT_BYTES,
    usedMB: Number((usedBytes / MB).toFixed(1)),
    limitMB: 100,
    percentage: Math.round((usedBytes / LIMIT_BYTES) * 100),
    breakdown: { myinfoBytes, noteImageBytes },
  }
}

function loaded(data: StorageUsage) {
  mocked.mockReturnValue({
    data,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useStorageUsage>)
}

/**
 * 「증빙 파일 60.0MB · 공부 노트 이미지 36.0MB」 같은 분해 줄.
 *
 * 🔴 `증빙 파일` 이 아니라 `증빙` 으로 찾는다 — compact 변형은 짧은 라벨을 쓰기 때문이다.
 * 경고 문구도 `증빙` 을 품지만 분해 줄이 DOM 상 **먼저**라 첫 매치가 언제나 분해 줄이다.
 */
function breakdownLine(container: HTMLElement): string | null {
  const line = Array.from(container.querySelectorAll('p')).find((p) =>
    p.textContent?.includes('증빙'),
  )
  return line?.textContent ?? null
}

describe('StorageUsageBar', () => {
  beforeEach(() => {
    mocked.mockReset()
  })

  it('1 로딩 상태 → skeleton 표시 (아이콘만, 텍스트 없음)', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('2 에러 상태 → "사용량 조회 실패" 노출', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('500'),
    } as unknown as ReturnType<typeof useStorageUsage>)

    render(<StorageUsageBar />)
    expect(screen.getByText('사용량 조회 실패')).toBeTruthy()
  })

  it('3·4 50% 사용 → 평소 톤 (warning/danger 클래스 없음, H-5 미달)', () => {
    loaded(usage(30 * MB, 20 * MB))

    const { container } = render(<StorageUsageBar />)
    expect(screen.getByText(/50.*100MB/)).toBeTruthy()
    // 진행 바가 brand 색
    expect(container.querySelector('.bg-brand')).toBeTruthy()
    expect(container.querySelector('.bg-warning')).toBeNull()
    expect(container.querySelector('.bg-danger')).toBeNull()
  })

  it('5 80% 사용 → warning 톤 (H-5)', () => {
    loaded(usage(50 * MB, 30 * MB))

    const { container } = render(<StorageUsageBar />)
    expect(container.querySelector('.bg-warning')).toBeTruthy()
    expect(container.querySelector('.bg-danger')).toBeNull()
  })

  it('6 95% 사용 → danger 톤 + 경고 문구 (H-6)', () => {
    loaded(usage(50 * MB, 45 * MB))

    const { container } = render(<StorageUsageBar />)
    expect(container.querySelector('.bg-danger')).toBeTruthy()
    expect(screen.getByText(/저장 공간이 거의 찼어요/)).toBeTruthy()
  })

  it('7 신규 유저 (0/100) → 0MB 표시, 경고 없음 (E-1)', () => {
    loaded(usage(0, 0))

    const { container } = render(<StorageUsageBar />)
    expect(screen.getByText(/0.*100MB/)).toBeTruthy()
    expect(container.querySelector('.bg-warning')).toBeNull()
    expect(container.querySelector('.bg-danger')).toBeNull()
  })

  it('8 100MB 이상 사용 시 정수 포맷 (소수점 제거)', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 150 * MB,
        limitBytes: 200 * MB,
        usedMB: 150,
        limitMB: 200,
        percentage: 75,
        breakdown: { myinfoBytes: 100 * MB, noteImageBytes: 50 * MB },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    render(<StorageUsageBar />)
    expect(screen.getByText(/^150 \/ 200MB$/)).toBeTruthy()
  })
})

describe('StorageUsageBar — 출처 분해 (내정보 증빙 ↔ 공부 노트 이미지)', () => {
  beforeEach(() => {
    mocked.mockReset()
  })

  it('9 🔴 둘 다 있음 → 각자 뜨고 합이 바 수치와 같다', () => {
    loaded(usage(60 * MB, 36 * MB))

    const { container } = render(<StorageUsageBar />)
    const line = breakdownLine(container)
    expect(line).toContain('증빙 파일 60.0MB')
    expect(line).toContain('공부 노트 이미지 36.0MB')

    // 화면에 적힌 두 수의 합 === 바가 말하는 사용량
    const parts = (line ?? '').match(/(\d+(?:\.\d+)?)MB/g) ?? []
    const sum = parts.reduce((acc, s) => acc + parseFloat(s), 0)
    expect(sum).toBeCloseTo(96, 1)
    expect(screen.getByText('96.0 / 100MB')).toBeTruthy()
  })

  it('10 🔴 노트 이미지가 0 이어도 두 출처를 다 쓴다', () => {
    loaded(usage(12 * MB, 0))

    const { container } = render(<StorageUsageBar />)
    const line = breakdownLine(container)
    expect(line).toContain('증빙 파일 12.0MB')
    expect(line).toContain('공부 노트 이미지 0MB')
  })

  it('10b 🔴 증빙이 0 이어도 두 출처를 다 쓴다', () => {
    loaded(usage(0, 7 * MB))

    const { container } = render(<StorageUsageBar />)
    const line = breakdownLine(container)
    expect(line).toContain('증빙 파일 0MB')
    expect(line).toContain('공부 노트 이미지 7.0MB')
  })

  it('11 🔴 둘 다 0 (신규 유저) 이어도 줄은 그대로 — 같은 통을 쓴다는 사실이 여기서 전달된다', () => {
    loaded(usage(0, 0))

    const { container } = render(<StorageUsageBar />)
    const line = breakdownLine(container)
    expect(line).toContain('증빙 파일 0MB')
    expect(line).toContain('공부 노트 이미지 0MB')
  })

  it('12 🔴 breakdown 필드가 없으면(백엔드 롤아웃 창) 분해 줄만 빠지고 바는 그대로', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 12 * MB,
        limitBytes: LIMIT_BYTES,
        usedMB: 12,
        limitMB: 100,
        percentage: 12,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar />)
    expect(breakdownLine(container)).toBeNull()
    expect(screen.getByText('12.0 / 100MB')).toBeTruthy()
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy()
  })

  it('13 1MB 미만은 KB 로 — 「0.0MB」로 안 쓴 것처럼 보이면 안 된다', () => {
    loaded(usage(40 * 1024, 3 * MB))

    const { container } = render(<StorageUsageBar />)
    expect(breakdownLine(container)).toContain('증빙 파일 40KB')
  })
})

describe('StorageUsageBar — 가득 찼을 때 무엇을 지우라고 말하는가', () => {
  beforeEach(() => {
    mocked.mockReset()
  })

  /** 구 문구는 내정보 항목만 가리켰다 — 되살아나면 노트 사용자에게 거짓말이 된다 */
  const OLD_COPY = /일부 항목을 삭제해 주세요/

  it('14 🔴 노트 이미지가 더 큼 → 노트 이미지를 지우라고 말한다', () => {
    loaded(usage(20 * MB, 76 * MB))

    render(<StorageUsageBar />)
    const warning = screen.getByText(/저장 공간이 거의 찼어요/)
    expect(warning.textContent).toContain('공부 노트 이미지')
    expect(warning.textContent).not.toMatch(OLD_COPY)
  })

  it('15 🔴 증빙 파일이 더 큼 → 증빙 파일을 지우라고 말한다', () => {
    loaded(usage(76 * MB, 20 * MB))

    render(<StorageUsageBar />)
    const warning = screen.getByText(/저장 공간이 거의 찼어요/)
    expect(warning.textContent).toContain('증빙 파일')
    expect(warning.textContent).toContain('내 정보 창고')
    expect(warning.textContent).not.toMatch(OLD_COPY)
  })

  it('16 동률이면 한쪽을 찍지 않고 둘 다 부른다', () => {
    loaded(usage(48 * MB, 48 * MB))

    render(<StorageUsageBar />)
    const warning = screen.getByText(/저장 공간이 거의 찼어요/)
    expect(warning.textContent).toContain('증빙 파일')
    expect(warning.textContent).toContain('공부 노트 이미지')
  })

  it('17 🔴 분해값이 없으면 역시 한쪽을 단정하지 않는다', () => {
    mocked.mockReturnValue({
      data: {
        usedBytes: 96 * MB,
        limitBytes: LIMIT_BYTES,
        usedMB: 96,
        limitMB: 100,
        percentage: 96,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    render(<StorageUsageBar />)
    const warning = screen.getByText(/저장 공간이 거의 찼어요/)
    expect(warning.textContent).toContain('증빙 파일')
    expect(warning.textContent).toContain('공부 노트 이미지')
    expect(warning.textContent).not.toMatch(OLD_COPY)
  })
})

describe('StorageUsageBar — quiet 변형 (공부 노트 허브)', () => {
  beforeEach(() => {
    mocked.mockReset()
  })

  it('18 카드 껍데기만 빠지고 값·진행바·분해는 그대로', () => {
    loaded(usage(60 * MB, 36 * MB))

    const card = render(<StorageUsageBar />).container
    expect(card.querySelector('.border-line')).toBeTruthy()

    const quiet = render(<StorageUsageBar variant="quiet" />).container
    expect(quiet.querySelector('.border-line')).toBeNull()
    expect(quiet.querySelector('.bg-surface')).toBeNull()
    // 같은 정보를 그대로 든다
    expect(quiet.querySelector('[role="progressbar"]')).toBeTruthy()
    expect(breakdownLine(quiet)).toContain('공부 노트 이미지 36.0MB')
  })

  it('19 로딩 자리도 variant 를 따른다 (스켈레톤은 3줄 고정)', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar variant="quiet" />)
    expect(container.querySelector('.border-line')).toBeNull()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })
})

/**
 * compact 변형 — 공부 노트 허브 **헤더 우측**(CTA 아래), 2026-08-21.
 *
 * 폭·정렬은 CSS 가 정하므로 jsdom 은 **계약(클래스)** 으로만 잡는다. 실제 좌표가 「새 노트」
 * 버튼과 겹치지 않는지는 Playwright 실측 몫이다 (jsdom 은 레이아웃을 계산하지 않는다).
 */
describe('StorageUsageBar — compact 변형 (허브 헤더 우측)', () => {
  beforeEach(() => {
    mocked.mockReset()
  })

  it('20 🔴 껍데기 없음 + 폭 고정 + 우측 정렬 — 값·진행바는 그대로', () => {
    loaded(usage(2 * MB, 1.2 * MB))

    const { container } = render(<StorageUsageBar variant="compact" />)
    const shell = container.firstElementChild as HTMLElement

    // 껍데기(테두리·배경)를 만들지 않는다
    expect(container.querySelector('.border-line')).toBeNull()
    expect(container.querySelector('.bg-surface')).toBeNull()

    // 🔴 값이 길어져도 CTA 쪽으로 번지지 않게 폭이 고정이다
    expect(shell.className).toContain('w-[220px]')
    expect(shell.className).toContain('items-end')
    expect(shell.className).toContain('text-right')

    // 같은 정보·같은 부품을 그대로 든다 (새 시각 언어 없음)
    expect(screen.getByText('3.2 / 100MB')).toBeTruthy()
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy()
    // 바 높이는 다른 변형과 같다 — compact 라고 더 얇게 만들지 않는다
    expect(container.querySelector('[role="progressbar"]')?.className).toContain('h-1.5')
    expect(container.querySelector('.bg-brand')).toBeTruthy()
  })

  it('21 🔴 분해 줄은 짧은 라벨 — 값은 긴 라벨과 똑같다', () => {
    loaded(usage(2 * MB, 1.2 * MB))

    const { container } = render(<StorageUsageBar variant="compact" />)
    const line = breakdownLine(container)
    expect(line).toContain('증빙 2.0MB')
    expect(line).toContain('노트 1.2MB')
    // 긴 이름이 새어 들어오면 220px 에서 접힌다
    expect(line).not.toContain('증빙 파일')
    expect(line).not.toContain('공부 노트 이미지')
  })

  it('22 🔴 짧은 라벨은 compact 에만 — card·quiet 은 긴 이름 그대로다', () => {
    loaded(usage(2 * MB, 1.2 * MB))

    for (const variant of ['card', 'quiet'] as const) {
      const { container } = render(<StorageUsageBar variant={variant} />)
      const line = breakdownLine(container)
      expect(line, `${variant} 이 짧은 라벨로 갈라졌다`).toContain('증빙 파일 2.0MB')
      expect(line, `${variant} 이 짧은 라벨로 갈라졌다`).toContain('공부 노트 이미지 1.2MB')
    }
  })

  it('23 🔴 95% 경고는 compact 에서도 나오고, 문장은 전체 이름을 쓴다', () => {
    loaded(usage(20 * MB, 76 * MB))

    render(<StorageUsageBar variant="compact" />)
    const warning = screen.getByText(/저장 공간이 거의 찼어요/)
    // 좁다고 경고를 접지 않는다 — 막히기 직전에 알려 주는 게 이 줄의 존재 이유다
    expect(warning).toBeTruthy()
    // 🔴 문장 안에서는 짧은 이름이 뜻을 잃는다 («노트가 더 많이 쓰고 있어요»)
    expect(warning.textContent).toContain('공부 노트 이미지')
  })

  it('24 로딩 자리도 compact 껍데기 + 3줄 (도착해도 헤더가 안 밀린다)', () => {
    mocked.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = render(<StorageUsageBar variant="compact" />)
    const shell = container.firstElementChild as HTMLElement
    expect(shell.className).toContain('w-[220px]')
    expect(container.querySelector('.border-line')).toBeNull()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })
})
