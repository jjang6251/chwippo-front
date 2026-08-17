import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JobSiteChips } from './JobSiteChips'
import { JOB_SITES } from '@/utils/jobSites'

/**
 * 공고 사이트 바로가기 허브 — plans/jobsite-hub.md 시나리오의 spec 변환.
 *
 * 🔴 이 기능의 보안 표면은 **외부 링크 하나뿐**이다 (`rel` 누락 = tabnabbing).
 * 🔴 계측은 판정의 전부다 — placement 인코딩이 빠지면 「기능이 죽었는지 자리가
 *    죽었는지」를 못 가려서 2주 뒤 판정이 불가능해진다.
 */
const h = vi.hoisted(() => ({
  isDemo: false,
  track: vi.fn(),
}))
vi.mock('@/contexts/demoMode', () => ({ useDemoMode: () => h.isDemo }))
vi.mock('@/lib/clarity', () => ({ trackClarityEvent: h.track }))

describe('JobSiteChips', () => {
  beforeEach(() => {
    h.isDemo = false
    h.track.mockClear()
  })

  it('5개 사이트가 확정 순서대로 렌더된다 (잡코리아→사람인→자소설→캐치→링커리어)', () => {
    render(<JobSiteChips placement="calendar" />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    expect(links.map((l) => l.textContent)).toEqual([
      '잡코리아',
      '사람인',
      '자소설닷컴',
      '캐치',
      '링커리어',
    ])
  })

  it('href 가 상수의 url 과 정확히 일치한다 (도메인 5종 단언)', () => {
    render(<JobSiteChips placement="calendar" />)
    for (const site of JOB_SITES) {
      expect(screen.getByRole('link', { name: new RegExp(site.name) })).toHaveAttribute(
        'href',
        site.url,
      )
    }
  })

  it('🔴 전 링크에 target=_blank + rel="noopener noreferrer" — tabnabbing 차단', () => {
    render(<JobSiteChips placement="calendar" />)
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('🔴 클릭 → jobhub_{site}_{placement} 발송 — placement 가 인코딩돼야 자리 판정이 된다', () => {
    render(<JobSiteChips placement="calendar" />)
    fireEvent.click(screen.getByRole('link', { name: /잡코리아/ }))
    expect(h.track).toHaveBeenCalledWith('jobhub_jobkorea_calendar')
  })

  it.each(['emptyDeadline', 'emptyBoard'] as const)(
    'placement=%s — 같은 사이트 클릭이 다른 이벤트 이름을 만든다',
    (placement) => {
      render(<JobSiteChips placement={placement} />)
      fireEvent.click(screen.getByRole('link', { name: /사람인/ }))
      expect(h.track).toHaveBeenCalledWith(`jobhub_saramin_${placement}`)
    },
  )

  it('🔴 데모 모드 — 렌더는 그대로, 계측만 미발송 (판정 오염 방지)', () => {
    h.isDemo = true
    render(<JobSiteChips placement="calendar" />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
    fireEvent.click(screen.getByRole('link', { name: /잡코리아/ }))
    expect(h.track).not.toHaveBeenCalled()
  })

  it('파비콘 onError → 이니셜 fallback (CompanyAvatar 정책)', () => {
    render(<JobSiteChips placement="calendar" />)
    const link = screen.getByRole('link', { name: /캐치/ })
    const img = link.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)
    expect(link.querySelector('img')).toBeNull()
    expect(link.textContent).toContain('캐') // 이니셜
  })

  it('빈 상태 placement 는 유도 문구, 캘린더는 인라인 라벨', () => {
    const { rerender } = render(<JobSiteChips placement="emptyBoard" />)
    expect(screen.getByText('공고부터 둘러볼까요?')).toBeInTheDocument()
    expect(screen.queryByText('공고 사이트')).not.toBeInTheDocument()
    rerender(<JobSiteChips placement="calendar" />)
    expect(screen.getByText('공고 사이트')).toBeInTheDocument()
    expect(screen.queryByText('공고부터 둘러볼까요?')).not.toBeInTheDocument()
  })

  it('접근성 — nav 랜드마크 + 터치 타겟 확장(before:-inset-y-1) + 시각 h-9', () => {
    render(<JobSiteChips placement="calendar" />)
    expect(
      screen.getByRole('navigation', { name: '공고 사이트 바로가기' }),
    ).toBeInTheDocument()
    const cls = screen.getByRole('link', { name: /잡코리아/ }).className
    expect(cls).toContain('h-9')
    // 🔴 세로만 확장한다 — 칩 간격 8px 라 가로 확장은 히트 영역이 겹친다
    expect(cls).toContain('before:-inset-y-1.5')
    expect(cls).not.toContain('before:-inset-x')
  })

  /**
   * 🔴 세로 「약간 스크롤」 회귀 가드 (2026-08-17 CEO 실기 발견).
   * `overflow-x-auto` 는 CSS 규칙상 `overflow-y: visible` 을 **강제로 auto** 로 만든다.
   * 터치 확장 pseudo(±4px)가 삐져나오면 39>36 으로 세로가 스크롤된다 —
   * 스크롤 컨테이너의 `py-1.5 -my-1.5` 가 그걸 패딩으로 품는다. jsdom 은 레이아웃을 모르니
   * 클래스로 고정한다 (실측은 /uiux 의 scrollHeight 검사).
   */
  it('🔴 스크롤 컨테이너가 py-1.5 -my-1.5 로 터치 확장을 품는다 (세로 스크롤 방지)', () => {
    render(<JobSiteChips placement="calendar" />)
    const scroller = screen
      .getByRole('navigation', { name: '공고 사이트 바로가기' })
      .querySelector('.overflow-x-auto')
    expect(scroller?.className).toContain('py-1.5')
    expect(scroller?.className).toContain('-my-1.5')
  })

  /**
   * 🔴 중앙 정렬은 `justify-center` 금지 — 넘칠 때 **왼쪽 끝이 잘려 스크롤로도 못 간다**
   * (flex 시작점이 음수 좌표). 빈 보드의 420px 래퍼에선 항상 넘쳐 잡코리아가 실제로 잘렸다.
   * 안쪽 `w-max` + `mx-auto` 패턴만 허용한다.
   */
  it('🔴 centered 변형은 w-max+mx-auto — justify-center 를 쓰지 않는다', () => {
    render(<JobSiteChips placement="emptyBoard" />)
    const nav = screen.getByRole('navigation', { name: '공고 사이트 바로가기' })
    expect(nav.querySelector('.justify-center')).toBeNull()
    const inner = nav.querySelector('.w-max')
    expect(inner?.className).toContain('mx-auto')
  })
})
