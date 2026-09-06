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
      expect(screen.getAllByText(/시행일: 2026년 9월 \S+일/).length).toBeGreaterThan(0)
      expect(
        screen.getByText(/이 방침은 2026년 9월 \S+일 공고되어 같은 날 시행됩니다/),
      ).toBeInTheDocument()
    })

    /**
     * 🔴 배포 게이트 — 1단계(창고 확장) 개정의 공고일·시행일은 CEO 가 확정한다. 그전까지 문서에
     * `__일` 플레이스홀더가 남아 있고, 그 상태로 배포하면 사용자에게 「9월 __일」이 그대로 보인다.
     * 이 테스트가 빨간 동안은 커밋·릴리즈 불가 — 날짜를 채우면 저절로 초록이 된다.
     */
    it('🔴 게이트 — 시행일 플레이스홀더(__일 · CEO 확정)가 화면에 남아 있지 않다', () => {
      const { container } = renderPrivacy()
      expect(container.textContent).not.toMatch(/__일|CEO 확정/)
    })

    /**
     * 🔴 1단계 개정은 **당일 시행**이다 (CEO 결정 · 공고일 = 시행일 = 2026-09-06). §9 의 "시행일 7일 전
     * 공지" 와 어긋나므로, 8/4 때와 같이 **사유를 하단 이력에 남기는 것까지가 한 세트**다 — 신규 항목은
     * 전부 선택 입력이고 민감정보(장애)는 이용자가 별도 동의를 누른 뒤에만 수집돼, 이용자 모르게
     * 시작되는 처리가 없다.
     *
     * 날짜를 못 박지 않고 **두 날짜가 같은지**만 본다 — 공고일 = 운영 배포일이라 main 머지가 다른 날이면
     * 그 날짜로 고쳐 릴리즈하기 때문. 플레이스홀더(`__일`)면 정규식이 안 맞아 여기서 빨간다.
     */
    it('1단계 개정은 당일 시행(CEO 결정) — 공고일 = 시행일 = 2026-09-06 이고 즉시 시행 사유가 하단 이력에 기록돼 있다', () => {
      renderPrivacy()
      // 하단 이력에서 창고 확장 개정 블록(장애 정보 별도 동의를 언급)을 찾아 날짜를 읽는다
      const block = screen.getByText(/장애 정보\(민감정보\) 별도 동의/).closest('p')
      const m = block?.textContent?.match(/공고일: 2026년 (\d{1,2})월 (\d{1,2})일 · 시행일: 2026년 (\d{1,2})월 (\d{1,2})일/)
      expect(m, '창고 확장 개정 블록의 공고일·시행일이 숫자로 채워져 있어야 한다').not.toBeNull()
      const notice = new Date(2026, Number(m![1]) - 1, Number(m![2]))
      const effective = new Date(2026, Number(m![3]) - 1, Number(m![4]))
      expect(effective.getTime(), '공고일과 시행일이 같은 날이어야 한다 (당일 시행)').toBe(
        notice.getTime(),
      )
      // 사유 없이 당일 시행만 적으면 §9 위반이 기록 없이 남는다
      expect(block?.textContent, '즉시 시행이라고 밝혀야 한다').toMatch(/즉시 시행/)
      expect(block?.textContent, '민감정보는 별도 동의 뒤에만 수집한다는 사유가 있어야 한다').toMatch(
        /별도 동의 뒤에만/,
      )
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

  /**
   * 1단계(내 정보 창고 확장 · 대장 44) — 코드가 실제로 저장하는 것과 문서가 일치해야 한다.
   *
   * 시나리오
   *  1. §1 프로필 행에 새 항목(영문 이름·주소·국적·보훈·병역 상세)이 있다
   *  2. §1 비상 연락처 행 — 제3자 정보라는 점을 밝힌다
   *  3. §1 장애 정보 행 — 「별도 동의」 · 각주가 「원칙적으로 수집하지 않는다 + 장애 정보 예외」로 바뀌었다
   *     (옛 각주 「민감정보는 수집하지 않습니다」 단정문이 남아 있으면 장애 수집과 정면 모순)
   *  4. 고유식별정보(주민등록번호 등) 미수집·입력 차단 명시 — 확장 규칙 「주민번호류 저장 금지」의 문서 짝
   *  5. §2 가명처리 통계 · §3 철회 시 즉시 삭제 · §6 철회 파기 · §7 철회 방법(경로) — 동의/철회 짝이 문서에도 있다
   *  6. §6-1 안전성 확보조치 — 암호화 + 「프로필 항목은 AI 에 전달되지 않는다」(getSafeDumpForAi 가 프로필을 안 읽는 것과 일치)
   *  7. 확장(브라우저 확장) 조항 §5-3 은 2단계 릴리즈 몫 — 1단계 문서에 없어야 한다
   */
  describe('내 정보 창고 확장 (1단계 · 대장 44)', () => {
    it('§1 프로필 행에 영문 이름·주소·국적·보훈·병역 상세가 있다', () => {
      renderPrivacy()
      const row = screen.getByText(/실명·한자 이름·영문 이름/)
      expect(row.textContent).toMatch(/주소\(우편번호/)
      expect(row.textContent).toMatch(/국적/)
      expect(row.textContent).toMatch(/보훈 대상 여부/)
      expect(row.textContent).toMatch(/계급·병과/)
    })

    it('§1 비상 연락처 행 — 제3자 정보임을 밝힌다', () => {
      renderPrivacy()
      expect(screen.getByText('내 정보 창고 — 비상 연락처 (선택)')).toBeInTheDocument()
      expect(screen.getByText(/가족 등 제3자의 정보/)).toBeInTheDocument()
    })

    /**
     * 🔴 창고에서 「추가 정보(취미·특기)」 칸을 없애고 「논문 정보」로 바꿨다. 방침 §1 은
     * **수집하는 항목만** 적어야 한다 — 없어진 칸이 남아 있으면 「수집한다고 적어 놓고 안 받는」
     * 과대 고지가 되고, 새로 받는 칸이 빠져 있으면 미고지가 된다. 둘 다 이 한 건이 막는다.
     */
    it('§1 자격·이력 행 — 논문 정보가 있고, 없어진 「추가 정보(취미·특기)」 문구는 남아 있지 않다', () => {
      const { container } = renderPrivacy()
      const row = screen.getByText(/자격증·어학·상장·학력/)
      expect(row.textContent).toMatch(/논문 정보\(지도교수·연구 분야·논문 제목·요약, 대학원 지원 시\)/)
      expect(container.textContent).not.toMatch(/취미·특기/)
    })

    it('§1 장애 정보 행은 별도 동의 · 각주는 「원칙적으로」 + 장애 예외 (단정문 모순 제거)', () => {
      renderPrivacy()
      expect(screen.getByText('내 정보 창고 — 장애 정보 (선택 · 별도 동의)')).toBeInTheDocument()
      expect(screen.getByText(/원칙적으로 수집하지 않습니다\. 다만/)).toBeInTheDocument()
      expect(screen.queryByText(/시행령 18조 민감정보.*는 수집하지 않습니다\.$/)).toBeNull()
    })

    it('고유식별정보(주민등록번호 등)는 수집·저장하지 않고 입력이 차단된다고 명시한다', () => {
      renderPrivacy()
      expect(screen.getByText(/주민등록번호·여권번호·운전면허번호·외국인등록번호는 어떤 경우에도/)).toBeInTheDocument()
    })

    it('동의/철회 짝 — §2 가명 통계 · §3 즉시 삭제 · §6 파기 · §7 철회 경로', () => {
      renderPrivacy()
      expect(screen.getByText(/가명처리한 정보\(출생 연도·거주 지역·병역/)).toBeInTheDocument()
      // §3 본문 + 하단 이력에 같은 문구가 있어 2곳 이상 — 존재 여부만 본다
      expect(screen.getAllByText(/동의 철회 시 즉시 삭제/).length).toBeGreaterThan(0)
      expect(screen.getByText(/장애 정보: 동의 철회 즉시 삭제/)).toBeInTheDocument()
      expect(screen.getByText(/민감정보\(장애 정보\) 동의 철회 — 내 정보 창고 › 우대·기타/)).toBeInTheDocument()
    })

    it('§6-1 안전성 확보조치 — 암호화 + 프로필 항목은 AI 에 전달되지 않는다', () => {
      renderPrivacy()
      expect(screen.getByText('6-1. 개인정보의 안전성 확보조치')).toBeInTheDocument()
      expect(screen.getByText('AES-256-GCM')).toBeInTheDocument()
      expect(screen.getByText(/AI 처리에 전달되지 않습니다\./)).toBeInTheDocument()
    })

    it('확장(브라우저 확장) 조항은 1단계 문서에 없다 — 2단계 릴리즈 몫', () => {
      renderPrivacy()
      expect(screen.queryByText(/5-3\. 지원서 자동 입력 기능/)).toBeNull()
      expect(screen.queryByText(/브라우저 확장/)).toBeNull()
    })
  })

})
