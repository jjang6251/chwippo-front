import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { DdayValueBadge } from '@/components/card/DdayBadge'
import type { NotificationEvent } from '@/types/notification'

/** 접기 전 기본 노출 개수 — 시즌엔 마감이 몰려 5개를 넘는다 */
const VISIBLE = 4

interface Props {
  events: NotificationEvent[]
  /** 브리핑에 합류한 오늘 할 일 — 일정이 아니라 이동할 카드가 없다 */
  todos?: string[]
  /**
   * 줄 이동 **직전** 부수 효과(읽음 처리). 이동 자체는 `<Link>` 가 한다 —
   * 여기서 navigate 를 부르면 Cmd/중클릭(새 탭)에서 이동이 두 번 일어난다.
   */
  onBeforeNavigate?: () => void
}

/**
 * 알림 안의 일정 목록.
 *
 * 이전에는 `body` 문자열("카카오 서류 마감 · D-3\n네이버 1차 면접 · 오늘")을 통째로
 * 뿌려서 ① 회사명·D-day 를 강조할 수 없고 ② **알림 전체가 버튼 하나라 두 번째 회사를
 * 눌러도 첫 번째로 이동**했다. 줄 단위로 쪼개 각자 링크를 갖게 한다.
 *
 * D-day 뱃지는 보드와 **같은 컴포넌트**(DdayValueBadge)를 쓴다 — 같은 마감이
 * 화면마다 다른 색이면 안 된다.
 *
 * 줄은 `<button>` 이 아니라 **`<Link>`** 다 — "오늘의 일정 3건" 을 훑으며 회사별로
 * 새 탭에 열어두고 하나씩 처리하는 게 실제 사용 흐름인데, button + navigate() 는
 * Cmd/Ctrl·중클릭을 먹어버린다 (2026-07-30 /uiux). 레포 관례도 `<Link>` 다.
 */
export function NotificationEventList({
  events,
  todos = [],
  onBeforeNavigate,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const hidden = events.length - VISIBLE
  const shown = expanded ? events : events.slice(0, VISIBLE)

  return (
    <div className="mt-2">
      <ul className="flex flex-col divide-y divide-line">
        {shown.map((e, i) => {
          const clickable = e.deepLink !== null
          const content = (
            <>
              <span className="min-w-0 flex-1 flex items-baseline gap-1.5">
                <span className="text-text-primary text-[13px] font-semibold truncate">
                  {e.subject}
                </span>
                {e.label && (
                  <span className="text-text-tertiary text-xs truncate">
                    {e.label}
                  </span>
                )}
              </span>
              {e.dday !== null && (
                <span className="shrink-0">
                  <DdayValueBadge dday={e.dday} />
                </span>
              )}
            </>
          )
          return (
            <li key={`${e.subject}-${i}`}>
              {clickable ? (
                <Link
                  // deepLink 는 parseNotificationEvents 에서 safeInternalPath 로 이미
                  // 내부 경로만 통과시킨 값이다 (오픈 리다이렉트 차단)
                  to={e.deepLink!}
                  onClick={(ev) => {
                    // 부모(알림 카드) 클릭 핸들러로 전파되면 첫 이벤트로 이동해버린다
                    ev.stopPropagation()
                    onBeforeNavigate?.()
                  }}
                  className="w-full min-h-[44px] py-2 flex items-center gap-2 text-left rounded-md transition-colors hover:bg-card-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                >
                  {content}
                </Link>
              ) : (
                <div className="w-full min-h-[44px] py-2 flex items-center gap-2">
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/*
        할 일 — events 와 성격이 달라 아래에 별도 줄로. 이동할 카드가 없으므로 링크 없음.
        이 블록이 없으면 body 에만 있던 할 일이 화면에서 사라진다.

        강조 수준은 **마감보다 한 단계 아래**로 의도한 것이다 — 마감은 외부가 정한 기한이라
        놓치면 되돌릴 수 없고, 할 일은 내가 정한 것이라 미뤄도 복구된다.
        단 처음엔 각주 수준(text-xs·tertiary)으로 너무 약해 안 읽혔다 (2026-07-30 지적).
        아이콘 + 13px + primary 라벨로 "읽히는 정보" 수준까지 올리고 D-day 뱃지는 주지 않는다.
      */}
      {todos.length > 0 && (
        <div className="mt-1.5 pt-2 border-t border-line flex items-start gap-2">
          <ListChecks
            size={14}
            strokeWidth={1.75}
            className="shrink-0 mt-0.5 text-text-tertiary"
            aria-hidden="true"
          />
          <p className="min-w-0 text-[13px] leading-relaxed">
            <span className="text-text-primary font-medium">
              오늘 할 일 {todos.length}개
            </span>
            <span className="text-text-quaternary"> · </span>
            <span className="text-text-tertiary">{todos.join(', ')}</span>
          </p>
        </div>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation()
            setExpanded((v) => !v)
          }}
          aria-expanded={expanded}
          className="mt-1 min-h-[44px] -my-1 px-1 text-[11px] font-medium text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
        >
          {expanded ? '접기' : `${hidden}개 더 보기`}
        </button>
      )}
    </div>
  )
}
