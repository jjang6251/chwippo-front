import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminInquiriesApi } from '@/api/adminInquiries'

/**
 * PR_B2 Phase 4 — admin 상단 종 아이콘 + 4 badge + 드롭다운 빠른 link.
 *
 * 60s 마다 자동 refetch (refetchInterval).
 * badge count > 0 면 빨간 점 표시.
 */
export function AdminNotificationBell() {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['admin', 'notifications', 'badges'],
    queryFn: adminInquiriesApi.getBadges,
    refetchInterval: 60_000,
  })

  const total =
    (data?.inquiriesOpen ?? 0) +
    (data?.slaOverdue ?? 0) +
    (data?.inquiriesUnassigned ?? 0) +
    (data?.adminUnread ?? 0)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`알림 ${total}건`}
        className="relative w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-card-strong transition-colors"
      >
        <span aria-hidden>🔔</span>
        {total > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="닫기"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-40 w-72 bg-card border border-line rounded-xl shadow-2xl p-3 space-y-1.5">
            <h3 className="text-text-primary text-xs font-bold mb-2">
              🔔 알림 ({total})
            </h3>

            <Link
              to="/ops/inquiries"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-card-strong text-xs"
            >
              <span className="text-text-secondary">
                📨 처리 대기 문의
              </span>
              <span
                className={`font-mono ${(data?.inquiriesOpen ?? 0) > 0 ? 'text-warning' : 'text-text-quaternary'}`}
              >
                {data?.inquiriesOpen ?? 0}
              </span>
            </Link>

            <Link
              to="/ops/inquiries?filter=unassigned"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-card-strong text-xs"
            >
              <span className="text-text-secondary">
                🆕 담당 미배정
              </span>
              <span
                className={`font-mono ${(data?.inquiriesUnassigned ?? 0) > 0 ? 'text-warning' : 'text-text-quaternary'}`}
              >
                {data?.inquiriesUnassigned ?? 0}
              </span>
            </Link>

            <Link
              to="/ops/inquiries?filter=overdue"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-card-strong text-xs"
            >
              <span className="text-text-secondary">⏱ 처리 기한 초과</span>
              <span
                className={`font-mono ${(data?.slaOverdue ?? 0) > 0 ? 'text-danger' : 'text-text-quaternary'}`}
              >
                {data?.slaOverdue ?? 0}
              </span>
            </Link>

            <Link
              to="/ops/inquiries?filter=unread"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-card-strong text-xs"
            >
              <span className="text-text-secondary">💬 미읽은 응답</span>
              <span
                className={`font-mono ${(data?.adminUnread ?? 0) > 0 ? 'text-info' : 'text-text-quaternary'}`}
              >
                {data?.adminUnread ?? 0}
              </span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
