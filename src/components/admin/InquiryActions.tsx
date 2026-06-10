import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminInquiriesApi } from '@/api/adminInquiries'
import { toast } from '@/stores/toastStore'

/**
 * PR_B2 Phase 4 — inquiry detail 의 assign / priority / SLA inline edit.
 */
interface Props {
  inquiry: {
    id: string
    assignedTo?: string | null
    priority?: 'high' | 'medium' | 'low'
    slaDeadlineAt?: string | null
  }
}

export function InquiryActions({ inquiry }: Props) {
  const qc = useQueryClient()
  const { data: admins } = useQuery({
    queryKey: ['admin', 'inquiries', 'admins'],
    queryFn: adminInquiriesApi.listAdmins,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'inquiry', inquiry.id] })
    qc.invalidateQueries({ queryKey: ['admin', 'inquiries'] })
    qc.invalidateQueries({ queryKey: ['admin', 'notifications', 'badges'] })
  }

  const assign = useMutation({
    mutationFn: (assignedTo: string | null) =>
      adminInquiriesApi.assign(inquiry.id, { assignedTo }),
    onSuccess: () => {
      toast.show('담당자 변경 완료')
      invalidate()
    },
    onError: () => toast.show('변경 실패 — 다시 시도'),
  })

  const setPriority = useMutation({
    mutationFn: (priority: 'high' | 'medium' | 'low') =>
      adminInquiriesApi.setPriority(inquiry.id, {
        priority,
        recalcSla: true,
      }),
    onSuccess: () => {
      toast.show('우선순위 변경 완료')
      invalidate()
    },
    onError: () => toast.show('변경 실패'),
  })

  const [slaInput, setSlaInput] = useState(
    inquiry.slaDeadlineAt
      ? new Date(inquiry.slaDeadlineAt).toISOString().slice(0, 16)
      : '',
  )

  const setSla = useMutation({
    mutationFn: () =>
      adminInquiriesApi.setSla(inquiry.id, {
        deadlineAt: new Date(slaInput).toISOString(),
      }),
    onSuccess: () => {
      toast.show('SLA 변경 완료')
      invalidate()
    },
    onError: (e) =>
      toast.show(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'SLA 변경 실패',
      ),
  })

  return (
    <div className="bg-card-strong border border-line rounded-lg p-3 space-y-2.5">
      <h3 className="text-text-secondary text-xs font-semibold mb-1">
        📋 처리 정보
      </h3>

      {/* assign */}
      <div className="flex items-center gap-2">
        <label className="text-text-tertiary text-xs w-16">담당자</label>
        <select
          value={inquiry.assignedTo ?? ''}
          onChange={(e) => assign.mutate(e.target.value || null)}
          aria-label="담당자 선택"
          className="appearance-none flex-1 bg-card border border-line text-text-primary text-xs px-2 py-1 rounded-md pr-7"
        >
          <option value="">(미배정)</option>
          {admins?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nickname}
            </option>
          ))}
        </select>
      </div>

      {/* priority */}
      <div className="flex items-center gap-2">
        <label className="text-text-tertiary text-xs w-16">우선순위</label>
        <div className="flex gap-1 flex-1">
          {(['high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority.mutate(p)}
              className={`flex-1 text-[10px] font-semibold py-1 rounded border ${
                inquiry.priority === p
                  ? p === 'high'
                    ? 'bg-danger/15 text-danger border-danger/30'
                    : p === 'medium'
                      ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-info/15 text-info border-info/30'
                  : 'bg-card border-line text-text-tertiary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* sla = 처리 기한 (Service Level Agreement) */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <label className="text-text-tertiary text-xs w-16">처리 기한</label>
          <input
            type="datetime-local"
            value={slaInput}
            onChange={(e) => setSlaInput(e.target.value)}
            aria-label="처리 기한 deadline"
            className="flex-1 bg-card border border-line text-text-primary text-xs px-2 py-1 rounded-md"
          />
          <button
            type="button"
            onClick={() => setSla.mutate()}
            disabled={!slaInput || setSla.isPending}
            className="text-[10px] bg-brand text-text-primary px-2 py-1 rounded-md font-semibold disabled:opacity-40"
          >
            설정
          </button>
        </div>
        <p className="text-text-quaternary text-[10px] pl-[64px]">
          ℹ️ 이 시각까지 답변해야 하는 약속 (default high 4h / medium 24h / low 72h).
          초과 시 알림 종에 빨간 점 표시
        </p>
      </div>
    </div>
  )
}
