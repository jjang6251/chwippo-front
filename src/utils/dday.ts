import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export function calcDday(deadline: string): number {
  return dayjs(deadline).startOf('day').diff(dayjs().startOf('day'), 'day')
}

export function getDdayLabel(dday: number): string {
  if (dday === 0) return 'D-day'
  if (dday > 0) return `D-${dday}`
  return `D+${Math.abs(dday)}`
}

export type DdayVariant = 'danger' | 'warning' | 'info' | 'muted'

export function getDdayVariant(dday: number): DdayVariant {
  if (dday < 0) return 'muted'
  if (dday <= 2) return 'danger'
  if (dday <= 7) return 'warning'
  return 'info'
}

export function formatDate(date: string): string {
  return dayjs(date).format('M월 D일 (ddd)')
}
