import { test, expect } from '@playwright/test'
import { mockAuth, mockAuthFail } from './helpers/auth'

test.describe('랜딩 페이지', () => {
  test('비로그인 상태에서 Hero, 기능 소개, CTA 표시', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/')

    await expect(page.getByText('치뽀').first()).toBeVisible()
    // Hero 슬로건
    await expect(page.getByText(/취업 준비/).first()).toBeVisible()
    // 카카오 로그인 CTA 버튼
    await expect(page.getByText(/카카오로 무료 시작/).first()).toBeVisible()
  })

  // 캘린더 UX 재구성 — 홈 = /calendar (대시보드는 회고 페이지로 강등). 로그인 상태 랜딩 진입 시 /calendar 로 이동.
  /**
   * 🔴 **랜딩은 인증이 필요한 API 를 부르면 안 된다** (2026-08-09).
   *
   * 히어로·섹션을 스크린샷에서 **실제 컴포넌트**로 바꾸면서 `InterviewQuestionCard` 가
   * `useAiQuotaBlocked → useMyAiQuota → useMyAiQuotas`(`refetchOnMount: 'always'`)를 타
   * **비로그인 방문자가 `/me/ai-quotas` 를 호출**했다. 401 이 나자 refresh 재시도까지
   * 연쇄돼 **요청 7건 + "많은 새로고침 요청" 토스트**가 떴다.
   *
   * 훅 하나만 보고 "query 0" 이라 단정한 게 원인이다 — **한 단계 아래에 있었다.**
   * 컴포넌트를 추가할 때마다 밟을 함정이라 요청 자체를 세어 막는다.
   */
  test('🔴 비로그인 랜딩은 auth/refresh 외에 백엔드를 부르지 않는다', async ({ page }) => {
    const calls: string[] = []
    page.on('request', (r) => {
      const u = new URL(r.url())
      if (u.port === '3000') calls.push(`${r.method()} ${u.pathname}`)
    })
    await mockAuthFail(page)
    await page.goto('/')
    await page.waitForTimeout(2000)

    const unexpected = calls.filter((c) => !c.includes('/auth/refresh'))
    expect(unexpected, `예상 밖 요청: ${unexpected.join(', ')}`).toEqual([])
  })

  /**
   * 🔴 **미리보기 안으로 키보드가 들어가면 안 된다** (2026-08-09 검수).
   *
   * 랜딩은 제품 컴포넌트를 **실물로** 렌더한다. 처음엔 `pointer-events-none` 으로 막았는데
   * **그건 키보드를 막지 않는다** — 실측 결과 `aria-hidden` 안에 포커스 가능한 요소가 75개였고,
   * Tab 으로 들어가 Enter 를 누르면 **단계변경 mutation 이나 `/board/hero-1` 라우팅이 실제로
   * 발동**됐다. `aria-hidden` + 포커스 가능은 WCAG 4.1.2 위반이기도 하다.
   *
   * `inert` 로 바꿨고, 누가 되돌리면 여기서 걸린다.
   */
  test('\u{1F534} 미리보기 안 요소로 Tab 이 들어가지 않는다', async ({ page }) => {
    await mockAuthFail(page)
    await page.goto('/')
    await page.waitForTimeout(1500)

    const inside: string[] = []
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      const hit = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return null
        return el.closest('[inert]') ? `${el.tagName} ${el.textContent?.trim().slice(0, 20)}` : null
      })
      if (hit) inside.push(hit)
    }
    expect(inside, `미리보기 안으로 포커스가 들어감: ${inside.join(' / ')}`).toEqual([])
  })

  /**
   * 🔴 **랜딩의 누르는 요소는 44px · focus 링을 지켜야 한다** (2026-08-09 uiux).
   *
   * 실측에서 **7건이 44px 미만**이었다 — 헤더 로고 32×28, 푸터 링크 4개는 **높이 16px** 로
   * 기준의 3분의 1이었다. `focus-visible` 도 5건 빠져 있었는데, `/qa` 때 일괄 부착한
   * 정규식이 `rounded-*`+`transition-*` 을 가진 것만 잡아 이들이 새어 나갔다.
   *
   * 눈으로는 안 걸리는 종류라 **숫자로 막는다.** 미리보기 안(`[inert]`)은 누를 수도
   * 포커스할 수도 없으므로 대상이 아니다.
   */
  test('\u{1F534} 누르는 요소가 44px 이상이고 focus 링이 있다', async ({ page }) => {
    await mockAuthFail(page)
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto('/')
    await page.waitForTimeout(1500)

    const bad = await page.evaluate(() => {
      const small: string[] = []
      const noRing: string[] = []
      document.querySelectorAll('a,button').forEach((el) => {
        if (el.closest('[inert]')) return
        const r = el.getBoundingClientRect()
        if (!r.width) return
        const t = el.textContent?.trim().slice(0, 18) ?? ''
        if (r.height < 44) small.push(`${Math.round(r.width)}x${Math.round(r.height)} ${t}`)
        if (!el.className.toString().includes('focus-visible')) noRing.push(t)
      })
      return { small, noRing }
    })
    expect(bad.small, `44px 미만: ${bad.small.join(' / ')}`).toEqual([])
    expect(bad.noRing, `focus 링 없음: ${bad.noRing.join(' / ')}`).toEqual([])
  })

  /** 320px 에서도 가로 스크롤이 생기면 안 된다 (긴 회사명·동적 텍스트 기준) */
  test('320px 에서 가로 오버플로가 없다', async ({ page }) => {
    await mockAuthFail(page)
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto('/')
    await page.waitForTimeout(1500)
    const ov = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(ov, `가로 오버플로 ${ov}px`).toBeLessThanOrEqual(0)
  })

  test('로그인 상태에서 / 접속 시 /calendar로 이동', async ({ page }) => {
    await mockAuth(page)
    await page.goto('/')
    await expect(page).toHaveURL(/\/calendar/)
  })
})
