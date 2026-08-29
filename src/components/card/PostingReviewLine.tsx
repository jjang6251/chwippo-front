import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { jobPostingCardApi } from '@/api/jobPosting'
import { useDemoMode } from '@/contexts/demoMode'

interface Props {
  applicationId: string
  /**
   * 직무가 비어 있나 — 공고 본문에 직무가 없던 카드(JD 가 첨부 파일).
   * 확인할 게 하나 더 있으므로 **무엇을 볼지 문구가 달라진다.**
   */
  missingJobTitle?: boolean
  /** `postingMeta.reviewedAt` — 값이 있으면 렌더하지 않는다 (부모가 판정) */
  onReviewed?: () => void
}

/**
 * 「공고에서 채웠어요 — 날짜를 확인해 주세요 [확인]」 — 카드 상세 **전형 단계 탭 맨 위** 한 줄.
 *
 * ## 결과 시트가 있는데 왜 또 있나
 *
 * 시트는 **보드에 있을 때만** 뜬다. 붙여넣고 바로 다른 화면으로 갔거나, 새로고침했거나,
 * 다른 카드가 시트를 잡고 있었으면 결과를 한 번도 못 본 채 카드만 생긴다. 그때 이 줄이
 * 유일한 「이건 AI 가 채운 값이다」 신호다 — 마감이 틀리면 신뢰가 통째로 깨지는 기능이라
 * 폴백을 반드시 남긴다.
 *
 * ## 사라지는 조건
 *
 * 「확인」·결과 시트의 「좋아요」·**첫 편집** 중 무엇이든 하나. 전부 `reviewedAt` 한 값으로
 * 모인다 — 「봤다」를 세 군데서 따로 세면 어디선가 반드시 어긋난다.
 */
export function PostingReviewLine({ applicationId, missingJobTitle = false, onReviewed }: Props) {
  const isDemo = useDemoMode()
  const [done, setDone] = useState(false)

  if (done) return null

  const confirm = () => {
    // 낙관적으로 지운다 — 실패해도 사용자가 할 일은 없고, 다음 조회에서 다시 뜰 뿐이다
    setDone(true)
    onReviewed?.()
    if (isDemo) return
    void jobPostingCardApi.patchMeta(applicationId, { reviewed: true }).catch(() => {})
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-brand/[0.06] border border-brand/[0.18] rounded-[10px]">
      <Sparkles size={15} strokeWidth={1.75} className="text-brand shrink-0" aria-hidden="true" />
      {/* `break-keep` — 없으면 한글이 글자 단위로 끊겨 조사가 홀로 넘어간다 */}
      <p className="flex-1 min-w-0 text-xs text-text-secondary leading-snug break-keep">
        공고에서 채웠어요 —{' '}
        <strong className="text-brand font-semibold">{missingJobTitle ? '직무와 날짜' : '날짜'}</strong>
        를 확인해 주세요
      </p>
      <button
        type="button"
        onClick={confirm}
        className="shrink-0 -my-2 min-h-[44px] lg:min-h-[32px] px-3 text-xs font-semibold text-brand border border-brand/30 rounded-lg hover:bg-brand/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        확인
      </button>
    </div>
  )
}
