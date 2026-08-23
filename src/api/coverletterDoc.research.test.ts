/**
 * api/coverletterDoc.getResearch — 조회수 집계 쿼리 파라미터.
 *
 * 시나리오:
 * 1. 옵션 없음(자소서·면접 기존 호출) → params 없음 = hit_count 그대로 오른다
 * 2. countHit:false (카드 추가 직후 자동 노출) → `?countHit=false` 전송
 * 3. countHit:true 명시 → params 없음 (기본 경로와 동일하게 취급)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { coverletterDocApi } from './coverletterDoc'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(apiClient.get)
const URL = '/applications/app-1/coverletter/research'

beforeEach(() => {
  vi.clearAllMocks()
  mockedGet.mockResolvedValue({ data: { data: null } } as never)
})

describe('getResearch — countHit', () => {
  it('1. 옵션 없음 → params 없음 (기존 호출 무변경)', async () => {
    await coverletterDocApi.getResearch('app-1')
    expect(mockedGet).toHaveBeenCalledWith(URL, undefined)
  })

  it('2. countHit:false → ?countHit=false', async () => {
    await coverletterDocApi.getResearch('app-1', { countHit: false })
    expect(mockedGet).toHaveBeenCalledWith(URL, { params: { countHit: false } })
  })

  it('3. countHit:true → params 없음', async () => {
    await coverletterDocApi.getResearch('app-1', { countHit: true })
    expect(mockedGet).toHaveBeenCalledWith(URL, undefined)
  })
})
