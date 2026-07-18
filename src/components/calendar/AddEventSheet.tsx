import { useState } from 'react'
import { Drawer } from 'vaul'
import { AddExamScheduleModal } from '@/components/myinfo/AddExamScheduleModal'
import { useCreateDailyNote } from '@/hooks/useCalendar'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { toast } from '@/stores/toastStore'

/**
 * 캘린더 UX 재구성 — 통합 "+" CTA 시트.
 *
 * 캘린더에서 날짜 헤더 옆 `+` 버튼 or 상단 헤더 "일정 추가" 버튼 클릭 시 노출.
 * 라디오 2 종:
 *   - 시험 일정 추가 → AddExamScheduleModal (기존)
 *   - 이 날에 메모 → daily-note POST (그 날짜 · hourSlot=null)
 *
 * 지원 카드 추가는 시트에 포함 X (필드가 많아서 · 보드에서 별도 진입).
 * 모바일 = vaul Drawer / 데스크탑 = 중앙 modal fallback (기존 InfoModal 패턴 참고).
 */
interface Props {
  open: boolean
  defaultDate: string
  onClose: () => void
}

export function AddEventSheet({ open, defaultDate, onClose }: Props) {
  const isMobile = useIsMobile()
  const [pendingType, setPendingType] = useState<'exam' | 'memo' | null>(null)
  const [memoText, setMemoText] = useState('')

  const { mutate: createNote, isPending: isSubmittingMemo } =
    useCreateDailyNote(defaultDate)

  function handleClose() {
    setPendingType(null)
    setMemoText('')
    onClose()
  }

  function handleSaveMemo() {
    const content = memoText.trim()
    if (!content) return
    createNote(
      { date: defaultDate, hourSlot: null, content },
      {
        onSuccess: () => {
          toast.show('메모가 추가됐어요')
          handleClose()
        },
        onError: () => toast.error('메모 추가에 실패했어요'),
      },
    )
  }

  // 시험 선택 → 기존 AddExamScheduleModal 위임
  if (pendingType === 'exam') {
    return (
      <AddExamScheduleModal
        open={open}
        defaultDate={defaultDate}
        onClose={handleClose}
      />
    )
  }

  if (!open) return null

  const body = (
    <div className="p-5">
      {pendingType !== 'memo' ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-quaternary mb-2">
            {defaultDate} 에 추가
          </p>
          <h2 className="text-lg font-bold text-text-primary tracking-tight mb-4">
            뭘 추가할까요?
          </h2>
          <div className="space-y-2">
            <button
              onClick={() => setPendingType('exam')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-violet/8 border border-violet/25 hover:bg-violet/12 transition-colors text-left"
            >
              <span className="text-2xl">📚</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">시험 일정</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">TOEIC · OPIc · 자격증 등</p>
              </div>
              <span className="text-text-quaternary">→</span>
            </button>

            <button
              onClick={() => setPendingType('memo')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-info/6 border border-info/20 hover:bg-info/10 transition-colors text-left"
            >
              <span className="text-2xl">📝</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">이 날 할 일 · 메모</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">간단한 메모 남기기</p>
              </div>
              <span className="text-text-quaternary">→</span>
            </button>
          </div>
          <p className="text-[10px] text-text-quaternary mt-3 text-center">
            지원카드는 보드에서 추가해요
          </p>
        </>
      ) : (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-quaternary mb-2">
            {defaultDate}
          </p>
          <h2 className="text-lg font-bold text-text-primary tracking-tight mb-4">
            할 일 · 메모
          </h2>
          <textarea
            autoFocus
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            maxLength={200}
            placeholder="예: 자소서 초안 다듬기"
            className="w-full h-24 bg-input border border-line rounded-xl p-3 text-base sm:text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand/50 resize-none"
          />
          {/* U19 — 백엔드 daily_notes.content varchar(200) 정합. 카운터는 150자+ 만 노출 */}
          {memoText.length >= 150 && (
            <p className="mt-1 text-right text-[11px] text-warning tabular-nums">
              {memoText.length}/200
            </p>
          )}
          <div className="flex items-center justify-between mt-4 gap-2">
            <button
              onClick={() => setPendingType(null)}
              className="h-10 px-4 rounded-lg border border-line text-text-tertiary hover:text-text-secondary text-xs font-medium"
            >
              ← 뒤로
            </button>
            <button
              onClick={handleSaveMemo}
              disabled={!memoText.trim() || isSubmittingMemo}
              className="h-10 px-5 rounded-lg bg-brand hover:bg-brand-hover text-bg text-xs font-bold disabled:opacity-40"
            >
              {isSubmittingMemo ? '저장 중…' : '저장'}
            </button>
          </div>
        </>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Drawer.Root open onOpenChange={(o) => { if (!o) handleClose() }} shouldScaleBackground={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Drawer.Content
            aria-label="이 날에 추가"
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line rounded-t-2xl max-h-[92dvh] flex flex-col shadow-2xl outline-none"
          >
            <Drawer.Title className="sr-only">이 날에 추가</Drawer.Title>
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line shrink-0" aria-hidden="true" />
            <div className="overscroll-contain overflow-y-auto">{body}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="이 날에 추가"
        className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl overscroll-contain overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>
  )
}
