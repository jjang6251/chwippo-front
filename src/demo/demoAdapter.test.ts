import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { demoAdapter } from './demoAdapter'
import { resetDemoStore, getApplication, getChecklist, getDailyNotes } from './demoStore'
import { useDemoSignupStore } from '@/stores/demoSignupStore'

const call = (method: string, url: string, body?: unknown) =>
  demoAdapter({
    url,
    method,
    data: body === undefined ? undefined : JSON.stringify(body),
  } as InternalAxiosRequestConfig)

const get = (url: string) => call('get', url)

beforeEach(() => {
  resetDemoStore()
  useDemoSignupStore.setState({ open: false })
})

describe('demoAdapter — 기존 GET 계약', () => {
  it('GET /notifications — 알림 봉투 형태 반환 (데모 캘린더 백지 회귀 방지)', async () => {
    const res = await get('/notifications')
    expect(res.data.data).toEqual({ items: [], nextCursor: null, unreadCount: 0 })
  })

  it('GET /notifications?cursor=... — 쿼리스트링 붙어도 동일 경로 매칭', async () => {
    const res = await get('/notifications?cursor=abc&limit=20')
    expect(res.data.data.items).toEqual([])
  })

  it('GET /calendar/urgent-checklist — 빈 배열 (null 이면 .length 크래시)', async () => {
    const res = await get('/calendar/urgent-checklist')
    expect(res.data.data).toEqual([])
  })

  it('GET /calendar/events — 이벤트 샘플 반환', async () => {
    const res = await get('/calendar/events?year=2026&month=7')
    expect(Array.isArray(res.data.data)).toBe(true)
  })
})

describe('demoAdapter — 신규 GET 경로 형태', () => {
  it('GET /activities — 활동 배열 (MyInfo 경험 섹션 크래시 방지)', async () => {
    const res = await get('/activities')
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(res.data.data.length).toBeGreaterThan(0)
  })

  it('GET /dashboard/streak — heatmap 365 + statusDistribution', async () => {
    const res = await get('/dashboard/streak')
    expect(res.data.data.heatmap).toHaveLength(365)
    expect(res.data.data.streak.current).toBeGreaterThan(0)
    expect(res.data.data.statusDistribution.length).toBeGreaterThan(0)
  })

  it('GET /dashboard/growth-metrics — funnel·milestone 형태', async () => {
    const res = await get('/dashboard/growth-metrics')
    expect(res.data.data.funnel.total).toBeGreaterThan(0)
    expect(res.data.data.milestoneCounts.applications).toBeGreaterThan(0)
  })

  it('GET /myinfo/storage-usage — 용량 형태', async () => {
    const res = await get('/myinfo/storage-usage')
    expect(res.data.data.percentage).toBeDefined()
    expect(res.data.data.limitMB).toBe(100)
  })

  it('GET /companies/details — null (실존 회사 허위사실 방지, 섹션 미노출)', async () => {
    const res = await get('/companies/details?name=카카오')
    expect(res.data.data).toBeNull()
  })

  it('GET /applications/:id/coverletter/research — null (실존 회사 조사 미제공)', async () => {
    const res = await get('/applications/demo-a1/coverletter/research')
    expect(res.data.data).toBeNull()
  })
})

describe('demoAdapter — fail-loud (미등록 GET)', () => {
  it('미등록 경로 — console.error + null 반환 (계약 유지)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await get('/unknown/path')
    expect(res.data.data).toBeNull()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('/unknown/path'))
    spy.mockRestore()
  })
})

describe('demoAdapter — mutation 화이트리스트 (인메모리 반영 + 정상 봉투)', () => {
  it('PATCH /applications/:id — 상태 변경 반영', async () => {
    const res = await call('patch', '/applications/demo-a2', { status: 'PASSED' })
    expect(res.data.data.status).toBe('PASSED')
    expect(getApplication('demo-a2')?.status).toBe('PASSED')
    expect(useDemoSignupStore.getState().open).toBe(false)
  })

  it('PATCH /applications/:id/step — 노드 이동 반영', async () => {
    const res = await call('patch', '/applications/demo-a1/step', { stepIndex: 3 })
    expect(res.data.data.currentStepIndex).toBe(3)
    expect(getApplication('demo-a1')?.currentStepIndex).toBe(3)
  })

  it('POST checklist — 항목 추가 반영', async () => {
    const res = await call('post', '/applications/demo-a1/steps/demo-a1-s2/checklist', { content: '체험 항목' })
    expect(res.data.data.content).toBe('체험 항목')
    expect(getChecklist('demo-a1-s2').some((i) => i.content === '체험 항목')).toBe(true)
  })

  it('PATCH checklist item — 토글 반영', async () => {
    const res = await call('patch', '/applications/demo-a1/steps/demo-a1-s2/checklist/demo-ck3', { isDone: true })
    expect(res.data.data.isDone).toBe(true)
  })

  it('POST /calendar/daily-notes — 노트 추가 반영', async () => {
    const before = getDailyNotes().length
    const res = await call('post', '/calendar/daily-notes', { date: '2026-07-13', content: '새 노트' })
    expect(res.data.data.content).toBe('새 노트')
    expect(getDailyNotes()).toHaveLength(before + 1)
  })

  it('PATCH /applications/:id/coverletters/:clId — 답변 저장 반영', async () => {
    const res = await call('patch', '/applications/demo-a1/coverletters/demo-a1-cl2', { answer: '초안' })
    expect(res.data.data.answer).toBe('초안')
  })
})

describe('demoAdapter — mutation 차단 (가입 모달 + 영원 pending)', () => {
  const isPending = async (p: Promise<unknown>) =>
    (await Promise.race([p.then(() => 'resolved'), Promise.resolve('pending')])) === 'pending'

  it('POST /applications (카드 생성) — 모달 노출 + pending', async () => {
    const p = call('post', '/applications', { companyName: 'x' })
    expect(useDemoSignupStore.getState().open).toBe(true)
    expect(await isPending(p)).toBe(true)
  })

  it('POST 자소서 AI 채팅 — 모달 노출 + pending', async () => {
    const p = call('post', '/applications/demo-a1/coverletter/chat', { userMessage: 'hi' })
    expect(useDemoSignupStore.getState().open).toBe(true)
    expect(await isPending(p)).toBe(true)
  })

  it('POST 공고 파싱(AI) — 모달 노출 + pending', async () => {
    const p = call('post', '/applications/demo-a1/job-posting/parse', { rawText: 'x'.repeat(40) })
    expect(useDemoSignupStore.getState().open).toBe(true)
    expect(await isPending(p)).toBe(true)
  })

  it('DELETE /applications/:id (카드 삭제) — 모달 노출 + pending', async () => {
    const p = call('delete', '/applications/demo-a1')
    expect(useDemoSignupStore.getState().open).toBe(true)
    expect(await isPending(p)).toBe(true)
  })
})
