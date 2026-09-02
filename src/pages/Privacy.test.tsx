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
      expect(screen.getAllByText(/시행일: 2026년 9월 10일/).length).toBeGreaterThan(0)
      expect(
        screen.getByText(/2026년 9월 3일 공고되어 2026년 9월 10일부터 시행/),
      ).toBeInTheDocument()
    })

    /**
     * ⚠️ 2026-08-04 개정은 §9 의 "시행일 7일 전 공지" 와 어긋난 **즉시 시행**이었고(CEO 결정),
     * 그 주석은 "다음 개정 때 이 선례를 근거로 삼지 말 것" 이라고 남겼다.
     * 그래서 최근 개정(2026-09-03 공고 / 09-10 시행)은 다시 §9 를 지킨다 — 여기서 강제한다.
     * 과거 이력은 실제와 다르게 주장하면 안 되므로 그대로 남겨 둔다.
     */
    it('변경 이력에 즉시 시행 사유가 기록돼 있다', () => {
      renderPrivacy()
      // 2026-05-18 개정에도 같은 사유가 있어 2건 이상 — 존재 여부만 본다
      expect(
        screen.getAllByText(/베타 서비스로 사용자 적어 즉시 시행/).length,
      ).toBeGreaterThan(0)
    })

    it('🔴 최근 개정이 §9 를 지킨다 (공고 → 시행 7일 이상 · 소급 시행 금지)', () => {
      renderPrivacy()
      const notice = new Date('2026-09-03')
      const effective = new Date('2026-09-10')
      const days = (effective.getTime() - notice.getTime()) / 86_400_000
      expect(days).toBeGreaterThanOrEqual(7)
      expect(screen.getByText(/시행일 7일 전 서비스 내 공지/)).toBeInTheDocument()
      expect(
        screen.getByText(/공고일: 2026년 9월 3일 · 시행일: 2026년 9월 10일/),
      ).toBeInTheDocument()
    })
  })

  describe('수탁업체 — 코드가 부르는 곳이 표에 있는가', () => {
    /**
     * 🔴 여기가 이 파일의 핵심이다. 각 항목은 **코드에 실재하는 호출**과 짝이다:
     * - Google → `index.html` 의 AdSense 스크립트
     * - Microsoft → Clarity (8/11 시행)
     * - Vercel → 프론트 호스팅
     * - Sentry → `lib/sentry.ts`
     * - Meta → `lib/metaPixel.ts` (Meta Pixel · 2026-09-10 시행)
     */
    it.each([
      ['Kakao Corp.', '소셜 로그인'],
      ['Apple Inc.', '소셜 로그인'],
      ['Railway Corp.', '백엔드 호스팅'],
      ['Cloudflare, Inc.', 'R2·CDN'],
      ['Vercel Inc.', '프론트 호스팅'],
      ['Microsoft Corporation', 'Clarity 행태 분석'],
      ['Google LLC', 'AdSense 광고'],
      ['Meta Platforms, Inc.', 'Meta Pixel 맞춤형 광고'],
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
     * 🔴 **광고 도구를 늘리면 거부 경로도 같이 늘어야 한다.** Google 링크 하나만 두면
     * Meta 맞춤 광고는 끌 방법을 안내받지 못한 채 수집만 시작된다.
     */
    it('온라인 맞춤형 광고(Meta Pixel) 항목과 Meta 광고 설정 링크가 있다', () => {
      renderPrivacy()
      expect(screen.getAllByText(/온라인 맞춤형 광고/).length).toBeGreaterThan(0)
      expect(screen.getByRole('link', { name: /Meta 광고 설정/ })).toHaveAttribute(
        'href',
        'https://www.facebook.com/adpreferences',
      )
    })

    /** 행태정보는 보유 기간을 밝히지 않으면 고지가 완결되지 않는다 */
    it('행태정보 보유·이용 기간을 명시한다', () => {
      renderPrivacy()
      expect(screen.getAllByText(/보유·이용 기간/).length).toBeGreaterThan(0)
      expect(
        screen.getAllByText(/수집일로부터 최대 2년/).length,
      ).toBeGreaterThan(0)
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
