/**
 * 결과 시트 — 「이렇게 만들었어요」.
 *
 * ## 케이스 목록
 *
 * **내용**
 *  1. 회사·직무·계열 칩
 *  2. 전형 N단계 + 스텝 이름
 *  3. 🔴 날짜 대신 공고가 한 말(힌트)이 칸에 그대로 선다
 *  4. 🔴 「날짜가 나오면 적어 주세요」는 **힌트가 있는 행에만** (아무것도 없는 행에 붙이면 잔소리)
 *  5. orderConflict → 「순서를 확인해 주세요」
 *  6. 요건 개수 · 접었다 편다
 *
 * **캘린더 일정 블록**
 *  7. 「캘린더에 넣은 일정 N」 + 무엇이 왜 갔는지 캡션 + 목록
 *  8. 일정이 없으면 블록 자체가 없다
 *
 * **알림 상태 3분기**
 *  9. 아직 모름(로딩) → 아무 말도 안 한다
 * 10. 기기 없음 → 「앱에서 알림을 켜면」
 * 11. 기기는 있는데 꺼짐 → 「알림이 꺼져 있어요」 + 설정 링크
 * 12. 다 켜져 있으면 아무 말 없음
 *
 * **닫기**
 * 13. 「좋아요」 → reviewed 기록 + 닫힘
 * 14. 날짜를 고친 뒤 닫으면 editedFields 가 함께 간다
 * 14-b. 🔴 그냥 닫기는 검토가 아니다 (카드 상세 확인 줄이 폴백으로 남아야 한다)
 * 14-c. 고친 게 있으면 그냥 닫아도 검토 (첫 편집 = 확인)
 * 15. 🔴 데모에선 서버를 부르지 않는다 (백엔드 0)
 * 16. 「카드 열기」는 카드 상세로 가는 링크다
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const patchMeta = vi.fn()
vi.mock('@/api/jobPosting', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/jobPosting')>()),
  jobPostingCardApi: { patchMeta: (...a: unknown[]) => patchMeta(...a) },
}))

const updateStep = vi.fn()
vi.mock('@/hooks/useStepDetail', () => ({
  useUpdateStep: () => ({ mutate: updateStep }),
}))

let alarm: { hasDevice: boolean; enabled: boolean; imminentOn: boolean } | undefined
vi.mock('@/hooks/useNotifications', () => ({
  useAlarmStatus: () => ({ data: alarm }),
}))

let demo = false
vi.mock('@/contexts/demoMode', () => ({ useDemoMode: () => demo }))

/** 직무 없는 카드의 「‘X’로 채우기」 칩 — 내 희망 직무 */
let profileTitle: string | null = null
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { signupJobTitle: string | null } }) => unknown) =>
    sel({ user: { signupJobTitle: profileTitle } }),
}))
const updateApp = vi.fn()
vi.mock('@/api/applications', () => ({
  applicationsApi: { update: (...a: unknown[]) => updateApp(...a) },
}))

import { PostingResultSheet } from './PostingResultSheet'
import type { Application, ApplicationStep, PostingMeta } from '@/types/application'

const step = (over: Partial<ApplicationStep>): ApplicationStep => ({
  id: 's1',
  applicationId: 'app-1',
  orderIndex: 0,
  name: '서류 접수',
  scheduledDate: null,
  location: null,
  notes: null,
  pinnedContent: null,
  dateHint: null,
  ...over,
})

const meta = (over: Partial<PostingMeta> = {}): PostingMeta => ({
  filled: [],
  deadlineKind: null,
  jobPicked: 'single',
  companySource: 'parsed',
  editedFields: [],
  reviewedAt: null,
  extraDates: [],
  callCount: 1,
  ...over,
})

function app(over: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    userId: 'u1',
    companyName: '무신사',
    jobTitle: '브랜드 마케터',
    jobCategory: '마케팅·광고',
    status: 'IN_PROGRESS',
    jobUrl: null,
    memo: null,
    currentStepIndex: 0,
    needsDetail: false,
    isStarred: false,
    steps: [
      step({ id: 's1', orderIndex: 0, name: '서류 접수', scheduledDate: '2026-09-15T14:00:00+09:00' }),
      step({ id: 's2', orderIndex: 1, name: '필기 전형', dateHint: '9월 중 예정' }),
      step({ id: 's3', orderIndex: 2, name: '최종 합격' }),
    ],
    postingMeta: meta(),
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

const onClose = vi.fn()
const onOpenCard = vi.fn()
function renderSheet(a: Application = app()) {
  // 직무 없는 카드의 한 칸이 캐시(`['applications']`)를 갱신하므로 QueryClient 가 필요하다
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['applications'], [a])
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PostingResultSheet app={a} onClose={onClose} onOpenCard={onOpenCard} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  alarm = undefined
  demo = false
  profileTitle = null
  patchMeta.mockResolvedValue(null)
  updateApp.mockResolvedValue(null)
})
afterEach(cleanup)

