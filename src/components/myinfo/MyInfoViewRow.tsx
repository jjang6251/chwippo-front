import { CopyButton } from '@/components/myinfo/CopyButton'

/**
 * MyInfo 보기 모드 — label-value 한 줄.
 * 빈 값은 회색 "—" 로 표시, copyable 일 때만 값이 있을 때 CopyButton 노출.
 */
interface Props {
  label: string
  value?: string | null
  copyable?: boolean
}

export function MyInfoViewRow({ label, value, copyable }: Props) {
  const display = (value ?? '').trim()
  const hasValue = display.length > 0
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line/40 last:border-b-0 min-h-[36px]">
      <span className="text-[11px] text-text-quaternary w-24 shrink-0 font-medium">{label}</span>
      <span className="flex-1 min-w-0 text-sm text-text-primary truncate">
        {hasValue ? display : <span className="text-text-quaternary">—</span>}
      </span>
      {copyable && hasValue && <CopyButton value={display} />}
    </div>
  )
}
