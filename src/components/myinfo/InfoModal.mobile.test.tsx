/**
 * InfoModal — **모바일(vaul Drawer)** 갈래의 시트 골격.
 *
 * 2026-09-01 iPhone: 키보드가 올라오면 시트에 140px 쯤만 남는데 헤더(emoji tile + 제목 + subtitle)가
 * 260px 를 **고정으로** 먹어 정작 입력칸이 안 보였다. 그래서 제목 묶음을 스크롤 본문 안으로 내리고,
 * 상단에는 drag handle + 닫기 X 만 남겼다. 그 골격이 유지되는지 본다.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 모바일: 제목(h3)이 `overflow-y-auto` 컨테이너 **안**에 있다 (같이 스크롤된다)
 *  2. 🔴 모바일: 저장/취소 푸터는 그 컨테이너 **밖**이다 (하단 고정)
 *  3. 🔴 모바일: 닫기 X 도 컨테이너 밖이다 (상단 고정 — 스크롤해도 항상 닿는다)
 *  4. 모바일: 스크롤 컨테이너에 `overscroll-contain` (뒤 페이지 scroll chaining 차단 — 프로젝트 규칙)
 *  5. 모바일: 폼 children 도 같은 컨테이너 안 (헤더와 한 몸으로 스크롤)
 *  6. 데스크탑 대조군: 제목은 컨테이너 **밖**이다 (헤더 고정 그대로 — 데스크탑 무변경 회귀 방지)
 *  7. 🔴 모바일: 포털된 시트 컨테이너가 `data-clarity-mask="true"` 를 가진다 (방침 §5-2)
 *
 * `useIsMobile` 을 통째로 mock 한다 — jsdom 은 matchMedia 가 없어 실제 훅은 늘 false(=데스크탑)다.
 * 🔴 **vaul 은 mock 하지 않는다** — 7) 이 증명할 것이 「`Drawer.Portal` 이 `document.body` 로 빼낸
 * 노드에 마스킹이 붙어 있나」라서, 포털을 흉내낸 래퍼 div 로는 결함(마스킹 밖)을 못 잡는다.
 * jsdom 에서도 vaul 은 `Drawer.Content` 를 body 에 포털하고 `role="dialog"` 로 잡힌다.
 * 데스크탑 갈래는 라우트 래퍼(`ClarityMask`)가 덮으므로 7) 의 대상이 아니다.
 */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InfoModal } from './InfoModal'

let mobile = true
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => mobile,
  useIsMobile: () => mobile,
}))

/** 이 요소를 감싸는 스크롤 컨테이너 (없으면 null) */
const scrollBox = (el: HTMLElement) => el.closest('.overflow-y-auto')

/** 눈에 보이는 제목(h3) — vaul 은 `Drawer.Title` 을 같은 이름의 sr-only h2 로도 렌더한다 */
const titleHeading = () => screen.getByRole('heading', { level: 3, name: '어학 성적' })

function renderModal() {
  render(
    <InfoModal
      title="어학 성적"
      emoji="🗣"
      accent="brand"
      subtitle="TOEIC · 900"
      onClose={vi.fn()}
      onSave={vi.fn()}
    >
      <input aria-label="점수" />
    </InfoModal>,
  )
}

beforeEach(() => { mobile = true })
afterEach(cleanup)

describe('InfoModal — 모바일 시트 골격 (2026-09-01 키보드 실사고)', () => {
  it('1) 제목이 스크롤 컨테이너 안에 있다', () => {
    renderModal()
    const heading = titleHeading()
    expect(scrollBox(heading)).not.toBeNull()
  })

  it('2) 푸터(저장·취소)는 스크롤 컨테이너 밖 — 하단 고정', () => {
    renderModal()
    expect(scrollBox(screen.getByRole('button', { name: '저장' }))).toBeNull()
    expect(scrollBox(screen.getByRole('button', { name: '취소' }))).toBeNull()
  })

  it('3) 닫기 X 는 스크롤 컨테이너 밖 — 상단 고정', () => {
    renderModal()
    expect(scrollBox(screen.getByRole('button', { name: '닫기' }))).toBeNull()
  })

  it('4) 스크롤 컨테이너에 overscroll-contain 이 붙어 있다', () => {
    renderModal()
    const box = scrollBox(titleHeading())
    expect(box?.className).toContain('overscroll-contain')
  })

  it('5) 폼 children 도 제목과 같은 컨테이너 안 — 한 몸으로 스크롤', () => {
    renderModal()
    const heading = titleHeading()
    const field = screen.getByLabelText('점수')
    expect(scrollBox(field)).toBe(scrollBox(heading))
  })

  it('6) 데스크탑은 제목이 컨테이너 밖 — 헤더 고정 그대로', () => {
    mobile = false
    renderModal()
    expect(scrollBox(titleHeading())).toBeNull()
    // 폼 칸은 데스크탑에서도 스크롤 컨테이너 안이다
    expect(scrollBox(screen.getByLabelText('점수'))).not.toBeNull()
  })

  it('7) 포털된 시트 컨테이너가 Clarity 마스킹 안이다 (방침 §5-2)', () => {
    renderModal()
    // 포털이라 render 컨테이너 밖 — document 전체에서 잡아야 의미가 있다
    const sheet = screen.getByRole('dialog', { name: '어학 성적' })
    expect(sheet.closest('[data-clarity-mask="true"]')).not.toBeNull()
    // 시트 안 텍스트(편집 부제 = 자격증명·회사명·학교명)도 같은 마스킹 안
    expect(
      titleHeading().closest('[data-clarity-mask="true"]'),
    ).not.toBeNull()
  })
})