/**
 * **직무 없는 카드** — 공고 본문에 직무가 없어(JD 가 PDF 첨부) 서버가 `jobTitle: null` 로 만든 카드
 * (CEO 실기 2026-08-29 SK하이닉스). 카드는 이미 있으니 막지 않고 **이 자리에서 한 칸만** 받는다.
 * 17. 직무가 비어 있으면 칸과 캡션이 선다 · 직무가 있으면 없다
 * 18. 「‘희망 직무’로 채우기」 칩 → 저장 1회 (`jobTitleSource: 'prefill'`) + 검토 표시(editedFields)
 * 19. 희망 직무가 없으면 칩도 없다 · 「좋아요」는 직무 없이도 눌린다(강제 아님)
 */
describe('직무 없는 카드', () => {
  it('17) 직무가 비어 있으면 칸이 서고, 있으면 없다', () => {
    renderSheet(app({ jobTitle: null, jobCategory: null }))
    expect(screen.getByText(/공고 본문엔 직무가 없어요/)).toBeInTheDocument()
    cleanup()
    renderSheet(app())
    expect(screen.queryByText(/공고 본문엔 직무가 없어요/)).toBeNull()
  })

  it('18) 희망 직무 칩 → 저장 1회 (prefill) + 검토로 센다', async () => {
    profileTitle = '백엔드 개발자'
    renderSheet(app({ jobTitle: null, jobCategory: null }))
    fireEvent.click(screen.getByRole('button', { name: /‘백엔드 개발자’로 채우기/ }))
    await waitFor(() =>
      expect(updateApp).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ jobTitle: '백엔드 개발자', jobTitleSource: 'prefill' }),
      ),
    )
    expect(updateApp).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '좋아요' }))
    await waitFor(() =>
      expect(patchMeta).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ reviewed: true, editedFields: ['jobTitle'] }),
      ),
    )
  })

  it('19) 희망 직무가 없으면 칩도 없고, 「좋아요」는 직무 없이도 눌린다', async () => {
    renderSheet(app({ jobTitle: null, jobCategory: null }))
    expect(screen.queryByRole('button', { name: /로 채우기/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '좋아요' }))
    await waitFor(() => expect(patchMeta).toHaveBeenCalledWith('app-1', { reviewed: true }))
    expect(updateApp).not.toHaveBeenCalled()
  })
})

describe('내용', () => {
  it('1·2) 회사·직무·계열 칩 + 전형 목록', () => {
    renderSheet()
    expect(screen.getByText('카드가 만들어졌어요 ✓')).toBeInTheDocument()
    expect(screen.getByText('무신사')).toBeInTheDocument()
    expect(screen.getByText('브랜드 마케터')).toBeInTheDocument()
    expect(screen.getByText('마케팅·광고 ✓')).toBeInTheDocument()
    expect(screen.getByText('전형 3단계')).toBeInTheDocument()
    expect(screen.getByText('필기 전형')).toBeInTheDocument()
  })

  it('3·4) 힌트가 칸에 서고, 안내는 힌트 있는 행에만 붙는다', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: /필기 전형 날짜 설정하기/ })).toHaveTextContent(
      '9월 중 예정',
    )
    // 힌트도 날짜도 없는 「최종 합격」 행엔 안 붙는다
    expect(screen.getAllByText('날짜가 나오면 적어 주세요')).toHaveLength(1)
  })

  it('5) 순서가 어긋나면 그 사실을 말한다', () => {
    renderSheet(app({ postingMeta: meta({ orderConflict: true }) }))
    expect(screen.getByRole('alert')).toHaveTextContent(/순서를 확인해 주세요/)
  })

  it('6) 요건 개수 · 접었다 편다', () => {
    const a = app({
      jobPosting: {
        responsibilities: '캠페인 기획',
        requirements: ['경력 3년'],
        preferred: [],
        techStack: ['GA4'],
        qualifications: [],
        keywords: [],
        parsedAt: '',
      },
    })
    renderSheet(a)
    const row = screen.getByRole('button', { name: /요건 3개 정리됨/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/자소서 탭에서 그대로 쓸 수 있어요/)).toBeInTheDocument()
  })

  it('6-b) 요건이 없으면 줄 자체가 없다', () => {
    renderSheet()
    expect(screen.queryByText(/요건 .*개 정리됨/)).toBeNull()
  })
})

