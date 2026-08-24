import { useEffect } from 'react'
import { Pointer, X } from 'lucide-react'
import { markStepNodeHintSeen } from '@/utils/stepNodeHint'

interface Props {
  /** 노출 기록용 — 없으면 부모가 애초에 렌더하지 않는다 */
  userId: string | undefined
  onDismiss: () => void
}

/**
 * 「단계 동그라미를 눌러 이동할 수 있어요」 — **모바일 1회 안내**.
 *
 * ## 왜 모바일만인가
 *
 * 데스크탑은 노드에 마우스를 올리면 툴팁이 뜨고 점이 커진다 — 컨트롤이라는 게 보인다.
 * **터치에는 hover 가 없어서** 그 신호가 통째로 사라진다. 안내가 필요한 건 그쪽뿐이라
 * `lg:hidden` 으로 모바일에만 둔다.
 *
 * ## 왜 그리드 밖·위인가
 *
 * 카드 안에 넣으면 `[grid-auto-rows:1fr]` 때문에 **관계없는 카드까지 전부 커진다**
 * (회사 조사 스트립에서 +112px 실측). 같은 이유로 여기, `CardResearchReveal` 옆에 둔다.
 *
 * ## 기회는 **뜬 순간** 소진된다
 *
 * 마운트 시 기록한다 — 「닫기를 눌러야 소진」으로 두면 스크롤 밖에서 못 보고 지나친 사람에게
 * 매번 다시 뜬다. 닫기 버튼은 **지금 치우는 용도**지 소진 조건이 아니다.
 */
export function StepNodeHint({ userId, onDismiss }: Props) {
  useEffect(() => {
    markStepNodeHintSeen(userId)
  }, [userId])

  return (
    <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-brand/[0.06] border border-brand/[0.18] rounded-[10px] mb-4">
      <Pointer size={15} strokeWidth={1.75} className="text-brand shrink-0" aria-hidden="true" />
      {/* `break-keep` — 없으면 한글이 글자 단위로 끊겨 「있어 / 요」처럼 조사가 홀로 넘어간다 */}
      <p className="flex-1 min-w-0 text-xs text-text-secondary leading-snug break-keep">
        단계 <strong className="text-brand font-semibold">동그라미</strong>를 눌러 옮길 수 있어요
      </p>
      {/* 44px 터치 타겟 — 음수 마진으로 바 높이는 그대로 둔다 */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="안내 닫기"
        className="shrink-0 -my-3 -mr-2 w-11 h-11 flex items-center justify-center text-text-quaternary hover:text-text-primary rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-colors"
      >
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
