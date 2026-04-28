import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAdminInquiries, updateAdminInquiry, type Inquiry } from '@/api/admin'
import { toast } from '@/stores/toastStore'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '미답변',
  IN_PROGRESS: '처리중',
  RESOLVED: '완료',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-danger bg-danger/10 border-danger/20',
  IN_PROGRESS: 'text-warning bg-warning/10 border-warning/20',
  RESOLVED: 'text-success bg-success/10 border-success/20',
}

export function OpsInquiries() {
  const [filter, setFilter] = useState<string | undefined>(undefined)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [reply, setReply] = useState('')
  const [nextStatus, setNextStatus] = useState('RESOLVED')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'inquiries', filter],
    queryFn: () => getAdminInquiries({ status: filter }),
  })

  const mutation = useMutation({
    mutationFn: () => updateAdminInquiry(selected!.id, { status: nextStatus, adminReply: reply || undefined }),
    onSuccess: () => {
      toast.success('저장됐어요.')
      qc.invalidateQueries({ queryKey: ['admin', 'inquiries'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setSelected(null)
      setReply('')
    },
    onError: () => toast.error('오류가 발생했습니다.'),
  })

  function openInquiry(item: Inquiry) {
    setSelected(item)
    setReply(item.admin_reply ?? '')
    setNextStatus(item.status)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ops" className="text-text-muted hover:text-text-primary text-sm">← 관리자</Link>
        <h1 className="text-xl font-bold">문의 관리</h1>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {[undefined, 'PENDING', 'IN_PROGRESS', 'RESOLVED'].map((s) => (
          <button
            key={s ?? 'all'}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === s
                ? 'bg-brand/15 border-brand/40 text-brand'
                : 'bg-surface-2 border-white/8 text-text-secondary hover:border-white/20'
            }`}
          >
            {s ? STATUS_LABEL[s] : '전체'}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted self-center">
          총 {data?.total ?? 0}건
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-text-muted text-sm">불러오는 중...</div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">문의가 없어요.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {data?.items.map((item) => (
            <button
              key={item.id}
              onClick={() => openInquiry(item)}
              className="text-left bg-surface-2 border border-white/5 rounded-xl px-5 py-4 hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="text-xs text-text-muted">{item.category}</span>
                <span className="text-xs text-text-muted ml-auto">
                  {new Date(item.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <p className="text-sm font-semibold truncate">{item.title}</p>
              <p className="text-xs text-text-muted mt-0.5 truncate">{item.content}</p>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>
              <span className="text-xs text-text-muted">{selected.category}</span>
              <button onClick={() => setSelected(null)} className="ml-auto text-text-muted hover:text-text-primary text-xl leading-none">×</button>
            </div>

            <h3 className="text-base font-bold mb-3">{selected.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap mb-6">{selected.content}</p>

            <div className="border-t border-white/5 pt-4">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">답변</label>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                placeholder="사용자에게 보낼 답변을 입력하세요 (선택)"
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-muted resize-none mb-3"
              />
              <div className="flex gap-2 items-center">
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50 transition-colors"
                >
                  <option value="PENDING">미답변</option>
                  <option value="IN_PROGRESS">처리중</option>
                  <option value="RESOLVED">완료</option>
                </select>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="flex-1 py-2 bg-brand text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-accent transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