describe('캘린더 일정 블록', () => {
  const withDates = () =>
    app({
      postingMeta: meta({
        extraDates: [
          { label: '서류 합격 발표', date: '2026-09-22T00:00:00+09:00', noteId: 'n1' },
          { label: '신체검사', date: '2026-10-30T14:00:00+09:00', noteId: 'n2' },
        ],
      }),
    })

  it('7) 개수·캡션·목록', () => {
    alarm = { hasDevice: true, enabled: true, imminentOn: true }
    renderSheet(withDates())
    expect(screen.getByText('캘린더에 넣은 일정 2')).toBeInTheDocument()
    expect(
      screen.getByText(/발표·검진은 스텝에 넣지 않고 캘린더에 자동으로 넣었어요/),
    ).toBeInTheDocument()
    expect(screen.getByText(/무신사 · 서류 합격 발표/)).toBeInTheDocument()
    expect(screen.getByText('10월 30일 (금) 14:00')).toBeInTheDocument()
  })

  it('7-b) 🔴 날짜만 온 일정에 시각을 지어내지 않는다 (서버 계약 형식)', () => {
    alarm = { hasDevice: true, enabled: true, imminentOn: true }
    renderSheet(
      app({
        postingMeta: meta({
          extraDates: [
            { label: '서류 합격 발표', date: '2026-09-22', noteId: 'n1' },
            { label: '신체검사', date: '2026-10-30T14:00', noteId: 'n2' },
          ],
        }),
      }),
    )
    expect(screen.getByText('9월 22일 (화)')).toBeInTheDocument()
    expect(screen.getByText('10월 30일 (금) 14:00')).toBeInTheDocument()
  })

  it('8) 일정이 없으면 블록도 없다', () => {
    renderSheet()
    expect(screen.queryByText(/캘린더에 넣은 일정/)).toBeNull()
  })

  it('9) 🔴 아직 모르면 아무 말도 안 한다', () => {
    alarm = undefined
    renderSheet(withDates())
    expect(screen.queryByText(/알림이 꺼져 있어요/)).toBeNull()
    expect(screen.queryByText(/앱에서 알림을 켜면/)).toBeNull()
  })

  it('10) 기기가 없으면 앱 안내', () => {
    alarm = { hasDevice: false, enabled: true, imminentOn: true }
    renderSheet(withDates())
    expect(screen.getByText('앱에서 알림을 켜면 폰으로도 알려드려요')).toBeInTheDocument()
  })

  it('11) 기기는 있는데 꺼져 있으면 설정 링크', () => {
    alarm = { hasDevice: true, enabled: true, imminentOn: false }
    renderSheet(withDates())
    expect(screen.getByText(/알림이 꺼져 있어요/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '설정 › 알림에서 켜기' })).toHaveAttribute(
      'href',
      '/settings/alarm',
    )
  })

  it('12) 다 켜져 있으면 아무 말 없음', () => {
    alarm = { hasDevice: true, enabled: true, imminentOn: true }
    renderSheet(withDates())
    expect(screen.queryByText(/알림이 꺼져 있어요/)).toBeNull()
    expect(screen.queryByText(/앱에서 알림을 켜면/)).toBeNull()
  })
})

describe('닫기', () => {
  it('13) 「좋아요」 → reviewed 기록 + 닫힘', async () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: '좋아요' }))
    await waitFor(() => expect(patchMeta).toHaveBeenCalledWith('app-1', { reviewed: true }))
    expect(onClose).toHaveBeenCalled()
  })

  it('14) 날짜를 고쳤으면 editedFields 가 함께 간다', async () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /필기 전형 날짜 설정하기/ }))
    fireEvent.change(screen.getByLabelText('일정 날짜 및 시간'), {
      target: { value: '2026-09-20T10:00' },
    })
    expect(updateStep).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '좋아요' }))
    await waitFor(() =>
      expect(patchMeta).toHaveBeenCalledWith('app-1', {
        reviewed: true,
        editedFields: ['steps'],
      }),
    )
  })

  it('14-b) 🔴 그냥 닫기(✕·Esc)는 검토가 아니다 — 확인 줄이 남아야 한다', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(patchMeta).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('14-c) 고친 게 있으면 그냥 닫아도 검토로 친다 (편집 = 확인)', async () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /필기 전형 날짜 설정하기/ }))
    fireEvent.change(screen.getByLabelText('일정 날짜 및 시간'), {
      target: { value: '2026-09-20T10:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    await waitFor(() =>
      expect(patchMeta).toHaveBeenCalledWith('app-1', {
        reviewed: true,
        editedFields: ['steps'],
      }),
    )
  })

  it('15) 🔴 데모는 서버를 부르지 않는다', () => {
    demo = true
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: '좋아요' }))
    expect(patchMeta).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('16) 「카드 열기」는 카드 상세 링크', () => {
    renderSheet()
    expect(screen.getByRole('link', { name: /카드 열기/ })).toHaveAttribute(
      'href',
      '/board/app-1',
    )
  })
})
