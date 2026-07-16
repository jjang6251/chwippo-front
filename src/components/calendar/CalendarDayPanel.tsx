import type { CalendarEvent } from '@/api/calendar'
import { DayDetailContent } from './DayDetailContent'

/**
 * 데스크탑 사이드 aside 패널 — 공유 `DayDetailContent` 를 그대로 렌더.
 * (모바일은 `CalendarDaySheet` 가 같은 내용을 바텀시트로 렌더)
 */
interface Props {
  date: string
  events: CalendarEvent[]
  onClose?: () => void
}

export function CalendarDayPanel(props: Props) {
  return <DayDetailContent {...props} />
}
