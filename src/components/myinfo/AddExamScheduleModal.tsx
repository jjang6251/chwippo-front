import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { useCreateExamSchedule, useUpdateExamSchedule } from '@/hooks/useExamSchedules'
import { LANGUAGE_CERT_TYPES, type ExamSchedule, type ExamType } from '@/types/exam-schedule'
import { InfoModal } from './InfoModal'

interface Props {
  open: boolean
  onClose: () => void
  initial?: ExamSchedule | null
  defaultDate?: string
  onDelete?: () => void
}

export function AddExamScheduleModal({ open, onClose, initial, defaultDate, onDelete }: Props) {
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

  const isSaving = create.isPending || update.isPending
  const previewName = initial?.name ?? finalName

  return (
    <InfoModal
      title={isEdit ? '시험 일정 수정' : '시험 일정 추가'}
      emoji="📚"
      accent="violet"
      subtitle={previewName || undefined}
      onClose={onClose}
      onSave={handleSubmit}
      saving={isSaving}
      onDelete={onDelete}
      saveLabel={isEdit ? '수정' : '추가'}
      saveDisabled={!canSubmit}
    >
      <div className="space-y-3">
          {/* 시험 종류 */}
          <div>
            <label className="block text-text-tertiary text-[11px] mb-1.5">종류</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExamType('language')}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${examType === 'language' ? 'border-violet/40 bg-violet/10 text-violet' : 'border-line text-text-quaternary hover:bg-card active:bg-card-strong'}`}
              >어학</button>
              <button
                onClick={() => setExamType('cert')}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${examType === 'cert' ? 'border-violet/40 bg-violet/10 text-violet' : 'border-line text-text-quaternary hover:bg-card active:bg-card-strong'}`}
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
                  className="w-full appearance-none bg-input border border-line rounded-lg pl-3 pr-9 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all cursor-pointer"
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
                className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
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
                className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">시간</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
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
              className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-text-tertiary text-[11px] mb-1.5">메모 (선택)</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="준비물, 목표 점수 등"
              className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-none"
            />
            <p className={`text-[10px] text-right mt-1 ${memo.length >= 500 ? 'text-danger' : memo.length >= 450 ? 'text-warning' : 'text-text-quaternary'}`}>
              {memo.length} / 500
            </p>
          </div>
      </div>
    </InfoModal>
  )
}
