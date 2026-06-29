import { useState } from 'react'

interface Props {
  initialValue: string | null
  onSave: (value: string | null) => void
}

export function PinnedNoteField({ initialValue, onSave }: Props) {
  const [value, setValue] = useState(initialValue ?? '')

  function handleBlur() {
    onSave(value.trim() || null)
  }

  return (
    <div className="border border-brand/30 bg-brand/5 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-brand text-sm">📌</span>
        <p className="text-[10px] font-medium text-brand uppercase tracking-wide">핵심 메모</p>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="면접 당일 꼭 기억할 내용 (예상 질문 답변, 핵심 키워드 등)"
        rows={4}
        maxLength={2000}
        className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none resize-none leading-relaxed"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-brand/60">
          면접 D-1 · 당일에 대시보드 상단에 표시됩니다
        </p>
        <p className={`text-[10px] ${value.length >= 2000 ? 'text-danger' : value.length >= 1800 ? 'text-warning' : 'text-text-quaternary'}`}>
          {value.length} / 2000
        </p>
      </div>
    </div>
  )
}
