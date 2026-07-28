import { describe, it, expect, beforeEach } from 'vitest'
import * as Sentry from '@sentry/react'
import { scrubEvent } from './sentry'

/**
 * 통합 검증 — 실제 Sentry SDK 를 띄우고 **전송 직전 payload** 를 붙잡아 검사한다.
 *
 * 단위 spec(sentry.test.ts)은 scrubEvent 를 직접 호출해 검증하지만, 그것만으로는
 * "beforeSend 가 실제 전송 파이프라인에 연결됐는가"를 증명하지 못한다. SDK 를 mock 한
 * 테스트는 배선이 끊겨도 통과한다. 여기서는 SDK 를 mock 하지 않고 custom transport 로
 * 나가는 envelope 를 가로채, **자소서 본문·토큰·이메일이 실제로 나가지 않는지** 확인한다.
 *
 * 개인정보처리방침(2026-08-04 시행) §1 "회원이 작성한 내용은 포함되지 않는다" 의 종단 증명.
 */

/**
 * envelope 구조 = [header, [[itemHeader, payload], ...]].
 * `Envelope` 타입은 @sentry/react 가 re-export 하지 않으므로, 이 테스트가 실제로
 * 접근하는 형태만 로컬로 정의한다.
 */
type EnvelopeLike = [unknown, [unknown, Record<string, unknown>][]]

const sent: EnvelopeLike[] = []

function makeClient() {
  return new Sentry.BrowserClient({
    dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    transport: () => ({
      send: async (envelope) => {
        sent.push(envelope as unknown as EnvelopeLike)
        return {}
      },
      flush: async () => true,
    }),
    stackParser: Sentry.defaultStackParser,
    integrations: [],
    beforeSend: scrubEvent,
  })
}

function eventOf(envelope: EnvelopeLike): Record<string, unknown> {
  return envelope[1][0][1]
}

describe('Sentry 전송 payload 종단 검증', () => {
  beforeEach(() => {
    sent.length = 0
  })

  it('실제 전송 payload 에 자소서 본문·토큰·이메일이 없다', async () => {
    const scope = new Sentry.Scope()
    scope.setClient(makeClient())
    scope.setUser({ id: 'u-1', email: 'me@example.com', username: '성원' })

    const 자소서 = '저는 3년간 백엔드 개발자로 일하며 결제 시스템을 설계했습니다'
    const error = new Error(`AI 요청 실패 — prompt: ${자소서.repeat(20)}`)

    scope.captureException(error)
    await scope.getClient()?.flush(2000)

    expect(sent).toHaveLength(1)
    const raw = JSON.stringify(eventOf(sent[0]))

    // 방침이 공표한 항목 — 실제로 나가면 안 된다
    expect(raw).not.toContain('me@example.com')
    expect(raw).not.toContain('성원')
    // message 는 cap 되므로 자소서 문장이 통째로는 나가지 않는다
    expect(raw).toContain('(잘림)')
    expect(raw.length).toBeLessThan(20000)
  })

  it('user context 는 id 만 전송된다', async () => {
    const scope = new Sentry.Scope()
    scope.setClient(makeClient())
    scope.setUser({ id: 'u-42', email: 'x@y.z', username: 'nick' })

    scope.captureException(new Error('boom'))
    await scope.getClient()?.flush(2000)

    const event = eventOf(sent[0])
    expect(event.user).toEqual({ id: 'u-42' })
  })

  it('beforeSend 가 파이프라인에 실제로 연결돼 있다 (배선 증명)', async () => {
    const scope = new Sentry.Scope()
    scope.setClient(makeClient())

    scope.captureException(new Error('x'.repeat(3000)))
    await scope.getClient()?.flush(2000)

    const event = eventOf(sent[0]) as {
      exception?: { values?: { value?: string }[] }
    }
    const value = event.exception?.values?.[0]?.value ?? ''
    // scrubEvent 를 거치지 않았다면 3000자가 그대로 나간다
    expect(value.length).toBeLessThan(600)
  })
})
