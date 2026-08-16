import { Drawer } from 'vaul'
import type { CalendarEvent } from '@/api/calendar'
import { DayDetailContent } from './DayDetailContent'

/**
 * U1 — 모바일 날짜 상세 바텀시트.
 *
 * 월 그리드 셀 탭 · "+N개" 탭 · 아젠다 날짜 헤더 탭 시 열림 (모바일 전용).
 * AddEventSheet 의 vaul Drawer 패턴 재사용. 스크롤 영역 overscroll-contain.
 * 하단 풀폭 "이 날짜에 일정 추가" CTA → 해당 날짜로 AddEventSheet 열기.
 */
interface Props {
  open: boolean
  date: string | null
  events: CalendarEvent[]
  onClose: () => void
  onAddOnDate: (date: string) => void
}

export function CalendarDaySheet({ open, date, events, onClose, onAddOnDate }: Props) {
  if (!open || !date) return null

  return (
    <Drawer.Root open onOpenChange={(o) => { if (!o) onClose() }} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Drawer.Content
          aria-label="날짜 상세"
          onPointerDownOutside={(e) => {
            // 삭제 undo 토스트("되돌리기") 클릭은 outside-dismiss 로 치지 않음 — 시트 유지
            const target = e.target as HTMLElement | null
            if (target?.closest('[data-toast-container]')) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            // 인라인 편집 중 ESC 는 편집 취소만 — 시트 닫기로 삼키지 않음 (캡처 단계라 에디터 stopPropagation 으론 못 막음)
            const target = e.target as HTMLElement | null
            if (target?.closest('[data-note-editor]')) e.preventDefault()
          }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line rounded-t-2xl max-h-[90dvh] flex flex-col shadow-2xl outline-none"
        >
          <Drawer.Title className="sr-only">날짜 상세</Drawer.Title>
          <div className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-line-strong shrink-0" aria-hidden="true" />

          <div className="overscroll-contain overflow-y-auto flex-1">
            <DayDetailContent date={date} events={events} onClose={onClose} />
          </div>

          {/* 하단 CTA */}
          <div className="px-5 pt-2 pb-6 border-t border-line bg-surface shrink-0">
            <button
              onClick={() => onAddOnDate(date)}
              className="w-full h-12 rounded-xl bg-brand hover:bg-accent text-bg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 1v10M1 6h10" />
              </svg>
              이 날짜에 일정 추가
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
