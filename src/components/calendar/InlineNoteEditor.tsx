import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useUpdateDailyNote } from '@/hooks/useCalendar'
import { toast } from '@/stores/toastStore'

/**
 * 캘린더 할 일 메모 인라인 편집기 (묶음 6b · 공용).
 * DayDetailContent 할 일 행 · AgendaEventCard note 카드에서 공유.
 *
 * - auto-resize textarea (1줄 시작 → 최대 6줄, 이후 내부 스크롤 — 200자 풀텍스트가 데스크탑에서 스크롤 없이 보이는 높이)
 *   · text-base = 모바일 16px 로 iOS 확대(줌) 방지 · 데스크탑은 max-w 로 행 전체 폭 확장 방지
 * - 200자 하드캡 (백엔드 @MaxLength(200) 정합) + 160자부터 카운터 노출
 * - Enter 저장 (한글 IME 조합 확정 Enter 는 무시) · Shift+Enter 무동작(줄바꿈 미지원) · ESC 취소
 * - blur = 변경 있으면 저장, 없으면 취소 (저장 버튼 mousedown preventDefault 로 이중 저장 차단)
 * - 저장 성공 시에만 종료 · 실패 시 토스트 + 편집 유지(입력값 보존)
 * - 빈 값 저장 시도 = 원값 유지 후 종료 (삭제 아님)
 */
export const NOTE_MAX = 200
const COUNTER_FROM = 150 // 기존 할 일 추가 입력의 NOTE_COUNTER_THRESHOLD 와 동일 관례

interface Props {
  note: { id: string; content: string; date: string; hourSlot: number | null }
  onDone: () => void
}

export function InlineNoteEditor({ note, onDone }: Props) {
  const [value, setValue] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { mutate: updateNote } = useUpdateDailyNote(note.date)

  // auto-resize — max-h-28(≈4줄) 상한, 그 이상은 내부 스크롤
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const trimmed = value.trim()
  const canSave = trimmed !== '' && !saving

  function commit() {
    if (saving) return
    // 빈 값·변경 없음 → 저장 없이 종료 (원값 유지)
    if (trimmed === '' || trimmed === note.content) {
      onDone()
      return
    }
    setSaving(true)
    updateNote(
      { id: note.id, content: trimmed },
      {
        onSuccess: () => onDone(),
        onError: () => {
          setSaving(false)
          toast.error('저장에 실패했어요. 다시 시도해주세요')
        },
      },
    )
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return // 한글 IME 조합 확정 Enter 는 무시
      e.preventDefault() // 줄바꿈 미지원 (Shift+Enter 포함)
      if (!e.shiftKey) commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // 시트·패널의 ESC 닫기로 전파 차단 — 편집 취소만
      onDone() // 취소 — 원값 유지
    }
  }

  function handleBlur() {
    if (saving) return
    if (trimmed === '' || trimmed === note.content) onDone()
    else commit()
  }

  return (
    <div className="flex-1 min-w-0 sm:max-w-lg flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <textarea
          data-note-editor
          ref={textareaRef}
          rows={1}
          autoFocus
          value={value}
          maxLength={NOTE_MAX}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          aria-label="할 일 수정"
          className="w-full resize-none max-h-40 sm:max-h-28 overflow-y-auto overscroll-contain bg-transparent text-base sm:text-xs text-text-primary outline-none py-2 sm:py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:opacity-60"
        />
        {value.length >= COUNTER_FROM && (
          <p aria-live="polite" className="text-right text-[11px] text-warning tabular-nums leading-none pb-1">
            {value.length}/{NOTE_MAX}
          </p>
        )}
      </div>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        disabled={!canSave}
        aria-label="저장"
        className="shrink-0 whitespace-nowrap h-8 px-3 text-[13px] sm:h-7 sm:px-2.5 sm:text-[12px] rounded-lg bg-brand text-bg font-semibold flex items-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
      >
        저장
      </button>
    </div>
  )
}
