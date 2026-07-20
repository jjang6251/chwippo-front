/**
 * card-detail-remodel — JobPostingBanner variant="section" (카드 상세) spec.
 *
 * 시나리오:
 *   요건 있음 → 헤더 "요건 N개 정리됨" · 펼치면 요건 표시 + 액션
 *   접힘 기본(expanded=false) → 본문 숨김
 *   요건 없음(readOnly 아님) → "미정리" 힌트 + 파싱 유도 CTA → 모달
 *   요건 없음 + readOnly → 미렌더(null)
 *   정리 중(parsing) → "정리 중…" + 스켈레톤
 *   toggle → onToggle 호출 / 수정·삭제 액션 (readOnly 시 미노출)
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DemoModeContextProvider } from '@/contexts/demoMode'
import type { JobPosting } from '@/api/jobPosting'

vi.mock('@/hooks/useJobPosting', () => ({
  useDeleteJobPosting: () => ({ mutate: vi.fn(), isPending: false }),
  useParseJobPosting: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateJobPosting: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/components/coverletter/JobPostingModal', () => ({
  JobPostingModal: ({ mode }: { mode: string }) => <div data-testid="jp-modal">{mode}</div>,
}))

import { JobPostingBanner } from './JobPostingBanner'

const makeJP = (over: Partial<JobPosting> = {}): JobPosting => ({
  responsibilities: '서버 API 개발 및 운영',
  requirements: ['Java/Kotlin 3년', 'MSA 경험'],
  preferred: [],
  techStack: ['Spring', 'Kafka', 'MySQL'],
  qualifications: [],
  keywords: [],
  parsedAt: '2026-07-15T00:00:00+09:00',
  ...over,
})

function renderSection(props: Partial<React.ComponentProps<typeof JobPostingBanner>> = {}) {
  return render(
    <JobPostingBanner
      variant="section"
      applicationId="app-1"
      jobPosting={makeJP()}
      jobPostingStatus={null}
      readOnly={false}
      expanded
      onToggle={vi.fn()}
      {...props}
    />,
  )
}

// 토글 헤더 버튼은 aria-expanded 로 유일 식별 (CTA·액션 버튼과 구분)
const toggle = (expanded: boolean) => screen.getByRole('button', { expanded })

describe('JobPostingBanner — variant="section"', () => {
  it('요건 있음 → 헤더 "요건 N개 정리됨" (담당업무1+자격요건2+기술3 = 6)', () => {
    renderSection({ expanded: false })
    expect(toggle(false)).toHaveTextContent('요건 6개 정리됨')
  })

  it('펼침 → 요건 섹션·칩 표시 + 정리 시각', () => {
    renderSection({ expanded: true })
    expect(screen.getByText('담당업무')).toBeInTheDocument()
    expect(screen.getByText('서버 API 개발 및 운영')).toBeInTheDocument()
    expect(screen.getByText('자격요건 (필수)')).toBeInTheDocument()
    expect(screen.getByText('Spring')).toBeInTheDocument()
    expect(screen.getByText(/회원님의 지원 준비에만 활용돼요/)).toBeInTheDocument()
  })

  it('접힘(expanded=false) → 본문(담당업무) 숨김', () => {
    renderSection({ expanded: false })
    expect(screen.queryByText('담당업무')).not.toBeInTheDocument()
  })

  it('토글 클릭 → onToggle 호출', () => {
    const onToggle = vi.fn()
    renderSection({ onToggle, expanded: false })
    fireEvent.click(toggle(false))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('요건 없음(readOnly 아님) → "미정리" + 파싱 유도 CTA → 모달(create)', () => {
    renderSection({ jobPosting: null, expanded: true })
    expect(toggle(true)).toHaveTextContent('미정리')
    const cta = screen.getByRole('button', { name: /공고 요건 정리하기/ })
    fireEvent.click(cta)
    expect(screen.getByTestId('jp-modal')).toHaveTextContent('create')
  })

  it('요건 없음 + readOnly → 미렌더(null)', () => {
    const { container } = renderSection({ jobPosting: null, readOnly: true })
    expect(container.querySelector('section')).toBeNull()
    expect(screen.queryByText(/공고 요건/)).not.toBeInTheDocument()
  })

  it('정리 중(parsing) → "정리 중…" 힌트 + 스켈레톤', () => {
    renderSection({ jobPosting: null, jobPostingStatus: 'parsing', expanded: true })
    expect(toggle(true)).toHaveTextContent('정리 중')
    expect(screen.getByLabelText('공고 요건 정리 중')).toBeInTheDocument()
  })

  it('요건 있음 + 펼침 + 편집 가능 → 수정/다시 정리/삭제 액션 · 수정→모달(edit)', () => {
    renderSection({ expanded: true })
    expect(screen.getByRole('button', { name: '다시 정리' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    expect(screen.getByTestId('jp-modal')).toHaveTextContent('edit')
  })

  it('요건 있음 + readOnly → 액션 미노출 (보기 전용)', () => {
    renderSection({ expanded: true, readOnly: true })
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    // 표시는 유지
    expect(screen.getByText('담당업무')).toBeInTheDocument()
  })
})

describe('JobPostingBanner — 데모 더미 고지 (데모에서만)', () => {
  const NOTICE = /예시용 더미 공고 요건이에요 — 실제 채용 공고가 아닙니다/
  const renderWithDemo = (
    demo: boolean,
    props: Partial<React.ComponentProps<typeof JobPostingBanner>> = {},
  ) =>
    render(
      <DemoModeContextProvider value={demo}>
        <JobPostingBanner
          variant="section"
          applicationId="app-1"
          jobPosting={makeJP()}
          readOnly={false}
          expanded
          onToggle={vi.fn()}
          {...props}
        />
      </DemoModeContextProvider>,
    )

  it('데모 + section + 펼침 → 요건 하단 고지 노출', () => {
    renderWithDemo(true)
    expect(screen.getByText(NOTICE)).toBeInTheDocument()
  })

  it('데모 + banner variant → 고지 노출 (양쪽 variant 적용)', () => {
    renderWithDemo(true, { variant: 'banner' })
    expect(screen.getByText(NOTICE)).toBeInTheDocument()
  })

  it('실서비스(데모 아님) → 고지 절대 미노출 (박제)', () => {
    renderWithDemo(false)
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
  })

  it('데모라도 접힘(expanded=false) → 고지 미노출 (표시 하단에만)', () => {
    renderWithDemo(true, { expanded: false })
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument()
  })
})
