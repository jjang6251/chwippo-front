/**
 * 설정 › 연결된 확장 (`/settings/extension`).
 *
 * 시나리오 (먼저 나열하고 코드를 썼다):
 *
 * **고정 문구** — ① §17 「설정 페이지(치뽀 연결)」 문장 글자 그대로 ② §15 「직접 확인」 꼬리
 * **코드** — ③ 초기엔 코드 없음 ④ 발급 → 6자리 + 남은 시간 ⑤ 카운트다운 감소
 *   ⑥ 만료 → 코드 사라지고 「다시 만들기」 ⑦ 만료 시 목록 재조회 **1회만** ⑧ 재발급
 *   ⑨ 발급 실패 → 에러 토스트
 * **복사** — ⑩ 클립보드 기록 + 「복사됨」 ⑪ 실패 → 토스트(unhandled rejection 없음)
 * **목록** — ⑫ 로딩 스켈레톤 ⑬ 빈 상태 ⑭ 에러 + 다시 시도 ⑮ 행 렌더(지문·KST 날짜)
 *   ⑯ null 지문·미사용 세션
 * **해제** — ⑰ 확인 모달 노출(API 미호출) ⑱ 취소 ⑲ 확정 시 **sessionId 동봉** ⑳ 실패 토스트
 * **접근성** — ㉑ aria-live 가 발급을 알린다 ㉒ 초 단위는 live 밖(1초마다 낭독 금지)
 *   ㉓ 만료 안내 ㉔ 버튼 접근 이름
 * **모바일 모달** — ㉕ autoFocus 없음 ㉖ 오버레이 컨테이너에 하단 패딩 없음
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ExtensionSession } from '@/types/extension'

const api = vi.hoisted(() => ({
  listSessions: vi.fn(),
  createPairCode: vi.fn(),
  disconnect: vi.fn(),
}))
vi.mock('@/api/extension', () => ({ extensionApi: api }))

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  show: vi.fn(),
  action: vi.fn(),
}))
vi.mock('@/stores/toastStore', () => ({ toast: toastMock }))

import {
  ExtensionSettings,
  EXTENSION_INTRO,
  REVIEW_NOTICE,
} from './ExtensionSettings'

/** 백엔드 실측 응답 (2026-09-06 로컬 프로브) */
const SESSION: ExtensionSession = {
  id: '8c9ff629-e5fb-4422-8de0-bf380aabc314',
  deviceFingerprint: 'ff73cf773b60405a',
  createdAt: '2026-09-06T04:06:45.484Z',
  lastUsedAt: '2026-09-06T04:06:45.484Z',
  expiresAt: '2026-10-06T04:06:45.484Z',
}

const PAIR = {
  code: '638836',
  expiresAt: '2026-09-06T04:07:38.066Z',
  ttlSeconds: 60,
}

const writeText = vi.fn()

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={qc}>
      <ExtensionSettings />
    </QueryClientProvider>,
  )
}

