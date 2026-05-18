import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { useCreateExamSchedule, useUpdateExamSchedule } from '@/hooks/useExamSchedules'
import { LANGUAGE_CERT_TYPES, type ExamSchedule, type ExamType } from '@/types/exam-schedule'

interface Props {
  open: boolean
  onClose: () => void
  initial?: ExamSchedule | null
  defaultDate?: string
}

export function AddExamScheduleModal({ open, onClose, initial, defaultDate }: Props) {
  const isEdit = !!initial
  const [examType, setExamType] = useState<ExamType>('language')
  const [certType, setCertType] = useState<string>('TOEIC')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [location, setLocation] = useState('')
  const [memo, setMemo] = useState('')

  const create = useCreateExamSchedule()
  const update = useUpdateExamSchedule(initial?.id ?? '')

  // 모달이 열릴 때 initial / defaultDate를 폼 state에 동기화
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (initial) {
      setExamType(initial.exam_type)
      setCertType(initial.cert_type ?? 'TOEIC')
      setName(initial.name)
      const d = dayjs(initial.exam_date)
      setDate(d.format('YYYY-MM-DD'))
      setTime(d.format('HH:mm'))
      setLocation(initial.location ?? '')
      setMemo(initial.memo ?? '')
    } else {
      setExamType('language')
      setCertType('TOEIC')
      setName('')
      setDate(defaultDate ?? dayjs().format('YYYY-MM-DD'))
      setTime('09:00')
      setLocation('')
      setMemo('')
    }
  }, [open, initial, defaultDate])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null

  const finalName = examType === 'language' ? certType : name.trim()
  const canSubmit = finalName.length > 0 && date.length === 10

  function handleSubmit() {
    if (!canSubmit) return
    const exam_date = `${date}T${time}:00+09:00`
    const payload = {
      exam_type: examType,
      cert_type: examType === 'language' ? certType : undefined,
      name: finalName,
      exam_date,
      location: location.trim() || undefined,
      memo: memo.trim() || undefined,
    }
    if (isEdit && initial) {
      update.mutate(payload, { onSuccess: onClose })
    } else {
      create.mutate(payload, { onSuccess: onClose })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-0">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={isEdit ? '시험 일정 수정' : '시험 일정 추가'} className="relative z-10 w-full max-w-md bg-surface border border-white/8 rounded-t-xl sm:rounded-xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-text-primary text-sm font-semibold">{isEdit ? '시험 일정 수정' : '시험 일정 추가'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-tertiary hover:bg-white/5 transition-colors" aria-label="닫기">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 space-y-3">
          {/* 시험 종류 */}
          <div>
            <label className="block text-text-tertiary text-[11px] mb-1.5">종류</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExamType('language')}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${examType === 'language' ? 'border-violet/40 bg-violet/10 text-violet' : 'border-white/8 text-text-quaternary hover:bg-white/5'}`}
              >어학</button>
              <button
                onClick={() => setExamType('cert')}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${examType === 'cert' ? 'border-violet/40 bg-violet/10 text-violet' : 'border-white/8 text-text-quaternary hover:bg-white/5'}`}
              >자격증</button>
            </div>
          </div>

          {/* 어학: 드롭다운 / 자격증: 자유 입력 */}
          {examType === 'language' ? (
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">시험명</label>
              <div className="relative">
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value)}
                  className="w-full appearance-none bg-surface-2 border border-white/8 rounded-lg pl-3 pr-9 py-2 text-xs text-text-primary focus:outline-none focus:border-violet/40 transition-colors [color-scheme:dark] cursor-pointer"
                >
                  {LANGUAGE_CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">시험명</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 정보처리기사 필기"
                className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-violet/40 transition-colors"
              />
            </div>
          )}

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">시험일</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-violet/40 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">시간</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-violet/40 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* 장소 */}
          <div>
            <label className="block text-text-tertiary text-[11px] mb-1.5">장소 (선택)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 홍익대학교 종합교육관"
              className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-violet/40 transition-colors"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-text-tertiary text-[11px] mb-1.5">메모 (선택)</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="준비물, 목표 점수 등"
              className="w-full bg-surface-2 border border-white/8 rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-violet/40 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-white/6 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/8 text-text-tertiary text-xs hover:bg-white/5 transition-colors"
          >취소</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || create.isPending || update.isPending}
            className="flex-1 py-2 rounded-lg bg-violet text-text-primary text-xs font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >{isEdit ? '수정' : '추가'}</button>
        </div>
      </div>
    </div>
  )
}
