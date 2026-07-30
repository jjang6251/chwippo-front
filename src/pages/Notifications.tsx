import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  Clock,
  Siren,
  Square,
  SquareCheckBig,
  type LucideIcon,
} from 'lucide-react'
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'
import type {
  NotificationItem,
  NotificationType,
} from '@/types/notification'
import { addDays, toLocalDateString } from '@/utils/datetime'
import {
  parseNotificationEvents,
  parseNotificationTodos,
  safeInternalPath,
} from '@/utils/notificationEvents'
import { NotificationEventList } from '@/components/notification/NotificationEventList'

// U30 — 미읽음 행 구분감: 저알파 틴트(다크에서 지각 불가) → card-solid + 유형색 좌측 스트라이프.
// DESIGN.md 규칙 9(리스트 카드 구분감) 이식. 유형색은 stripe(border-l)로만 표현.
// ADR-050 아이콘 정책 — 이모지는 OS 마다 다르게 렌더되고 currentColor 를 무시한다.
// 기존엔 마감 긴급·임박이 **둘 다 ⏰** 여서 아이콘으로 구분이 안 됐다 (2026-07-30).
// 아이콘 색은 좌측 스트라이프와 **같은 유형색**을 쓴다.
// 이모지는 자기 색이 있어 그냥 보였지만 lucide 는 currentColor 라, 처음엔
// `text-text-tertiary` + `bg-card` 를 얹어 **배경과 붙어 안 보였다** (2026-07-30 회귀).
// 유형색을 입히면 대비가 오르면서 유형 인지도 같이 강해진다.
// 32px 칩은 DESIGN.md 규칙 9 의 "소형 요소" 예외라 알파 틴트 허용.
//
// 알파 8% 는 실측으로 정한 값이다 — /12 에서는 **라이트 모드 warning 이 2.93:1** 로
// 그래픽 요소 최저 기준(3:1)에 미달했다. /8 이 양 테마 4색 모두 3:1 이상 (worst 3.06:1).
// 추론 금지 · 토큰 값으로 대비율 계산해 확인했다 (DESIGN.md 규칙 6·9).
const TYPE_META: Record<
  NotificationType,
  { Icon: LucideIcon; stripe: string; chip: string; label: string }
> = {
  briefing: {
    Icon: CalendarDays,
    stripe: 'border-l-brand',
    chip: 'text-brand bg-brand/8',
    label: '아침 브리핑',
  },
  deadline_urgent: {
    Icon: Siren,
    stripe: 'border-l-warning',
    chip: 'text-warning bg-warning/8',
    label: '마감 긴급',
  },
  // imminent(2시간 전) — 임박은 '시계', 마감 긴급은 '경보'로 형태부터 구분
  imminent: {
    Icon: Clock,
    stripe: 'border-l-violet',
    chip: 'text-violet bg-violet/8',
    label: '2시간 전',
  },
  admin: {
    Icon: Bell,
    stripe: 'border-l-info',
    chip: 'text-info bg-info/8',
    label: '운영 알림',
  },
}

/**
 * A7 — 타입 필터 (브리핑 아카이브 겸용). '?type=briefing' 딥링크 = 캘린더 배너 진입
 *
 * 아이콘은 `TYPE_META` 를 재사용한다 — 라벨을 직접 갖고 있으면 카드와 어긋난다.
 * 실제로 어긋나 있었다: 카드는 Clock/Siren 으로 갈랐는데 칩은 **임박·마감 긴급이 둘 다 ⏰**
 * 라 같은 화면에서 구분이 안 됐다 (2026-07-30 /uiux). ADR-050 이모지 금지 위반이기도 했다.
 */
const FILTER_TABS: Array<{ key: NotificationType | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'briefing', label: '브리핑' },
  { key: 'imminent', label: '임박' },
  { key: 'deadline_urgent', label: '마감 긴급' },
  { key: 'admin', label: '운영' },
]

function isNotificationType(v: string | null): v is NotificationType {
  return (
    v === 'briefing' ||
    v === 'deadline_urgent' ||
    v === 'imminent' ||
    v === 'admin'
  )
}

function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return `${Math.floor(days / 30)}달 전`
}

/**
 * 날짜 그룹 라벨 — 상대시간만 쭉 나열되면 훑기가 어렵다.
 * KST 기준 (치뽀는 KST 고정 앱 — `@/utils/datetime` 규칙).
 */
function dateGroup(iso: string, now: Date = new Date()): string {
  const day = toLocalDateString(new Date(iso))
  const today = toLocalDateString(now)
  if (day === today) return '오늘'
  if (day === addDays(today, -1)) return '어제'
  if (day >= addDays(today, -6)) return '이번 주'
  return '이전'
}

/**
 * onClick 이 있으면 `<button>`, 없으면 `<div>`.
 * "눌러도 아무 일 없는 버튼" 을 만들지 않기 위한 래퍼 — 어포던스가 실제 동작과 일치해야 한다.
 */
function Container({
  onClick,
  className,
  children,
}: {
  onClick?: () => void
  className: string
  children: React.ReactNode
}) {
  if (!onClick) return <div className={className}>{children}</div>
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}

