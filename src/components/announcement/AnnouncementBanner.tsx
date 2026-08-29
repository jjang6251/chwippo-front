import { AnnouncementKindChip } from './AnnouncementKindChip'
import type { AnnouncementKind } from '@/types/announcement'

interface Props {
  title: string
  body: string
  kind: AnnouncementKind
  onExpand: () => void
  onDismiss: () => void
}

export function AnnouncementBanner({ title, body, kind, onExpand, onDismiss }: Props) {
  return (
    <div className="w-full bg-brand flex items-start gap-3 px-4 py-2.5 shrink-0 print:hidden">
      <MegaphoneIcon />
      {/*
        🔴 brand 면 위라 모달과 **같은 색을 쓰지 않는다** — 의미색 틴트는 sage 위에서 사라진다.
        배너 칩은 색이 아니라 글자로 종류를 말한다 (`AnnouncementKindChip` 주석 참조).
      */}
      <AnnouncementKindChip kind={kind} variant="onBrand" className="flex-none mt-0.5" />
      <button
        type="button"
        onClick={onExpand}
        aria-label={`공지 상세 보기: ${title}`}
        className="flex-1 min-w-0 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2 overflow-hidden text-left hover:opacity-80 transition-opacity rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bg/60"
      >
        <span className="text-[13px] font-bold text-bg truncate">{title}</span>
        {body && (
          <span className="text-sm text-bg/90 truncate">{body}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="공지 닫기"
        // 히트 영역 44px — 음수 마진으로 띠 높이는 그대로 (터치 규칙 · 2026-08-30 실측 32px)
        className="flex-none w-11 h-11 -my-1.5 -mr-1.5 flex items-center justify-center rounded-lg text-bg/90 hover:text-bg hover:bg-bg/10 active:bg-bg/20 transition-colors text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bg/60"
      >
        ×
      </button>
    </div>
  )
}

function MegaphoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-bg/90 flex-none mt-0.5" aria-hidden="true">
      <path d="M13 2L3 6H1a1 1 0 00-1 1v2a1 1 0 001 1h2l10 4V2z" />
      <path d="M3 9v4" />
    </svg>
  )
}
