/**
 * 보드 위의 **다른 카드들** — 히어로 카드 아래에 놓는 가로 한 줄 압축 카드.
 *
 * 🔴 **배치가 하나다.** 예전엔 데스크탑용 세로 기둥(`stacked`)을 따로 그렸는데, 히어로가
 * 무대 폭을 다 쓰게 되면서(8/29 폭 통일) 옆에 기둥을 둘 자리가 없어졌다. 모양이 둘이면
 * 회사명·직무·단계 표기가 곧 갈라지므로, 자리가 없어진 쪽은 남겨 두지 않고 지운다.
 *
 * 주인공이 아니므로 흐리게 둔다 — 읽히되 **안 읽어도 되는** 정보라는 신호다.
 */
interface Props {
  company: string
  job: string
  stepLabel: string
}

export function TourSideCard({ company, job, stepLabel }: Props) {
  return (
    <div
      data-tour-side
      aria-hidden="true"
      className="opacity-70 rounded-xl border border-line bg-card px-4 py-2.5 flex items-center gap-2"
    >
      <span className="text-[13px] font-semibold text-text-primary">{company}</span>
      <span className="text-[11px] text-text-tertiary truncate">{job}</span>
      <span className="ml-auto shrink-0 text-[10px] text-text-quaternary">{stepLabel}</span>
    </div>
  )
}
