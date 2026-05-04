import { test, expect } from '@playwright/test'
import { mockAuth } from './helpers/auth'
import dayjs from 'dayjs'

const MOCK_EVENTS = [
  {
    date: dayjs().format('YYYY-MM-DD'),
    type: 'deadline',
    applicationId: 'app-uuid-1',
    companyName: '네이버',
    stepName: null,
    location: null,
  },
  {
    date: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    type: 'interview',
    applicationId: 'app-uuid-2',
    companyName: '카카오',
    stepName: '1차 면접',
    location: '온라인',
  },
]

async function mockCalendarApis(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page)
  await page.route('**/calendar/events**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_EVENTS }),
    })
  )
}

test.describe('캘린더 페이지', () => {
  test('이번 달 년월이 헤더에 표시됨', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    const year = dayjs().year()
    const month = dayjs().month() + 1
    await expect(page.getByText(`${year}년 ${month}월`)).toBeVisible()
  })

  test('요일 헤더 7개 (일~토) 표시', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    for (const day of ['일', '월', '화', '수', '목', '금', '토']) {
      await expect(page.locator(`text="${day}"`).first()).toBeVisible()
    }
  })

  test('이번 달 요약 배너 — 서류 마감 1건·면접 1건 표시', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    await expect(page.getByText('서류 마감 1건')).toBeVisible()
    await expect(page.getByText('면접 일정 1건')).toBeVisible()
  })

  test('이번 달 일정 목록에 네이버·카카오 표시', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    await expect(page.getByText('네이버').first()).toBeVisible()
    await expect(page.getByText('카카오').first()).toBeVisible()
  })

  test('이전 달 이동 버튼 동작', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    const prevMonth = dayjs().subtract(1, 'month')
    await page.getByLabel('이전 달').click()
    await expect(
      page.getByText(`${prevMonth.year()}년 ${prevMonth.month() + 1}월`)
    ).toBeVisible()
  })

  test('다음 달 이동 버튼 동작', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    const nextMonth = dayjs().add(1, 'month')
    await page.getByLabel('다음 달').click()
    await expect(
      page.getByText(`${nextMonth.year()}년 ${nextMonth.month() + 1}월`)
    ).toBeVisible()
  })

  test('오늘 버튼 클릭 시 이번 달로 복귀', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    const year = dayjs().year()
    const month = dayjs().month() + 1

    // 다음 달로 이동 후
    await page.getByLabel('다음 달').click()
    // 오늘 버튼으로 복귀
    await page.getByRole('button', { name: '오늘' }).click()
    await expect(page.getByText(`${year}년 ${month}월`)).toBeVisible()
  })

  test('날짜 클릭 시 해당 날짜 이벤트 목록 표시', async ({ page }) => {
    await mockCalendarApis(page)
    await page.goto('/calendar')

    const todayNum = dayjs().date()
    // 오늘 날짜 셀 클릭 (오늘은 브랜드 색 동그라미로 표시됨)
    await page.locator(`span:has-text("${todayNum}")`).first().click()

    // 선택된 날짜 헤더 표시
    await expect(page.getByText(/월.*일.*\(/).first()).toBeVisible()
  })

  test('이벤트 카드 클릭 시 /board/:id로 이동', async ({ page }) => {
    await mockCalendarApis(page)
    await page.route('**/applications/app-uuid-1**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'app-uuid-1', companyName: '네이버', steps: [], currentStepIndex: 0, status: 'IN_PROGRESS' } }),
      })
    )
    await page.goto('/calendar')

    // EventCard는 <Link> → <a> 태그로 렌더링되므로 <a> 요소 대상으로 클릭
    await page.locator('a:has-text("네이버")').first().click()
    await expect(page).toHaveURL(/\/board\/app-uuid-1/)
  })
})
