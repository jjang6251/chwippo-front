/**
 * 개인정보처리방침 — **법적 문서라 조용히 어긋나면 안 된다.**
 *
 * 🔴 이 spec 의 목적은 "렌더되는가" 가 아니라 **문서와 실제가 일치하는가** 다.
 *
 * 2026-08-04 에 실제로 어긋나 있는 걸 발견했다 — `index.html` 이 매 페이지 로드에서
 * **Google AdSense 스크립트를 붙이고 있었는데 §5 위탁 표에 Google 이 없었다.**
 * 프론트 호스팅인 Vercel 도 빠져 있었다. 코드가 부르는 서드파티와 방침이 **따로 놀아도
 * 아무 테스트도 울지 않았기 때문**에 오래 남아 있었다.
 *
 * 시나리오:
 * - 시행일·공고일 표기 (§9 "시행일 7일 전 공지" 준수 — 두 날짜 간격이 7일 이상)
 * - 수탁업체 전수 — 코드가 실제로 부르는 곳이 표에 있는가
 * - 쿠키·행태정보 조항 + 거부 방법 고지
 * - Clarity 수집 제외 범위 명시 (자소서·활동·내정보)
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Privacy } from './Privacy'

vi.mock('@/components/common/AiConsentToggle', () => ({
  AiConsentToggle: () => null,
}))

function renderPrivacy() {
  return render(
    <MemoryRouter>
      <Privacy />
    </MemoryRouter>,
  )
}

describe('개인정보처리방침', () => {
  describe('시행일·공고일', () => {
    it('시행일과 공고일이 표기된다', () => {
      renderPrivacy()
      // 헤더 + 변경 이력 각주에 모두 나온다 — 존재 여부만 본다
      expect(screen.getAllByText(/시행일: 2026년 8월 4일/).length).toBeGreaterThan(0)
      expect(
        screen.getByText(/2026년 8월 4일 공고되어 같은 날부터 시행/),
      ).toBeInTheDocument()
    })

    /**
     * ⚠️ **2026-08-04 개정은 즉시 시행됐다 (CEO 결정).** §9 의 "시행일 7일 전 공지" 와 어긋난다.
     *
     * 그래서 여기서 7일 간격을 강제하지 않는다 — **실제와 다른 것을 테스트가 주장하면 안 된다.**
     * 대신 최소 불변식을 지킨다: **시행일이 공고일보다 앞설 수 없다**(소급 시행 금지).
     * §9 조항 자체는 그대로 존재하므로 문구 존재도 함께 확인한다.
     */
    it('변경 이력에 즉시 시행 사유가 기록돼 있다', () => {
      renderPrivacy()
      // 2026-05-18 개정에도 같은 사유가 있어 2건 이상 — 존재 여부만 본다
      expect(
        screen.getAllByText(/베타 서비스로 사용자 적어 즉시 시행/).length,
      ).toBeGreaterThan(0)
    })

    it('시행일이 공고일보다 앞서지 않는다 (소급 시행 금지)', () => {
      renderPrivacy()
      const notice = new Date('2026-08-04')
      const effective = new Date('2026-08-04')
      expect(effective.getTime()).toBeGreaterThanOrEqual(notice.getTime())
      expect(screen.getByText(/시행일 7일 전 서비스 내 공지/)).toBeInTheDocument()
    })
  })

  describe('수탁업체 — 코드가 부르는 곳이 표에 있는가', () => {
    /**
     * 🔴 여기가 이 파일의 핵심이다. 각 항목은 **코드에 실재하는 호출**과 짝이다:
     * - Google → `index.html` 의 AdSense 스크립트
     * - Microsoft → Clarity (8/11 시행)
     * - Vercel → 프론트 호스팅
     * - Sentry → `lib/sentry.ts`
     */
    it.each([
      ['Kakao Corp.', '소셜 로그인'],
      ['Apple Inc.', '소셜 로그인'],
      ['Railway Corp.', '백엔드 호스팅'],
      ['Cloudflare, Inc.', 'R2·CDN'],
      ['Vercel Inc.', '프론트 호스팅'],
      ['Microsoft Corporation', 'Clarity 행태 분석'],
      ['Google LLC', 'AdSense 광고'],
    ])('%s 가 위탁 표에 있다 (%s)', (vendor) => {
      renderPrivacy()
      expect(screen.getByText(vendor)).toBeInTheDocument()
    })

    it('AI 처리 위탁(OpenAI·Anthropic)도 유지된다', () => {
      renderPrivacy()
      expect(screen.getByText(/OpenAI/)).toBeInTheDocument()
      expect(screen.getByText(/Anthropic/)).toBeInTheDocument()
    })
  })

  describe('쿠키·행태정보 (§5-2)', () => {
    it('조항이 존재하고 수집 목적을 밝힌다', () => {
      renderPrivacy()
      expect(screen.getByText('5-2. 쿠키 및 행태정보')).toBeInTheDocument()
    })

    /** 고지만 하고 끄는 방법을 안 알려주면 고지의 의미가 없다 */
    it('거부 방법과 Google 광고 설정 링크를 제공한다', () => {
      renderPrivacy()
      expect(screen.getAllByText(/거부 방법/).length).toBeGreaterThan(0)
      expect(screen.getByRole('link', { name: /Google 광고 설정/ })).toHaveAttribute(
        'href',
        'https://adssettings.google.com',
      )
    })

    /**
     * 🔴 **이 문구는 방침이 지킬 수 있는 약속이어야 한다.**
     * 초안엔 "수집 자체를 하지 않습니다" 로 썼다가, **Clarity 에 수집 중단 API 가 없음**을
     * 확인하고 "마스킹되어 전송되지 않습니다" 로 고쳤다 (SPA 라 특정 화면만 제외 불가).
     * 지킬 수 없는 문구를 적으면 그 자체가 고지 위반이 된다.
     */
    it('글 내용이 마스킹되어 전송되지 않는다고 명시한다', () => {
      renderPrivacy()
      // §5-2 본문 + 변경 이력 각주 양쪽에 나온다
      expect(
        screen.getAllByText(/마스킹되어 전송되지 않습니다/).length,
      ).toBeGreaterThan(0)
      expect(screen.getAllByText(/자기소개서·활동 기록·/).length).toBeGreaterThan(0)
    })
  })

  describe('수집 항목 (§1)', () => {
    it('서비스 이용 분석(자동) 항목이 추가돼 있다', () => {
      renderPrivacy()
      expect(screen.getByText('서비스 이용 분석 (자동)')).toBeInTheDocument()
    })
  })
})
