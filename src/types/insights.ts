/**
 * F6 PR 1 — `GET /activity/insights` 응답 타입.
 * 백엔드 `src/activity/insights.service.ts` `InsightsResponse` 와 일치.
 */
export interface InsightsResponse {
  strengths: {
    byCl: Array<{ key: string; count: number }>
    byComps: Array<{ key: string; count: number }>
  }
  sources: Array<{
    logId: string
    content: string
    occurredAt: string
    referencedByCount: number
  }>
  heatmap: Array<{ date: string; count: number }>
  trend: Array<{ month: string; count: number }>
  cached: boolean
  generatedAt: string
}
