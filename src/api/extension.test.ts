/**
 * api/extension.ts — 백엔드 계약 고정 (`src/auth/extension/`, 2026-09-06 로컬 실측).
 *
 * 시나리오:
 * 1. 세 라우트의 **경로**가 백엔드와 같다
 * 2. 전역 `ResponseTransformInterceptor` 의 `{ data, message }` 봉투를 벗긴다
 * 3. 🔴 disconnect 가 `sessionId` 를 **반드시** 실어 보낸다 (빠지면 계정의 확장 전부 해제)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extensionApi } from './extension'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = vi.mocked(apiClient.get)
const mockedPost = vi.mocked(apiClient.post)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extensionApi.listSessions', () => {
  it('GET /auth/extension/sessions · 봉투를 벗겨 배열을 준다', async () => {
    const rows = [
      {
        id: '8c9ff629-e5fb-4422-8de0-bf380aabc314',
        deviceFingerprint: 'ff73cf773b60405a',
        createdAt: '2026-09-06T04:06:45.484Z',
        lastUsedAt: '2026-09-06T04:06:45.484Z',
        expiresAt: '2026-10-06T04:06:45.484Z',
      },
    ]
    mockedGet.mockResolvedValue({ data: { data: rows, message: 'ok' } } as never)

    await expect(extensionApi.listSessions()).resolves.toEqual(rows)
    expect(mockedGet).toHaveBeenCalledWith('/auth/extension/sessions')
  })
})

describe('extensionApi.createPairCode', () => {
  it('POST /auth/extension/pair · code·expiresAt·ttlSeconds 를 그대로 준다', async () => {
    const body = {
      code: '638836',
      expiresAt: '2026-09-06T04:07:38.066Z',
      ttlSeconds: 60,
    }
    mockedPost.mockResolvedValue({ data: { data: body, message: 'ok' } } as never)

    await expect(extensionApi.createPairCode()).resolves.toEqual(body)
    expect(mockedPost).toHaveBeenCalledWith('/auth/extension/pair')
  })
})

describe('extensionApi.disconnect', () => {
  /**
   * 🔴 백엔드는 웹이 `sessionId` 없이 부르면 **그 계정의 확장을 전부** 끊는다
   * (`ExtensionAuthService.disconnect` — sessionId 가 없으면 WHERE 절이 사라진다).
   * 화면의 버튼은 「이 기기만」이므로 body 가 비면 그대로 사고다.
   */
  it('POST /auth/extension/disconnect · body 에 sessionId 를 싣는다', async () => {
    mockedPost.mockResolvedValue({
      data: { data: { disconnected: 1 }, message: 'ok' },
    } as never)

    await expect(extensionApi.disconnect('sess-1')).resolves.toEqual({
      disconnected: 1,
    })
    expect(mockedPost).toHaveBeenCalledWith('/auth/extension/disconnect', {
      sessionId: 'sess-1',
    })
  })

  it('멱등: 이미 끊긴 세션이면 disconnected 0 (에러 아님)', async () => {
    mockedPost.mockResolvedValue({
      data: { data: { disconnected: 0 }, message: 'ok' },
    } as never)

    await expect(extensionApi.disconnect('sess-gone')).resolves.toEqual({
      disconnected: 0,
    })
  })
})
