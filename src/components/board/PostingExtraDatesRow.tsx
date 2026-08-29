import { formatPostingDate } from '@/utils/postingDates'
import type { Application } from '@/types/application'

/**
 * 「공고 일정」 — 공고에서 뽑았지만 **스텝이 아닌** 날짜들.
 *
 * 규칙은 「내가 하는 것은 스텝, 기다리거나 가는 날은 캘린더 일정」이다. 합격 발표·신체검사가
 * 스텝 바에 없으면 사용자는 「그 날짜는 안 잡혔나」로 읽으므로, 어디로 갔는지 카드 안에서도
 * 한 번 말해 준다. 결과 시트를 못 본 사람에겐 이게 유일한 안내다.
 *
 * 🔴 완료 체크는 여기 없다 — 그 상태는 캘린더(daily note)가 갖고 있고, 두 군데서 그리면
 * 어느 쪽이 참인지 알 수 없게 된다. 여기는 「어디로 갔는지」만 말한다.
 */
export function PostingExtraDatesRow({ app }: { app: Application }) {
  const extras = app.postingMeta?.extraDates ?? []
  if (extras.length === 0) return null
  return (
    <div className="mt-4 border border-line bg-surface-2 rounded-xl p-5">
      <h2 className="text-text-primary text-sm font-semibold">
        공고 일정{' '}
        <span className="font-mono text-text-quaternary font-normal text-xs">{extras.length}</span>
      </h2>
      {/* 결과 시트의 같은 캡션과 **크기를 갈라 두지 않는다** (DESIGN.md 규칙 7-b) */}
      <p className="text-sm text-text-quaternary mt-1 leading-relaxed">
        발표·검진은 캘린더에 넣었어요 — 당일 아침에 알려드려요
      </p>
      <ul className="mt-3 space-y-1.5">
        {extras.map((e) => {
          // 🔴 결과 시트와 **같은 헬퍼** — 두 벌로 두면 한쪽만 시각을 지어낸다
          const label = formatPostingDate(e.date)
          return (
            <li
              key={e.noteId || `${e.label}-${e.date}`}
              className="flex items-center justify-between gap-2 text-[13px]"
            >
              <span className="text-text-secondary min-w-0 truncate">{e.label}</span>
              <span className="font-mono tabular-nums text-text-tertiary shrink-0">
                {label ?? '—'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
