import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createInquiry } from '@/api/inquiries'
import { toast } from '@/stores/toastStore'

const CATEGORIES = ['버그 신고', '기능 추가 요청', '기능 개선', '알림 문의', '계정·개인정보', '사용 방법 문의', '기타']

export function InquiryNew() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const mutation = useMutation({
    mutationFn: () => createInquiry({ category, title, content }),
    onSuccess: (data) => {
      toast.success('접수됐어요. 여러분의 피드백이 치뽀를 만들어갑니다 🙏')
      qc.invalidateQueries({ queryKey: ['inquiries', 'my'] })
      navigate(`/inquiry/${data.id}`)
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const valid = category && title.trim() && content.trim().length >= 10

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/inquiry')} className="text-text-muted hover:text-text-primary text-sm transition-colors">← 문의 내역</button>
        <h1 className="text-xl font-bold">새 문의</h1>
      </div>

      <p className="text-sm text-text-muted mb-8">
        버그, 기능 요청, 무엇이든 알려주세요.<br />
        답변은 앱 안 문의 내역에서 확인할 수 있어요.
      </p>

      <div className="flex flex-col gap-5">
        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">카테고리 *</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none bg-surface-2 border border-white/8 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors pr-8"
            >
              <option value="" disabled>카테고리 선택</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">▾</div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">제목 *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="간단하게 설명해주세요"
            className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">
            내용 * <span className="normal-case font-normal text-text-muted">(최소 10자)</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="자세히 알려주실수록 더 빠르게 도움드릴 수 있어요."
            className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-colors placeholder:text-text-muted resize-none"
          />
          <p className="text-xs text-text-muted text-right mt-1">{content.length} / 2000</p>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          className="w-full py-3 bg-brand text-white font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent transition-colors"
        >
          {mutation.isPending ? '제출 중...' : '문의 제출'}
        </button>
      </div>
    </div>
  )
}
