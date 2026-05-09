import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useTodayDailyNotes, useCreateDailyNote, useUpdateDailyNote, useDeleteDailyNote, useCarryOverDailyNote } from '@/hooks/useCalendar'
import type { DailyNote } from '@/api/calendar'

const BASE_HOUR = 6

function slotToLabel(slot: number) {
  const totalMins = BASE_HOUR * 60 + slot * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function TodosSection() {
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

  const { data: notes = [], isLoading } = useTodayDailyNotes()
  const { mutate: create } = useCreateDailyNote(today)
  const { mutate: update } = useUpdateDailyNote(today)
  const { mutate: remove } = useDeleteDailyNote(today)
  const { mutate: carryOver } = useCarryOverDailyNote()

  const [input, setInput] = useState('')

  const todayUnscheduled = notes.filter((n) => n.date === today && n.hourSlot === null)
  const todayScheduled = notes
    .filter((n) => n.date === today && n.hourSlot !== null)
    .sort((a, b) => (a.hourSlot ?? 0) - (b.hourSlot ?? 0))
  const yesterdayMissed = notes.filter((n) => n.date === yesterday && n.hourSlot === null && !n.isDone)

  const doneCount = todayUnscheduled.filter((n) => n.isDone).length
  const totalCount = todayUnscheduled.length

  function handleAdd(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || !input.trim()) return
    create({ date: today, hourSlot: null, content: input.trim() })
    setInput('')
  }

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text-primary text-base font-semibold">✅ 오늘 할 일</h2>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-surface-2 border border-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-text-primary text-base font-semibold">✅ 오늘 할 일</h2>
        {totalCount > 0 && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            doneCount === totalCount
              ? 'bg-success/15 text-success border border-success/20'
              : 'bg-white/8 text-text-tertiary border border-white/10'
          }`}>
            {doneCount} / {totalCount} 완료
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* 입력창 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border border-white/8 rounded-lg focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/15 transition-all">
          <svg className="text-text-quaternary flex-none" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleAdd}
            placeholder="할 일 추가 (엔터로 등록)"
            className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none"
          />
        </div>

        {/* 시간 없는 오늘 할 일 */}
        {todayUnscheduled.length > 0 ? (
          <div className="space-y-1">
            {todayUnscheduled.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onToggle={() => update({ id: note.id, isDone: !note.isDone })}
                onDelete={() => remove(note.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-text-quaternary text-xs text-center py-3">오늘 할 일을 추가해보세요</p>
        )}

        {/* 시간순 캘린더 할 일 */}
        {todayScheduled.length > 0 && (
          <div>
            <p className="text-text-quaternary text-[10px] font-medium mb-1.5 px-1 flex items-center gap-1.5">
              <span>📅</span> 시간대별
            </p>
            <div className="space-y-1">
              {todayScheduled.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  timeLabel={slotToLabel(note.hourSlot!)}
                  onToggle={() => update({ id: note.id, isDone: !note.isDone })}
                  onDelete={() => remove(note.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 어제 미완료 */}
        {yesterdayMissed.length > 0 && (
          <div>
            <p className="text-text-quaternary text-[10px] font-medium mb-1.5 px-1">어제 미완료</p>
            <div className="space-y-1">
              {yesterdayMissed.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onToggle={() => update({ id: note.id, isDone: !note.isDone })}
                  onDelete={() => remove(note.id)}
                  carryOverButton
                  onCarryOver={() => carryOver(note.id)}
                  dimmed
                />
              ))}
            </div>
          </div>
        )}

        {/* 캘린더 링크 */}
        <Link
          to="/calendar"
          className="flex items-center justify-center gap-1.5 text-[11px] text-text-quaternary hover:text-text-secondary py-1.5 transition-colors group"
        >
          <span>📅</span>
          <span>캘린더에서 전체 보기</span>
          <svg className="group-hover:translate-x-0.5 transition-transform" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 5h6M5 2l3 3-3 3" />
          </svg>
        </Link>
      </div>
    </section>
  )
}

interface NoteItemProps {
  note: DailyNote
  timeLabel?: string
  onToggle: () => void
  onDelete: () => void
  onCarryOver?: () => void
  carryOverButton?: boolean
  dimmed?: boolean
}

function NoteItem({ note, timeLabel, onToggle, onDelete, onCarryOver, carryOverButton, dimmed }: NoteItemProps) {
  return (
    <div className={`group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/4 transition-colors ${dimmed ? 'opacity-60' : ''}`}>
      <button
        aria-label={note.isDone ? '완료 취소' : '완료 표시'}
        onClick={onToggle}
        className={`flex-none w-4 h-4 rounded border transition-colors ${
          note.isDone ? 'bg-success border-success' : 'border-white/8 hover:border-success/60'
        }`}
      >
        {note.isDone && (
          <svg viewBox="0 0 10 10" fill="none" className="w-full h-full p-0.5">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {timeLabel && (
        <span className="flex-none text-[10px] font-mono text-text-quaternary w-9 shrink-0">{timeLabel}</span>
      )}

      <span className={`flex-1 text-xs min-w-0 truncate ${note.isDone ? 'line-through text-text-quaternary' : 'text-text-secondary'}`}>
        {note.content}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {carryOverButton && onCarryOver && (
          <button
            onClick={onCarryOver}
            className="text-[10px] text-brand hover:text-accent px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
          >
            오늘로
          </button>
        )}
        <button
          aria-label="삭제"
          onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center text-text-quaternary hover:text-danger transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