/** 목록이 그려질 때까지 (스켈레톤 → 결과) */
async function renderLoaded() {
  const view = renderPage()
  await screen.findByRole('heading', { name: '연결된 기기' })
  await waitFor(() => expect(api.listSessions).toHaveBeenCalled())
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listSessions.mockResolvedValue([])
  api.createPairCode.mockResolvedValue(PAIR)
  api.disconnect.mockResolvedValue({ disconnected: 1 })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ── 고정 문구 ────────────────────────────────────────────────

describe('ExtensionSettings — 고정 문구 (컨셉 §15·§17)', () => {
  /**
   * 🔴 같은 문장이 동의 모달·개인정보처리방침·웹스토어 설명에도 있다. 한 글자라도 흐르면
   * 표면끼리 어긋나 「어디 말이 맞나」가 된다. 그래서 부분 일치가 아니라 전문 비교다.
   */
  it('§17 「설정 페이지(치뽀 연결)」 문장이 글자 그대로 있다', async () => {
    await renderLoaded()
    expect(screen.getByText(EXTENSION_INTRO)).toBeInTheDocument()
    expect(EXTENSION_INTRO).toBe(
      '연결하면 확장이 내 정보 창고를 읽어 폼에 채웁니다. AI 는 칸의 이름·종류만 보고, 개인정보는 보지 않습니다. 언제든 여기서 연결을 해제할 수 있습니다.',
    )
  })

  it('§15 「직접 확인」 꼬리 문장이 글자 그대로 있다', async () => {
    await renderLoaded()
    expect(screen.getByText(REVIEW_NOTICE)).toBeInTheDocument()
    expect(REVIEW_NOTICE).toBe(
      '채운 내용은 제출 전 직접 눈으로 확인하세요. 확인 없이 제출한 내용은 이용자 책임입니다.',
    )
  })

  it('「안 하는 일」 = 자동 제출·이동 없음을 명시한다', async () => {
    await renderLoaded()
    expect(screen.getByText('안 하는 일')).toBeInTheDocument()
    expect(
      screen.getByText(/대신 제출하거나 다음 단계로 넘기지 않아요/),
    ).toBeInTheDocument()
  })
})

// ── 연결 코드 ────────────────────────────────────────────────

describe('ExtensionSettings — 연결 코드 발급·카운트다운·만료', () => {
  it('초기: 「연결 코드 만들기」 버튼만, 코드 미표시', async () => {
    await renderLoaded()
    expect(
      screen.getByRole('button', { name: '연결 코드 만들기' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(PAIR.code)).toBeNull()
    expect(api.createPairCode).not.toHaveBeenCalled()
  })

  it('버튼 클릭 → pair 1회 호출 + 6자리 코드 + 남은 시간(ttlSeconds)', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))

    expect(await screen.findByText(PAIR.code)).toBeInTheDocument()
    expect(api.createPairCode).toHaveBeenCalledTimes(1)
    // 🔴 60 을 상수로 박지 않는다 — 서버가 준 ttlSeconds 가 분모다
    expect(screen.getByText('60초')).toBeInTheDocument()
  })

  it('시간이 흐르면 남은 초가 줄어든다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByText('55초')).toBeInTheDocument()
  })

  it('만료: 코드가 사라지고 「다시 만들기」가 뜬다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(screen.queryByText(PAIR.code)).toBeNull()
    expect(screen.getByText('연결 코드가 만료됐어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 만들기' })).toBeInTheDocument()
  })

  /**
   * 그 60초 사이에 확장이 코드를 교환했으면 새 연결이 목록에 붙어야 한다. 안 읽으면
   * 「아직 연결된 확장이 없어요」가 남아, 방금 성공한 연결을 사용자가 다시 시도한다.
   * 반대로 매 tick 마다 읽으면 60번 요청이다 — **딱 한 번**이 조건이다.
   */
  it('만료 시 목록을 다시 읽는다 — 정확히 1회', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()
    const before = api.listSessions.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    await waitFor(() =>
      expect(api.listSessions.mock.calls.length).toBe(before + 1),
    )

    // 만료 뒤에도 타이머는 돌지만 재조회는 더 이상 없다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(api.listSessions.mock.calls.length).toBe(before + 1)
  })

  it('「다시 만들기」 → 새 코드 + 카운트다운 리셋', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    api.createPairCode.mockResolvedValueOnce({ ...PAIR, code: '112233' })
    fireEvent.click(screen.getByRole('button', { name: '다시 만들기' }))

    expect(await screen.findByText('112233')).toBeInTheDocument()
    expect(screen.getByText('60초')).toBeInTheDocument()
    expect(api.createPairCode).toHaveBeenCalledTimes(2)
  })

  it('발급 실패 → 에러 토스트, 코드는 안 뜬다', async () => {
    api.createPairCode.mockRejectedValueOnce(new Error('429'))
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        '연결 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
      ),
    )
    expect(screen.queryByText(PAIR.code)).toBeNull()
  })
})

// ── 복사 ─────────────────────────────────────────────────────

