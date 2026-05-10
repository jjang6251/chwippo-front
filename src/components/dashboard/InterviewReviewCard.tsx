import { useNavigate } from 'react-router-dom'
import { useInterviewReview } from '@/hooks/useDashboard'

export function InterviewReviewCard() {
  const navigate = useNavigate()
  const { data: items = [] } = useInterviewReview()

  if (items.length === 0) return null

  const item = items[0]

  return (
    <button
      onClick={() => navigate(`/board/${item.applicationId}/steps/${item.stepId}`)}
      className="mb-3 w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-info/25 bg-info/5 hover:bg-info/8 transition-colors text-left"
    >
      <span className="text-lg shrink-0">✏️</span>
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-sm font-medium truncate">
          어제 {item.companyName} {item.stepName} 어떠셨나요?
        </p>
        <p className="text-text-quaternary text-xs mt-0.5">후기를 남겨두면 다음 준비에 도움이 돼요</p>
      </div>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-text-quaternary shrink-0">
        <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
