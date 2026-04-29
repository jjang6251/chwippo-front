import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminInquiries, getAdminInquiryDetail, addAdminComment, closeInquiry, type AdminInquiry } from '@/api/admin'
import { type InquiryComment } from '@/api/inquiries'
import { toast } from '@/stores/toastStore'
import dayjs from 'dayjs'

const STATUS_LABEL: Record<string, string> = { OPEN: '미답변', IN_PROGRESS: '답변 중', CLOSED: '완료' }
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-danger bg-danger/10 border-danger/20',
  IN_PROGRESS: 'text-brand bg-brand/10 border-brand/20',
  CLOSED: 'text-text-muted bg-white/5 border-white/10',
}
const CATEGORIES = ['전체', '버그 신고', '기능 추가 요청', '기능 개선', '알림 문의', '계정·개인정보', '사용 방법 문의', '기타']

export function OpsInquiries() {
  const [statusFilter, setStatusFilter] = useState<string>('전체')
  const [catFilter, setCatFilter] = useState('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const qc = useQueryClient()

  const statusParam = statusFilter === '전체' ? undefined : statusFilter

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'inquiries', statusFilter, catFilter],
    queryFn: () => getAdminInquiries({
      status: statusParam,
      category: catFilter === '전체' ? undefined : catFilter,
    }),
    placeholderData: (prev) => prev,
  })

  const { data: detail } = useQuery({
    queryKey: ['admin', 'inquiry', selectedId],
    queryFn: () => getAdminInquiryDetail(selectedId!),
    enabled: !!selectedId,
  })

  const commentMutation = useMutation({
    mutationFn: () => addAdminComment(selectedId!, comment),
    onSuccess: () => {
      setComment('')
      qc.invalidateQueries({ queryKey: ['admin', 'inquiry', selectedId] })
      qc.invalidateQueries({ queryKey: ['admin', 'inquiries'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      toast.success('답변을 남겼어요.')
    },
    onError: () => toast.error('오류가 발생했습니다.'),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeInquiry(selectedId!),
    onSuccess: () => {
      setShowCloseConfirm(false)
      qc.invalidateQueries({ queryKey: ['admin', 'inquiry', selectedId] })
      qc.invalidateQueries({ queryKey: ['admin', 'inquiries'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      toast.success('문의를 완료 처리했어요.')
    },
    onError: () => toast.error('오류가 발생했습니다.'),
  })

  function closeDetailModal() {
    setSelectedId(null)
    setShowCloseConfirm(false)
    setComment('')
  }

  const items = data?.items ?? []
  const open = items.filter((i) => i.status !== 'CLOSED')
  const closed = items.filter((i) => i.status === 'CLOSED')
  const sorted = [...open, ...closed]

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ops" className="text-text-muted hover:text-text-primary text-sm">← 관리자</Link>
        <h1 className="text-xl font-bold">문의 관리</h1>
        <span className="ml-auto text-xs text-text-muted">총 {data?.total ?? 0}건</span>
      </div>

      {/* 필터 드롭다운 */}
      <div className="flex gap-3 mb-5">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-surface-2 border border-white/8 rounded-lg pl-3 pr-8 py-2 text-sm text-text-secondary outline-none focus:border-brand/40 transition-colors cursor-pointer"
          >
            <option value="전체">전체 상태</option>
            <option value="OPEN">미답변</option>
            <option value="IN_PROGRESS">답변 중</option>
            <option value="CLOSED">완료</option>
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">▾</div>
        </div>

        <div className="relative">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="appearance-none bg-surface-2 border border-white/8 rounded-lg pl-3 pr-8 py-2 text-sm text-text-secondary outline-none focus:border-brand/40 transition-colors cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">▾</div>
        </div>
      </div>

      {/* 목록 */}
      {isLoading && !data ? (
        <div className="text-center py-16 text-text-muted text-sm">불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">문의가 없어요.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <AdminInquiryCard key={item.id} item={item} onSelect={() => setSelectedId(item.id)} selected={selectedId === item.id} />
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selectedId && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[detail.status]}`}>
                {STATUS_LABEL[detail.status]}
              </span>
              <span className="text-xs text-text-muted">{detail.category}</span>
              <button onClick={closeDetailModal} className="ml-auto text-text-muted hover:text-text-primary text-xl">×</button>
            </div>

            {/* 내용 스크롤 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <h3 className="text-base font-bold mb-3">{detail.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap mb-6">{detail.content}</p>

              {/* 댓글 */}
              {detail.comments.length > 0 && (
                <div className="flex flex-col gap-3 mb-4">
                  {detail.comments.map((c) => (
                    <AdminCommentBubble key={c.id} comment={c} />
                  ))}
                </div>
              )}
            </div>

            {/* 입력 영역 */}
            {detail.status !== 'CLOSED' ? (
              <div className="px-6 py-4 border-t border-white/5">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="사용자에게 답변을 남겨주세요..."
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-muted resize-none mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCloseConfirm(true)}
                    className="px-4 py-2 border border-white/15 text-text-muted text-sm rounded-lg hover:border-white/30 hover:text-text-secondary transition-colors"
                  >
                    이슈 닫기
                  </button>
                  <button
                    onClick={() => commentMutation.mutate()}
                    disabled={!comment.trim() || commentMutation.isPending}
                    className="flex-1 py-2 bg-brand text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-accent transition-colors"
                  >
                    {commentMutation.isPending ? '전송 중...' : '답변 전송'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-4 border-t border-white/5 text-center text-sm text-text-muted">
                ✅ 완료된 문의입니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 닫기 확인 모달 — z-[60]으로 상세 모달(z-50) 위에 렌더링 */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-xs">
            <h3 className="text-base font-bold mb-2">이슈를 닫을까요?</h3>
            <p className="text-sm text-text-muted mb-6">사용자에게 완료로 표시되고, 댓글을 더 이상 남길 수 없어요.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-text-secondary hover:bg-white/4 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-success/15 text-success border border-success/25 text-sm font-medium hover:bg-success/25 transition-colors"
              >
                {closeMutation.isPending ? '처리 중...' : '닫기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminInquiryCard({ item, onSelect, selected }: { item: AdminInquiry; onSelect: () => void; selected: boolean }) {
  const isClosed = item.status === 'CLOSED'
  return (
    <button
      onClick={onSelect}
      className={`text-left border rounded-xl px-5 py-4 transition-colors relative ${
        selected ? 'border-brand/40 bg-brand/5' :
        isClosed ? 'bg-surface-2/50 border-white/5 opacity-60' :
        'bg-surface-2 border-white/8 hover:border-white/20'
      }`}
    >
      {item.admin_unread > 0 && (
        <span className="absolute top-3 right-4 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {item.admin_unread}
        </span>
      )}
      <div className="flex items-center gap-2 mb-1 pr-6">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
        <span className="text-xs text-text-muted">{item.category}</span>
        <span className="text-xs text-text-muted ml-auto">{dayjs(item.created_at).format('MM.DD')}</span>
      </div>
      <p className="text-sm font-semibold truncate">{item.title}</p>
    </button>
  )
}

function AdminCommentBubble({ comment }: { comment: InquiryComment }) {
  const isAdmin = comment.author_role === 'admin'
  return (
    <div className={`flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-1.5 ${isAdmin ? 'flex-row-reverse' : ''}`}>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isAdmin ? 'bg-brand/15 text-brand' : 'bg-white/8 text-text-muted'}`}>
          {isAdmin ? '취뽀 팀' : '사용자'}
        </span>
        <span className="text-[10px] text-text-muted">{dayjs(comment.created_at).format('MM.DD HH:mm')}</span>
      </div>
      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isAdmin ? 'bg-brand/15 text-text-primary rounded-tr-sm' : 'bg-surface-2 border border-white/8 text-text-secondary rounded-tl-sm'
      }`}>
        {comment.content}
      </div>
    </div>
  )
}
