/**
 * 사용 환경 분포 카드.
 *
 * 시나리오:
 * - 4분류 인원·비율 표시 · 합계 = 전체
 * - 🔴 0명 세그먼트는 막대에 렌더하지 않는다 (0폭 조각이 경계선처럼 보인다)
 * - 앱 사용자 0명이면 푸시 줄 자체를 숨긴다 (0/0 은 의미 없는 정보)
 * - 푸시 미도달자가 있으면 경고 색
 * - 로딩 = 스켈레톤 · 회원 0명 빈 상태
 * - 반올림: 비율 합이 100 이 아닐 수 있다 — **인원수가 진실**이라 인원을 먼저 보여준다
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlatformDistributionCard } from './PlatformDistributionCard'
import type { PlatformDistribution } from '@/api/adminUsers'

const base: PlatformDistribution = {
  total: 10,
  both: 2,
  appOnly: 3,
  webOnly: 4,
  none: 1,
  appUsers: 5,
  pushCapable: 4,
}

describe('PlatformDistributionCard', () => {
  /**
   * ⚠️ 같은 숫자가 4분류와 알림 도달 양쪽에 뜰 수 있어(예: 웹만 4명 · 알림 허용 4명)
   * 전역 쿼리는 모호해진다. **섹션으로 스코프를 좁혀** 무엇을 검증하는지 분명히 한다.
   */
  it('4분류 인원과 전체가 표시된다', () => {
    render(<PlatformDistributionCard data={base} />)
    expect(screen.getByText('전체 10명')).toBeInTheDocument()
    const seg = within(screen.getByTestId('segments'))
    expect(seg.getByText('4명')).toBeInTheDocument() // 웹만
    expect(seg.getByText('3명')).toBeInTheDocument() // 앱만
    expect(seg.getByText('1명')).toBeInTheDocument() // 미접속
  })

  it('막대에 접근성 요약이 붙는다', () => {
    render(<PlatformDistributionCard data={base} />)
    expect(
      screen.getByLabelText('웹만 4명, 앱만 3명, 둘 다 2명, 미접속 1명'),
    ).toBeInTheDocument()
  })

  /** 0폭 div 가 남으면 얇은 선처럼 보여 "뭔가 있다" 는 오해를 준다 */
  it('0명 세그먼트는 막대에 그리지 않는다', () => {
    const { container } = render(
      <PlatformDistributionCard
        data={{ ...base, none: 0, total: 9, webOnly: 4, appOnly: 3, both: 2 }}
      />,
    )
    const bar = container.querySelector('[role="img"]')
    expect(bar?.children).toHaveLength(3)
  })

  describe('푸시 도달', () => {
    it('허용·미허용 인원을 나눠 보여준다', () => {
      render(<PlatformDistributionCard data={base} />)
      expect(screen.getByText('앱 사용자 5명')).toBeInTheDocument()
      const push = within(screen.getByTestId('push-rows'))
      expect(push.getByText('4명')).toBeInTheDocument() // 허용
      expect(push.getByText('1명')).toBeInTheDocument() // 미허용
    })

    it('미도달자가 있으면 몇 명에게 안 닿는지 알려준다', () => {
      render(<PlatformDistributionCard data={base} />)
      expect(
        screen.getByText('브리핑·마감 알림이 1명에게 닿지 않아요.'),
      ).toBeInTheDocument()
    })

    /**
     * 🔴 **"미허용 0" 을 "전원 허용" 으로 읽으면 안 된다.**
     * 기존 사용자의 앱 판정은 푸시 토큰으로 백필했으므로 백필된 사람은 정의상 전원 허용이다.
     * 화면이 그 한계를 스스로 말해야 오독이 안 생긴다.
     */
    it('전원 도달이면 백필 한계를 문구로 알린다', () => {
      render(<PlatformDistributionCard data={{ ...base, pushCapable: 5 }} />)
      expect(
        screen.getByText('알림을 거부한 앱 사용자는 다음 앱 로그인 후 집계돼요.'),
      ).toBeInTheDocument()
    })

    /** 앱 사용자가 없으면 "0 / 0명" 은 정보가 아니라 잡음이다 */
    it('앱 사용자가 0명이면 푸시 줄을 숨긴다', () => {
      render(
        <PlatformDistributionCard
          data={{ ...base, appOnly: 0, both: 0, appUsers: 0, pushCapable: 0 }}
        />,
      )
      expect(screen.queryByText('알림 도달')).toBeNull()
    })
  })

  describe('빈 상태·로딩', () => {
    it('회원 0명이면 안내 문구', () => {
      render(
        <PlatformDistributionCard
          data={{ total: 0, both: 0, appOnly: 0, webOnly: 0, none: 0, appUsers: 0, pushCapable: 0 }}
        />,
      )
      expect(screen.getByText('아직 회원이 없어요.')).toBeInTheDocument()
    })

    it('로딩 중엔 스켈레톤 (스피너 금지)', () => {
      const { container } = render(<PlatformDistributionCard data={undefined} isLoading />)
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })

    /** 배포 창에서 응답이 아직 없을 수 있다 — isLoading 이 false 여도 죽으면 안 된다 */
    it('data 가 undefined 인데 isLoading 도 false 면 스켈레톤으로 버틴다', () => {
      const { container } = render(<PlatformDistributionCard data={undefined} />)
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })
  })
})