export function Notifications() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // A7 — 타입 필터: URL(?type=) 이 소스. U23 — 서버사이드 필터로 재조회 (클라이언트 필터 제거)
  const typeParam = searchParams.get('type')
  const filter: NotificationType | 'all' = isNotificationType(typeParam)
    ? typeParam
    : 'all'
  const setFilter = (key: NotificationType | 'all') =>
    setSearchParams(key === 'all' ? {} : { type: key }, { replace: true })

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useNotifications(filter === 'all' ? undefined : filter)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  // U23 — 서버가 이미 type 으로 필터링 → 페이지 병합만 (false-empty 해소: 깊은 페이지도 정확)
  const items = data?.pages.flatMap((p) => p.items) ?? []
  // unreadCount 는 서버에서 필터와 무관하게 전체 미읽음 (종 배지·전체읽음 버튼 의미 유지)
  const unread = data?.pages[0]?.unreadCount ?? 0

  /**
   * 알림 카드 탭.
   *
   * 구조화 이벤트가 있으면 **이동하지 않고 읽음 처리만** 한다 — 줄마다 링크가 따로 있는데
   * 카드 전체까지 대표 링크로 이동하면 "어디를 눌렀느냐"에 따라 결과가 달라져 예측이 안 된다
   * (2026-07-29 CEO 지적: 제목을 눌렀는데 첫 회사로 튐).
   * 옛 알림(events 없음)은 기존대로 대표 링크로 이동 — 그것 말고 갈 곳이 없다.
   */
  function handleTap(n: NotificationItem, hasEvents: boolean) {
    if (!n.read) markRead.mutate(n.id)
    if (hasEvents) return
    const to = safeInternalPath(n.deepLink)
    if (to) navigate(to)
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">알림</h1>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="text-xs font-medium text-text-tertiary hover:text-brand transition-colors disabled:opacity-50"
          >
            전체 읽음
          </button>
        )}
      </div>

      {/* A7 — 타입 필터 (브리핑 아카이브) */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key
          // 색은 주지 않는다 — currentColor 로 칩의 활성/비활성 색을 그대로 받아야
          // 유형색 5개가 동시에 켜져 활성 상태 신호를 덮는 일이 없다
          const Icon = tab.key === 'all' ? null : TYPE_META[tab.key].Icon
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
                isActive
                  ? 'bg-brand/10 text-brand border-brand/30'
                  : 'bg-card border-line text-text-tertiary hover:text-text-secondary hover:border-line-strong'
              }`}
            >
              {Icon && (
                <Icon size={13} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      {isLoading && <NotificationSkeleton />}

      {isError && (
        <div className="bg-surface-2 border border-line rounded-xl p-5 text-sm text-text-tertiary">
          알림을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center text-2xl mb-4">
            🔔
          </div>
          <p className="text-sm font-medium text-text-secondary mb-1">
            {filter === 'briefing'
              ? '아직 받은 브리핑이 없어요'
              : filter !== 'all'
                ? '해당 유형 알림이 없어요'
                : '새 알림이 없어요'}
          </p>
          <p className="text-xs text-text-tertiary">
            {filter === 'briefing'
              ? '마감·면접이 다가오면 매일 아침 8시에 정리해드려요.'
              : '마감·면접이 다가오면 여기로 알려드릴게요.'}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((n, idx) => {
            const meta = TYPE_META[n.type]
            const events = parseNotificationEvents(n)
            // 날짜 그룹 헤더 — 앞 항목과 그룹이 달라지는 지점에만
            const group = dateGroup(n.createdAt)
            const showGroup = idx === 0 || dateGroup(items[idx - 1].createdAt) !== group
            return (
              <li key={n.id}>
                {showGroup && (
                  <p className="text-text-quaternary text-[11px] font-medium px-1 pt-3 pb-1.5 first:pt-0">
                    {group}
                  </p>
                )}
                {/*
                  events 가 있으면 **카드는 버튼이 아니다.** 눌러도 이동하지 않는데
                  버튼+hover 로 두면 "눌렀는데 반응 없네" 가 된다 (어포던스 불일치).
                  누를 수 있는 건 ① 일정 줄(이동) ② '읽음' 버튼 둘뿐이다.
                  옛 알림(events 없음)은 갈 곳이 대표 링크뿐이라 카드 전체를 버튼으로 유지.
                */}
                <Container
                  onClick={events ? undefined : () => handleTap(n, false)}
                  className={`w-full flex gap-3 rounded-xl border p-4 text-left transition-colors ${
                    events
                      ? ''
                      : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg'
                  } ${
                    n.read
                      ? `bg-surface-2 border-line ${events ? '' : 'hover:border-line-strong'}`
                      : `bg-card-solid border-line-strong border-l-[3px] ${meta.stripe} shadow-sm ${events ? '' : 'hover:bg-surface-3'}`
                  }`}
                >
                  <span
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.chip}`}
                    aria-hidden
                  >
                    <meta.Icon size={16} strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      {/*
                        events 가 있으면 제목("오늘의 일정 3건")은 아래 줄 수와 중복이고
                        정보가 없다. 시각 주역을 일정 줄에 넘기고 제목은 라벨로 낮춘다.
                      */}
                      <p
                        className={
                          events
                            ? 'min-w-0 flex-1 text-xs text-text-tertiary line-clamp-2'
                            : `min-w-0 flex-1 text-sm line-clamp-2 ${
                                n.read
                                  ? 'font-medium text-text-secondary'
                                  : 'font-semibold text-text-primary'
                              }`
                        }
                      >
                        {n.title}
                      </p>
                      {/*
                        읽음 처리 버튼 — 우측 상단 고정.
                        처음엔 카드 하단(시간 옆)에 11px·tertiary 로 뒀는데 **아무도 못 찾았다**
                        (2026-07-30 CEO: "꼭 카드에 들어가봐야 하냐"). 각주 수준은 안 읽힌다는
                        교훈을 할 일 강조에서 배웠는데 옆에서 같은 실수를 했다.
                        우측 상단으로 올린 이유: 알림 정리는 위→아래 **연속 동작**이라
                        버튼이 같은 X 축에 세로 정렬돼야 손이 안 움직인다.
                        안 읽음 표시(점)와 처리 버튼이 한 자리에 있어 의미도 붙는다.
                      */}
                      {/*
                        읽음 상태를 **체크박스**로 표현한다 (CEO 아이디어 2026-07-30).
                        빈 상자(☐)는 "아직 안 했다" 를 보여주면서 **채우고 싶게 만든다** —
                        할 일 목록의 심리를 그대로 쓴다. 목록에서 빈 상자만 눈에 띄어 훑기도 쉽다.

                        문구 변천사 (같은 자리에서 두 번 틀렸다):
                          "읽음" 단독 → 한국 UI 에서 카카오톡식 **상태 표시**로 읽혀
                            안 읽은 알림에 붙으면 사실과 반대가 됐다.
                          "✓ 읽음 처리" → 체크 표시 자체가 **이미 읽은 것처럼** 보였다.
                        체크박스가 둘을 동시에 해결한다 — `☐ 읽음`("읽음: 아니오"),
                        `☑ 읽음`("읽음: 예") 로 라벨이 상태와 정확히 대응한다.

                        읽은 항목은 **버튼이 아니다** — 되돌리는 API 가 없으므로 누를 수 있게
                        보이면 거짓 어포던스다. 표시만 남기고 흐리게 둔다.
                      */}
                      {/*
                        tertiary 다 — quaternary 는 이 카드 배경(surface-2)에서 다크 4.03:1 로
                        DESIGN.md 규칙 6(본문성 텍스트 4.5:1) 미달이었다. 규칙 6 의 기준 측정이
                        더 어두운 `surface` 였던 탓 (그쪽은 4.52:1). 읽음 여부는 장식이 아니라 상태다.
                        ☐/☑ 대비는 색(brand 초록 vs 회색)과 카드 처리가 지므로 위계는 유지된다.
                      */}
                      {n.read ? (
                        <span className="shrink-0 flex items-center gap-1 text-[11px] text-text-tertiary">
                          <SquareCheckBig size={13} strokeWidth={2} aria-hidden="true" />
                          <span aria-hidden="true">읽음</span>
                          <span className="sr-only">읽은 알림</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markRead.mutate(n.id)}
                          aria-label="읽음으로 표시"
                          title="읽음으로 표시"
                          className="shrink-0 -my-2 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 rounded-md text-[11px] font-medium text-brand hover:bg-brand/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                        >
                          {/* 보이는 내용은 aria-hidden — 접근성 이름은 aria-label 하나로 */}
                          <Square size={13} strokeWidth={2} aria-hidden="true" />
                          <span aria-hidden="true">읽음</span>
                        </button>
                      )}
                    </div>
                    {events ? (
                      <NotificationEventList
                        events={events}
                        todos={parseNotificationTodos(n)}
                        // 이동은 줄의 <Link> 가 한다 — 여기선 읽음 처리만
                        onBeforeNavigate={() => {
                          if (!n.read) markRead.mutate(n.id)
                        }}
                      />
                    ) : (
                      // 2026-07-29 이전 알림은 구조화 payload 가 없다 → 기존 텍스트로 폴백
                      <p className="text-xs text-text-tertiary mt-1 whitespace-pre-line leading-relaxed line-clamp-4">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[11px] text-text-quaternary font-mono mt-1.5">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </Container>
              </li>
            )
          })}
        </ul>
      )}

      {hasNextPage && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50 py-2 px-4"
          >
            {isFetchingNextPage ? '불러오는 중…' : '더 보기'}
          </button>
        </div>
      )}
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex gap-3 rounded-xl border border-line bg-surface-2 p-4 animate-pulse"
        >
          <div className="w-8 h-8 rounded-lg bg-card-strong shrink-0" />
          <div className="flex-1">
            <div className="h-4 w-40 bg-card-strong rounded mb-2" />
            <div className="h-3 w-full bg-card rounded" />
          </div>
        </li>
      ))}
    </ul>
  )
}
