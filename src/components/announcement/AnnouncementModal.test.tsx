/**
 * 공지 모달 — **읽고 닫는 글**을 **눌러서 가 보는 글**로 바꾸는 자리.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *
 * **종류 칩**
 *  1. feature → 「새 기능」 (NEW 알약과 같은 채움 토큰)
 *  2. improvement → 「개선」
 *  3. fix → 「수정」
 *  4. 🔴 notice → 칩이 아예 없다 (기본값에 이름표를 달면 나머지가 흔해진다)
 *
 * **CTA**
 *  5. cta 있으면 주 버튼이 라벨 · 부 버튼 「나중에」 · 「확인했어요」는 없다
 *  6. 주 버튼 → 이동 + dismiss
 *  7. 「나중에」 → dismiss 만 (이동 없음)
 *  8. cta 없으면 「확인했어요」 하나
 *  9. 🔴 라벨만 있고 경로가 없으면 CTA 를 안 그린다 (짝이 깨진 데이터)
 *
 * **본문 조판**
 * 10. `- ` 로 시작하는 줄들은 목록 항목이 된다
 * 11. 빈 줄은 문단을 나눈다
 * 12. 🔴 HTML 은 해석하지 않는다 — 글자 그대로 보인다
 * 13. 짧은 본문(40자 이하·한 줄)은 가운데
 * 14. 40자 넘으면 왼쪽
 * 15. 두 줄 이상이면 (짧아도) 왼쪽
 *
 * **모달 기본기**
 * 16. Escape → dismiss
 * 17. 주 버튼에 autoFocus
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnnouncementModal } from './AnnouncementModal'
import type { AnnouncementKind } from '@/types/announcement'

const navigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

const onDismiss = vi.fn()

function renderModal(over: {
  kind?: AnnouncementKind
  title?: string
  body?: string
  ctaLabel?: string | null
  ctaPath?: string | null
} = {}) {
  return render(
    <MemoryRouter>
      <AnnouncementModal
        title={over.title ?? '제목'}
        body={over.body ?? '짧은 본문'}
        kind={over.kind ?? 'notice'}
        ctaLabel={over.ctaLabel ?? null}
        ctaPath={over.ctaPath ?? null}
        onDismiss={onDismiss}
      />
    </MemoryRouter>,
  )
}

/** 본문 스크롤 상자 — 정렬(가운데/왼쪽)이 여기 걸린다 */
function bodyBox(container: HTMLElement) {
  return container.querySelector('.overflow-y-auto') as HTMLElement
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('AnnouncementModal — 종류 칩', () => {
  it('1) feature → 「새 기능」, NEW 알약과 같은 채움 토큰', () => {
    renderModal({ kind: 'feature' })
    const chip = screen.getByText('새 기능')
    expect(chip).toBeInTheDocument()
    expect(chip.className).toContain('bg-accent-fill')
    expect(chip.className).toContain('text-accent-fill-ink')
  })

  it('2) improvement → 「개선」', () => {
    renderModal({ kind: 'improvement' })
    expect(screen.getByText('개선')).toBeInTheDocument()
  })

  it('3) fix → 「수정」', () => {
    renderModal({ kind: 'fix' })
    expect(screen.getByText('수정')).toBeInTheDocument()
  })

  it('4) notice → 칩 없음', () => {
    renderModal({ kind: 'notice' })
    expect(screen.queryByText('안내')).not.toBeInTheDocument()
    expect(screen.queryByText('새 기능')).not.toBeInTheDocument()
  })
})

describe('AnnouncementModal — CTA', () => {
  it('5) cta 있으면 주 버튼 = 라벨 · 부 버튼 「나중에」 · 「확인했어요」 없음', () => {
    renderModal({ ctaLabel: '지금 해보기', ctaPath: '/board?add=posting' })
    expect(screen.getByRole('button', { name: '지금 해보기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '나중에' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '확인했어요' })).not.toBeInTheDocument()
  })

  it('6) 주 버튼 → 이동 + dismiss', () => {
    renderModal({ ctaLabel: '지금 해보기', ctaPath: '/board?add=posting' })
    fireEvent.click(screen.getByRole('button', { name: '지금 해보기' }))
    expect(navigate).toHaveBeenCalledWith('/board?add=posting')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('7) 「나중에」 → dismiss 만, 이동 없음', () => {
    renderModal({ ctaLabel: '지금 해보기', ctaPath: '/board?add=posting' })
    fireEvent.click(screen.getByRole('button', { name: '나중에' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('8) cta 없으면 「확인했어요」 하나', () => {
    renderModal()
    expect(screen.getByRole('button', { name: '확인했어요' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '나중에' })).not.toBeInTheDocument()
  })

  it('9) 라벨만 있고 경로가 없으면 CTA 를 안 그린다', () => {
    renderModal({ ctaLabel: '지금 해보기', ctaPath: null })
    expect(screen.queryByRole('button', { name: '지금 해보기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '확인했어요' })).toBeInTheDocument()
  })
})

describe('AnnouncementModal — 본문 조판', () => {
  it('10) `- ` 줄들은 목록 항목이 된다', () => {
    const { container } = renderModal({
      body: '이런 게 생겼어요\n\n- 공고 붙여넣기\n- 마감일 자동 채움',
    })
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('공고 붙여넣기')
    expect(items[1].textContent).toBe('마감일 자동 채움')
  })

  it('11) 빈 줄은 문단을 나눈다', () => {
    const { container } = renderModal({ body: '첫 문단이에요.\n\n둘째 문단이에요.' })
    const paras = container.querySelectorAll('p')
    expect(paras).toHaveLength(2)
    expect(paras[0].textContent).toBe('첫 문단이에요.')
    expect(paras[1].textContent).toBe('둘째 문단이에요.')
  })

  it('12) HTML 은 해석하지 않는다 — 글자 그대로', () => {
    const { container } = renderModal({ body: '<b>굵게</b>' })
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('<b>굵게</b>')).toBeInTheDocument()
  })

  it('13) 짧은 한 줄 본문은 가운데', () => {
    const { container } = renderModal({ body: '오늘 밤 잠깐 멈춰요.' })
    expect(bodyBox(container).className).toContain('text-center')
  })

  it('14) 40자 넘으면 왼쪽', () => {
    const { container } = renderModal({ body: '가'.repeat(41) })
    expect(bodyBox(container).className).toContain('text-left')
  })

  it('15) 두 줄 이상이면 짧아도 왼쪽', () => {
    const { container } = renderModal({ body: '한 줄\n두 줄' })
    expect(bodyBox(container).className).toContain('text-left')
  })
})

describe('AnnouncementModal — 모달 기본기', () => {
  it('16) Escape → dismiss', () => {
    renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('17) 주 버튼에 포커스가 잡혀 있다', () => {
    renderModal({ ctaLabel: '지금 해보기', ctaPath: '/board' })
    // 포커스는 대화상자 자체 — 버튼 autoFocus 는 열리자마자 focus-visible 링을 띄운다 (2026-08-30 실측)
    expect(screen.getByRole('dialog')).toHaveFocus()
    expect(screen.getByRole('button', { name: '지금 해보기' })).not.toHaveFocus()
  })
})
