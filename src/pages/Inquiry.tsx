import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createInquiry } from '@/api/inquiries'
import { toast } from '@/stores/toastStore'

const CATEGORIES = [
  '버그 신고',
  '기능 추가 요청',
  '기능 개선',
  '알림 문의',
  '계정·개인정보',
  '사용 방법 문의',
  '기타',
]

export function Inquiry() {
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: () => createInquiry({ category, title, content }),
    onSuccess: () => {
      setDone(true)
      toast.success('접수됐어요. 여러분의 피드백이 취뽀를 만들어갑니다 🙏')
    },
    onError: () => toast.error('오류가 발생했습니다. 다시 시도해주세요.'),
  })

  const valid = category && title.trim() && content.trim().length >= 10

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
        <div className="text-4xl">🙏</div>
        <h2 className="text-lg font-bold">문의가 접수됐어요</h2>
        <p className="text-sm text-text-muted leading-relaxed">
          답변은 가입하신 이메일로 발송됩니다.<br />
          소중한 피드백 감사합니다.
        </p>
        <button
          onClick={() => { setDone(false); setCategory(''); setTitle(''); setContent('') }}
          className="mt-4 px-4 py-2 bg-brand/10 text-brand border border-brand/20 rounded-lg text-sm font-medium hover:bg-brand/20 transition-colors"
        >
          새 문의 작성
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-2">문의하기</h1>
      <p className="text-sm text-text-muted mb-8">
        버그, 기능 요청, 무엇이든 알려주세요.<br />
        답변은 가입하신 이메일로 발송됩니다.
      </p>

      <div className="flex flex-col gap-4">
        {/* 카테고리 */}
        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">카테고리 *</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  category === c
                    ? 'bg-brand/15 border-brand/40 text-brand'
                    : 'bg-surface-2 border-white/8 text-text-secondary hover:border-white/20'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
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

        {/* 내용 */}
        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wide block mb-2">
            내용 * <span className="normal-case font-normal">(최소 10자)</span>
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
          className="w-full py-3 bg-brand text-white font-semibold rounded-lg disabled:opacity-40 hover:bg-accent transition-colors"
        >
          {mutation.isPending ? '제출 중...' : '문의 제출'}
        </button>
      </div>
    </div>
  )
}
