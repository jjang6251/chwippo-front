import type { NotificationEvent, NotificationItem } from '@/types/notification'

/**
 * payload.todos — 브리핑에 합류한 오늘 할 일.
 *
 * events(일정)와 분리돼 있다. 이걸 안 읽으면 **body 에만 있던 할 일이 구조화 렌더에서
 * 사라진다** (푸시엔 있고 앱엔 없는 상태 — 2026-07-30 발견).
 */
export function parseNotificationTodos(
  n: Pick<NotificationItem, 'payload'>,
): string[] {
  const raw = (n.payload as { todos?: unknown } | null)?.todos
  if (!Array.isArray(raw)) return []
  return raw.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
}

/**
 * 알림 payload 에서 구조화 이벤트를 꺼낸다.
 *
 * `payload` 는 서버가 넣은 임의 JSON(jsonb)이라 **형태를 믿고 쓰면 안 된다.**
 * 특히 2026-07-29 이전 알림에는 events 자체가 없다(당시엔 body 문자열만 저장).
 * 그래서 파싱에 실패하면 **null 을 돌려주고 화면은 기존 body 텍스트로 폴백**한다 —
 * 옛 알림이 깨져 보이는 일이 없어야 한다.
 */
/**
 * 알림 deepLink 를 **앱 내부 경로로만** 제한한다.
 *
 * 지금은 서버가 코드 상수(`/board/:id`·`/calendar`)만 넣으므로 주입 경로가 없다.
 * 그래도 검증하는 이유 — deepLink 는 `navigate()` 로 바로 들어가는 값이고,
 * 나중에 누군가 "관리자가 링크를 지정하는 공지" 같은 API 를 열면 그 순간
 * 오픈 리다이렉트가 된다. **"지금 안전"이 아니라 "앞으로도 안전"** 하게 둔다.
 *
 * 차단: 절대 URL(`https://evil.com`) · 프로토콜 상대(`//evil.com`) · `javascript:` 등
 *
 * 🔴 `'//'` 만 막으면 **역슬래시로 우회된다** (2026-07-30 /qa 실측):
 *   `new URL('/\\evil.com', 'https://chwippo.com').href === 'https://evil.com/'`
 * WHATWG URL 파서가 special scheme(http/https)에서 `\` 를 `/` 와 동일하게 취급하기 때문이다.
 * 값이 `<Link to>` → `<a href>` 로 DOM 에 실리는 지금은 브라우저 파서가 직접 해석하므로
 * 이 경로가 실제 이동이 된다. 제어문자(`\t\n\r`)도 파서가 지워버리니 먼저 제거한다.
 */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // URL 파서가 무시하는 제어문자를 먼저 제거 — 남겨두면 검사와 해석이 어긋난다
  const v = value.replace(/[\t\n\r]/g, '').trim()
  if (v[0] !== '/') return null
  // 두 번째 문자가 '/' 또는 '\' 면 프로토콜 상대 URL 로 해석돼 외부 호스트로 나간다
  if (v[1] === '/' || v[1] === '\\') return null
  return v
}

export function parseNotificationEvents(
  n: Pick<NotificationItem, 'payload'>,
): NotificationEvent[] | null {
  const raw = (n.payload as { events?: unknown } | null)?.events
  if (!Array.isArray(raw) || raw.length === 0) return null

  const events: NotificationEvent[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const e = item as Record<string, unknown>
    // subject 는 화면의 주 정보라 없으면 구조화 렌더 자체를 포기한다
    if (typeof e.subject !== 'string' || e.subject.trim() === '') return null
    events.push({
      subject: e.subject,
      label: typeof e.label === 'string' ? e.label : '',
      dday: typeof e.dday === 'number' && Number.isFinite(e.dday) ? e.dday : null,
      deepLink: safeInternalPath(e.deepLink),
    })
  }
  return events
}

/**
 * D-day 표시 문자열. 앱 전역 규칙(`getDdayLabel`)과 동일 —
 * 당일은 "D-0" 이 아니라 **"D-day"**, 지난 건 "D+N".
 */
export function ddayLabel(dday: number): string {
  if (dday === 0) return 'D-day'
  return dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`
}

/**
 * D-day 긴급도 → 색 토큰. 보드 `getDdayVariant` 와 같은 경계(2일·7일)를 쓴다 —
 * 같은 마감을 알림과 보드에서 다른 색으로 보면 안 된다.
 */
export function ddayTone(
  dday: number,
): 'muted' | 'danger' | 'warning' | 'info' {
  if (dday < 0) return 'muted' // 지난 일정 — 알림에 남아 있어도 강조하지 않는다
  if (dday <= 2) return 'danger'
  if (dday <= 7) return 'warning'
  return 'info'
}
