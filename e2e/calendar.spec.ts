/**
 * 캘린더(홈) E2E
 *
 * 캘린더 UX 재구성으로 캘린더가 홈이 되고 뷰 모델이 전면 개편됐다:
 *  - 기본 뷰 = 아젠다(세로 타임라인) · 탭으로 "월별" 그리드 전환
 *  - 이벤트 모델: type 'step'|'exam'|'note' (구 deadline/interview 제거) · /calendar/events
 *  - 임박 Hero 는 /dashboard/dday 소스
 *  - 월별 뷰에만 이전/다음 달·오늘 버튼·요일 헤더·"{년}년 {월}월"
 */
import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/auth'
import dayjs from 'dayjs'

const today = dayjs().format('YYYY-MM-DD')
const plus3 = dayjs().add(3, 'day').format('YYYY-MM-DD')

// 신규 이벤트 형상 (type=step) — 네이버(오늘 서류 마감)·카카오(D+3 면접)
const MOCK_EVENTS = [
  {
    date: today, time: null, type: 'step',
    applicationId: 'app-uuid-1', stepId: 'step-naver', examId: null, noteId: null,
    companyName: '네이버', stepName: '서류 마감', location: null, content: null, isStarred: false,
  },
  {
    date: plus3, time: '14:00', type: 'step',
    applicationId: 'app-uuid-2', stepId: 'step-kakao', examId: null, noteId: null,
    companyName: '카카오', stepName: '1차 면접', location: '온라인', content: null, isStarred: false,
  },
]

// Hero(임박한 일정) 소스 — /dashboard/dday
const HERO_DDAY = [
  {
    type: 'step', applicationId: 'app-uuid-1', stepId: 'step-naver',
    companyName: '네이버', stepName: '서류 마감', date: today, dday: 0, nextAction: 'no_action',
  },
]

const STREAK = {
  streak: { current: 0, lastActivityDate: null },
  heatmap: [],
  statusDistribution: [],
}

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data }),
})

async function mockCalendarApis(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page)
  // 이번 달 요청에만 이벤트 반환 (다음 달 요청은 [] → 아젠다 중복 방지)
  await page.route('**/calendar/events**', (route) => {
    const url = new URL(route.request().url())
    const month = Number(url.searchParams.get('month'))
    const events = month === dayjs().month() + 1 ? MOCK_EVENTS : []
    route.fulfill(json(events))
  })
  await page.route('**/calendar/daily-notes**', (route) => {
    if (route.request().method() === 'GET') route.fulfill(json([]))
    else route.continue()
  })
  await page.route('**/calendar/urgent-checklist', (r) => r.fulfill(json([])))
  await page.route('**/dashboard/dday', (r) => r.fulfill(json(HERO_DDAY)))
  await page.route('**/dashboard/streak', (r) => r.fulfill(json(STREAK)))
  await page.route('**/applications', (r) => r.fulfill(json([{ id: 'app-uuid-1' }])))
}

test.describe('캘린더 페이지', () => {
  test('아젠다(기본 뷰) — 임박한 일정·다가오는 일정 + 회고 보기 링크', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    await expect(page.getByRole('heading', { name: '임박한 일정' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '다가오는 일정' })).toBeVisible()
    await expect(page.getByRole('link', { name: /회고 보기/ })).toBeVisible()
  })

  test('아젠다 — 다가오는 일정 목록에 네이버·카카오 표시', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    await expect(page.getByText('네이버').first()).toBeVisible()
    await expect(page.getByText('카카오').first()).toBeVisible()
  })

  test('월별 탭 전환 → "년월" 헤더 표시', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    await page.getByRole('button', { name: '월별' }).click()

    const year = dayjs().year()
    const month = dayjs().month() + 1
    await expect(page.getByText(`${year}년 ${month}월`, { exact: true })).toBeVisible()
  })

  test('월별 — 요일 헤더 7개 (일~토) 표시', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    await page.getByRole('button', { name: '월별' }).click()

    for (const day of ['일', '월', '화', '수', '목', '금', '토']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible()
    }
  })

  test('월별 — 이전 달 이동 버튼 동작', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')
    await page.getByRole('button', { name: '월별' }).click()

    const prev = dayjs().subtract(1, 'month')
    await page.getByLabel('이전 달').click()
    await expect(
      page.getByText(`${prev.year()}년 ${prev.month() + 1}월`, { exact: true }),
    ).toBeVisible()
  })

  test('월별 — 다음 달 이동 버튼 동작', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')
    await page.getByRole('button', { name: '월별' }).click()

    const next = dayjs().add(1, 'month')
    await page.getByLabel('다음 달').click()
    await expect(
      page.getByText(`${next.year()}년 ${next.month() + 1}월`, { exact: true }),
    ).toBeVisible()
  })

  test('월별 — 오늘 버튼 클릭 시 이번 달로 복귀', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')
    await page.getByRole('button', { name: '월별' }).click()

    const year = dayjs().year()
    const month = dayjs().month() + 1

    await page.getByLabel('다음 달').click()
    await page.getByRole('button', { name: '오늘' }).click()
    await expect(page.getByText(`${year}년 ${month}월`, { exact: true })).toBeVisible()
  })

  test('아젠다 이벤트 카드 클릭 → 스텝 상세(/board/:id/steps/:stepId)로 이동', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    // 카카오(D+3 면접) 카드 — 아젠다에만 존재 (오늘 패널/Hero 와 중복 없음)
    await page.getByRole('link', { name: /카카오/ }).first().click()
    await expect(page).toHaveURL(/\/board\/app-uuid-2\/steps\/step-kakao/)
  })
})
