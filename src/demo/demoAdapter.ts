// 데모 모드용 axios 어댑터. GET → 샘플 JSON, mutation → 가입 모달 + 영원히 pending(토스트 안 뜨게).
// DemoModeProvider가 마운트 시 apiClient.defaults.adapter를 이걸로 교체하고 언마운트 시 복구한다.
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { useDemoSignupStore } from '@/stores/demoSignupStore'
import * as S from './sampleData'

function resolveGet(url: string): unknown {
  const path = url.split('?')[0]

  let m = path.match(/^\/applications\/[^/]+\/coverletters\/reuse-options$/)
  if (m) return []
  m = path.match(/^\/applications\/([^/]+)\/coverletters$/)
  if (m) return S.getDemoCoverletters(m[1])
  m = path.match(/^\/applications\/[^/]+\/steps\/([^/]+)\/checklist$/)
  if (m) return S.getDemoChecklist(m[1])
  m = path.match(/^\/applications\/([^/]+)$/)
  if (m) return S.getDemoApplication(m[1]) ?? null

  switch (path) {
    case '/applications': return S.DEMO_APPLICATIONS
    case '/dashboard/stats': return S.DEMO_DASHBOARD_STATS
    case '/dashboard/dday': return S.DEMO_DDAY
    case '/dashboard/interview-review': return S.DEMO_INTERVIEW_REVIEW
    case '/calendar/events': return S.DEMO_CALENDAR_EVENTS
    case '/calendar/daily-notes': return S.DEMO_DAILY_NOTES
    case '/users/me/dashboard-config': return null
    case '/myinfo/profile': return S.DEMO_PROFILE
    case '/myinfo/language-certs': return S.DEMO_LANG_CERTS
    case '/myinfo/certs': return S.DEMO_CERTS
    case '/myinfo/awards': return S.DEMO_AWARDS
    case '/myinfo/experiences': return S.DEMO_EXPERIENCES
    case '/myinfo/educations': return S.DEMO_EDUCATIONS
    case '/myinfo/exam-schedules': return S.DEMO_EXAM_SCHEDULES
    case '/myinfo/coverletter': return S.DEMO_COVERLETTER
    case '/myinfo/documents': return []
    default: return null
  }
}

export const demoAdapter: AxiosAdapter = (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (method === 'get') {
    const payload = resolveGet(config.url ?? '')
    return Promise.resolve({
      data: { data: payload, message: 'ok' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    } as AxiosResponse)
  }
  // mutation(post/patch/put/delete) — 가입 모달 띄우고, 해당 요청은 영원히 pending(onSuccess/onError 안 탐 → 토스트 안 뜸)
  useDemoSignupStore.getState().show()
  return new Promise<never>(() => {})
}