describe('ExtensionSettings — 코드 복사', () => {
  it('복사 버튼 → 클립보드에 코드 + 「복사됨」', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)

    fireEvent.click(screen.getByRole('button', { name: '연결 코드 복사' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PAIR.code))
    expect(await screen.findByText('복사됨')).toBeInTheDocument()
  })

  /** 권한 거부·비보안 컨텍스트. 방어가 없으면 unhandled rejection 이 Sentry 에 크래시로 잡힌다 */
  it('클립보드 실패 → 에러 토스트 (rejection 이 새지 않는다)', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)

    fireEvent.click(screen.getByRole('button', { name: '연결 코드 복사' }))
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        '복사에 실패했어요. 코드를 직접 입력해 주세요.',
      ),
    )
    expect(screen.queryByText('복사됨')).toBeNull()
  })
})

// ── 목록 ─────────────────────────────────────────────────────

describe('ExtensionSettings — 연결된 기기 목록', () => {
  it('로딩 중: 스켈레톤 (스피너 금지) · 빈 상태 문구 미노출', () => {
    api.listSessions.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('아직 연결된 확장이 없어요.')).toBeNull()
  })

  it('빈 목록 → 빈 상태 안내', async () => {
    await renderLoaded()
    expect(
      await screen.findByText('아직 연결된 확장이 없어요.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/연결 코드 만들기\] 로 연결해 주세요/)).toBeInTheDocument()
  })

  /** 0건 화면에는 설명할 시각이 없다 — 빈 줄만 남기지 않는다 */
  it('KST 안내는 행이 있을 때만 붙는다', async () => {
    await renderLoaded()
    await screen.findByText('아직 연결된 확장이 없어요.')
    expect(screen.queryByText('시각은 한국 시간(KST) 기준이에요.')).toBeNull()
  })

  it('행이 있으면 KST 안내가 붙는다', async () => {
    api.listSessions.mockResolvedValue([SESSION])
    await renderLoaded()
    expect(
      await screen.findByText('시각은 한국 시간(KST) 기준이에요.'),
    ).toBeInTheDocument()
  })

  it('조회 실패 → 안내 + 「다시 시도」가 재조회', async () => {
    api.listSessions.mockRejectedValueOnce(new Error('500'))
    renderPage()

    expect(await screen.findByText('목록을 불러오지 못했어요.')).toBeInTheDocument()
    const before = api.listSessions.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() =>
      expect(api.listSessions.mock.calls.length).toBe(before + 1),
    )
  })

  it('행: 지문 8+8 · 연결일·마지막 사용 (KST)', async () => {
    api.listSessions.mockResolvedValue([SESSION])
    await renderLoaded()

    expect(await screen.findByText('ff73cf77 3b60405a')).toBeInTheDocument()
    expect(screen.getByText('연결 2026-09-06')).toBeInTheDocument()
    expect(screen.getByText('마지막 사용 2026-09-06')).toBeInTheDocument()
  })

  /**
   * 🔴 UTC 20:00 = KST 다음날 05:00. UTC 로 자르면 **하루 밀린다** — 치뽀는 KST 고정 앱이라
   * `@/utils/datetime` 만 쓴다 (CI KST 가드와 같은 판정).
   */
  it('KST 경계: UTC 전날 20시 → KST 기준 다음 날짜로 표시', async () => {
    api.listSessions.mockResolvedValue([
      { ...SESSION, createdAt: '2026-09-05T20:00:00.000Z', lastUsedAt: null },
    ])
    await renderLoaded()
    expect(await screen.findByText('연결 2026-09-06')).toBeInTheDocument()
  })

  it('한 번도 안 쓴 세션·지문 없는 세션도 깨지지 않는다', async () => {
    api.listSessions.mockResolvedValue([
      { ...SESSION, deviceFingerprint: null, lastUsedAt: null },
    ])
    await renderLoaded()

    expect(await screen.findByText('기기 정보 없음')).toBeInTheDocument()
    expect(screen.getByText('마지막 사용 기록 없음')).toBeInTheDocument()
  })
})

// ── 연결 해제 ────────────────────────────────────────────────

