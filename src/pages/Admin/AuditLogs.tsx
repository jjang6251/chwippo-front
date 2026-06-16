import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AdminCard } from '@/components/common/AdminCard'
import {
  adminAuditLogsApi,
  type AuditLogSearchParams,
} from '@/api/adminAuditLogs'
import { auditActionLabel, AUDIT_ACTION_KR } from '@/utils/featureLabel'
import { formatKstDateTime } from '@/utils/datetime'
import { AuditDetailView } from '@/components/admin/AuditDetailView'

/**
 * PR_B2 Phase 4 — admin audit log 검색 페이지 (Q27).
 *
 * 필터: action / adminId / targetId / from / to
 * 정렬 created_at desc + pagination
 */
export function AuditLogs() {
  const [filters, setFilters] = useState<AuditLogSearchParams>({
    page: 1,
    limit: 50,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () => adminAuditLogsApi.search(filters),
  })

  const actions = useMemo(() => Object.keys(AUDIT_ACTION_KR).sort(), [])
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  const reset = () => setFilters({ page: 1, limit: 50 })

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-text-primary text-xl font-bold">📜 Audit Logs</h1>
          <p className="text-text-quaternary text-xs">
            모든 admin 액션 영구 보존 (Q4). 필터 + pagination.
          </p>
        </div>
        {isFetching && (
          <span className="text-text-quaternary text-[11px]">갱신 중...</span>
        )}
      </header>

      <AdminCard>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select
            value={filters.action ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                action: e.target.value || undefined,
                page: 1,
              })
            }
            aria-label="action 필터"
            className="appearance-none bg-card-strong border border-line text-text-primary text-xs px-3 py-2 rounded-md pr-8"
          >
            <option value="">전체 action</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(a)} ({a})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="adminId UUID"
            value={filters.adminId ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                adminId: e.target.value || undefined,
                page: 1,
              })
            }
            aria-label="adminId 필터"
            className="bg-card-strong border border-line text-text-primary text-xs px-3 py-2 rounded-md font-mono"
          />

          <input
            type="text"
            placeholder="targetId UUID"
            value={filters.targetId ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                targetId: e.target.value || undefined,
                page: 1,
              })
            }
            aria-label="targetId 필터"
            className="bg-card-strong border border-line text-text-primary text-xs px-3 py-2 rounded-md font-mono"
          />

          <input
            type="datetime-local"
            value={filters.from ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                from: e.target.value || undefined,
                page: 1,
              })
            }
            aria-label="from 필터"
            className="bg-card-strong border border-line text-text-primary text-xs px-3 py-2 rounded-md"
          />
          <input
            type="datetime-local"
            value={filters.to ?? ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                to: e.target.value || undefined,
                page: 1,
              })
            }
            aria-label="to 필터"
            className="bg-card-strong border border-line text-text-primary text-xs px-3 py-2 rounded-md"
          />
        </div>
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={reset}
            className="text-[11px] px-2 py-1 border border-line rounded-md text-text-tertiary hover:text-text-primary"
          >
            필터 초기화
          </button>
        </div>
      </AdminCard>

      <AdminCard>
        {isLoading && (
          <p className="text-text-tertiary text-sm">로딩 중...</p>
        )}
        {data && data.rows.length === 0 && (
          <p className="text-text-quaternary text-sm">검색 결과 없음</p>
        )}
        {data && data.rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-text-quaternary text-[10px]">
                    <th className="text-left py-2 px-3">시각</th>
                    <th className="text-left py-2 px-3">action</th>
                    <th className="text-left py-2 px-3">target</th>
                    <th className="text-left py-2 px-3">admin</th>
                    <th className="text-left py-2 px-3">IP</th>
                    <th className="text-left py-2 px-3">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => {
                    const meta = AUDIT_ACTION_KR[r.action]
                    return (
                      <tr key={r.id} className="border-b border-line">
                        <td className="py-2 px-3 font-mono text-[10px] text-text-quaternary whitespace-nowrap">
                          {formatKstDateTime(r.createdAt)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                              meta?.tone === 'danger'
                                ? 'bg-danger/10 text-danger border-danger/30'
                                : meta?.tone === 'warning'
                                  ? 'bg-warning/10 text-warning border-warning/30'
                                  : meta?.tone === 'success'
                                    ? 'bg-success/10 text-success border-success/30'
                                    : meta?.tone === 'info'
                                      ? 'bg-info/10 text-info border-info/30'
                                      : 'bg-card-strong text-text-tertiary border-line'
                            }`}
                          >
                            {meta?.icon ?? '•'} {auditActionLabel(r.action)}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px]">
                          {r.targetType}/{r.targetId.slice(0, 8)}...
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px] text-text-tertiary">
                          {r.adminUserId
                            ? `${r.adminUserId.slice(0, 8)}...`
                            : '(system)'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px] text-text-quaternary">
                          {r.ip ?? '-'}
                        </td>
                        <td className="py-2 px-3 max-w-[400px]">
                          <AuditDetailView detail={r.detail} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3">
              <p className="text-text-quaternary text-[11px]">
                {data.total} 건 / page {data.page} / {totalPages} 페이지
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={data.page <= 1}
                  onClick={() =>
                    setFilters({ ...filters, page: data.page - 1 })
                  }
                  className="text-[11px] px-2 py-1 border border-line rounded-md text-text-secondary disabled:opacity-40"
                >
                  ← 이전
                </button>
                <button
                  type="button"
                  disabled={data.page >= totalPages}
                  onClick={() =>
                    setFilters({ ...filters, page: data.page + 1 })
                  }
                  className="text-[11px] px-2 py-1 border border-line rounded-md text-text-secondary disabled:opacity-40"
                >
                  다음 →
                </button>
              </div>
            </div>
          </>
        )}
      </AdminCard>
    </div>
  )
}
