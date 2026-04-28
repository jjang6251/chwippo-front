import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInquiryDetail, addComment, type InquiryComment } from '@/api/inquiries'
import { toast } from '@/stores/toastStore'
import dayjs from 'dayjs'

const STATUS_LABEL = { OPEN: '답변 대기', IN_PROGRESS: '답변 중', CLOSED: '완료' }
const STATUS_COLOR = {
  OPEN: 'text-warning bg-warning/10 border-warning/20',
  IN_PROGRESS: 'text-brand bg-brand/10 border-brand/20',
  CLOSED: 'text-text-muted bg-white/5 border-white/10',
}

export function InquiryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inquiries', id],
    queryFn: () => getInquiryDetail(id!),
    enabled: !!id,
  })

  const mutation = useMutation({
    mutationFn: () => addComment(id!, comment),
    onSuccess: () => {
      setComment('')
      qc.invalidateQueries({ queryKey: ['inquiries', id] })
      qc.invalidateQueries({ queryKey: ['inquiries', 'my'] })
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  if (isLoading || !data) {
    return <div className="max-w-lg mx-auto px-4 py-16 text-center text-text-muted text-sm">불러오는 중...</div>
  }

  const isClosed = data.status === 'CLOSED'

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/inquiry')} className="text-text-muted hover:text-text-primary text-sm transition-colors">← 문의 내역</button>
      </div>

      {/* 문의 정보 */}
      <div className="bg-surface-2 border border-white/8 rounded-xl px-5 py-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[data.status]}`}>
            {STATUS_LABEL[data.status]}
          </span>
          <span className="text-xs text-text-muted">{data.category}</span>
          <span className="text-xs text-text-muted ml-auto">{dayjs(data.created_at).format('YYYY.MM.DD')}</span>
        </div>
        <h2 className="text-base font-bold mb-2">{data.title}</h2>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{data.content}</p>
      </div>

      {/* 댓글 스레드 */}
      {data.comments.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">
          {data.comments.map((c) => (
            <CommentBubble key={c.id} comment={c} isMe={c.author_role === 'user'} />
          ))}
        </div>
      )}

      {/* 완료 안내 or 댓글 입력 */}
      {isClosed ? (
        <div className="text-center py-6 text-sm text-text-muted bg-surface-2 border border-white/5 rounded-xl">
          ✅ 이 문의는 완료 처리됐어요.
        </div>
      ) : (
        <div className="bg-surface-2 border border-white/8 rounded-xl p-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="추가로 궁금한 점이 있으면 남겨주세요..."
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-muted resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={() => mutation.mutate()}
              disabled={!comment.trim() || mutation.isPending}
              className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-accent transition-colors"
            >
              {mutation.isPending ? '전송 중...' : '전송'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CommentBubble({ comment, isMe }: { comment: InquiryComment; isMe: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          isMe ? 'bg-brand/15 text-brand' : 'bg-white/8 text-text-muted'
        }`}>
          {isMe ? '나' : '취뽀 팀'}
        </span>
        <span className="text-[10px] text-text-muted">{dayjs(comment.created_at).format('MM.DD HH:mm')}</span>
      </div>
      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isMe
          ? 'bg-brand/15 text-text-primary rounded-tr-sm'
          : 'bg-surface border border-white/8 text-text-secondary rounded-tl-sm'
      }`}>
        {comment.content}
      </div>
    </div>
  )
}