describe('ExtensionSettings — 연결 해제 확인 모달', () => {
  beforeEach(() => {
    api.listSessions.mockResolvedValue([SESSION])
  })

  it('「연결 해제」 → 확인 모달, API 는 아직 미호출', async () => {
    await renderLoaded()
    fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }))

    expect(
      screen.getByRole('dialog', { name: '연결 해제 확인' }),
    ).toBeInTheDocument()
    expect(api.disconnect).not.toHaveBeenCalled()
  })

  it('「취소」 → 모달 닫힘, API 미호출', async () => {
    await renderLoaded()
    fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('dialog', { name: '연결 해제 확인' })).toBeNull()
    expect(api.disconnect).not.toHaveBeenCalled()
  })

  /**
   * 🔴 **sessionId 가 반드시 실려야 한다.** 백엔드는 웹이 `sessionId` 없이 부르면 그 계정의
   * 확장을 **전부** 끊는다. 「이 기기만 해제」 버튼이 전부를 끊으면 사고다.
   */
  it('확정 → disconnect(sessionId) 호출 + 성공 토스트 + 모달 닫힘', async () => {
    await renderLoaded()
    fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }))

    const dialog = screen.getByRole('dialog', { name: '연결 해제 확인' })
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === '연결 해제',
    )!
    fireEvent.click(confirm)

    await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith(SESSION.id))
    expect(api.disconnect).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '연결 해제 확인' })).toBeNull(),
    )
    expect(toastMock.success).toHaveBeenCalledWith('연결을 해제했어요.')
  })

  it('해제 실패 → 에러 토스트 + 모달 유지 (다시 누를 수 있게)', async () => {
    api.disconnect.mockRejectedValueOnce(new Error('500'))
    await renderLoaded()
    fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }))

    const dialog = screen.getByRole('dialog', { name: '연결 해제 확인' })
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === '연결 해제',
    )!
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        '연결을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.',
      ),
    )
    expect(
      screen.getByRole('dialog', { name: '연결 해제 확인' }),
    ).toBeInTheDocument()
  })
})

// ── 접근성 · 모바일 모달 ─────────────────────────────────────

describe('ExtensionSettings — 접근성', () => {
  it('aria-live 가 발급된 코드를 알린다', async () => {
    await renderLoaded()
    const live = screen.getByRole('status')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live.textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await waitFor(() => expect(live.textContent).toContain('6 3 8 8 3 6'))
  })

  /**
   * 🔴 초 단위 숫자가 live 영역에 있으면 **1초마다 낭독**된다 — 화면을 못 보는 사람에게는
   * 안내가 아니라 소음이다. 남은 시간은 시각 표시(aria-hidden)로만 흐른다.
   */
  it('aria-live 영역에 초 단위 카운트다운이 들어가지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)

    const live = screen.getByRole('status')
    const first = live.textContent
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(live.textContent).toBe(first)
    expect(screen.getByText('55초').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('만료를 aria-live 가 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(screen.getByRole('status').textContent).toContain('만료')
  })

  it('아이콘 버튼에 접근 이름이 있다', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '연결 코드 만들기' }))
    await screen.findByText(PAIR.code)
    expect(
      screen.getByRole('button', { name: '연결 코드 복사' }),
    ).toBeInTheDocument()
  })
})

/**
 * 2026-08-30 iPhone 실사고 2종 (DESIGN.md 규칙 11·11-b). 공용 `Modal` 을 쓰면 둘 다 구조적으로
 * 막히지만, 나중에 누가 직접 `fixed inset-0` 을 그리면 조용히 재발하므로 화면 단위로 못 박는다.
 */
describe('ExtensionSettings — 모바일 모달 2결함', () => {
  beforeEach(() => {
    api.listSessions.mockResolvedValue([SESSION])
  })

  it('확인 모달에 자동 포커스 입력이 없다 (열자마자 키보드 ✕)', async () => {
    const { container } = await renderLoaded()
    fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }))

    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0)
    expect(container.querySelector('[autofocus]')).toBeNull()
  })

  it('오버레이 컨테이너에 하단 패딩이 없다 (탭바 위 검은 띠 ✕)', async () => {
    const { container } = await renderLoaded()
    fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }))

    const overlay = container.querySelector('.fixed.inset-0')!
    expect(overlay).not.toBeNull()
    expect(
      Array.from(overlay.classList).some((c) => /^(sm:)?pb-/.test(c)),
    ).toBe(false)
  })
})
