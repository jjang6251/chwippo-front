import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { todayLocal } from '@/utils/datetime'
import { useCreateExamSchedule, useUpdateExamSchedule } from '@/hooks/useExamSchedules'
import { LANGUAGE_CERT_TYPES, type ExamSchedule, type ExamType } from '@/types/exam-schedule'
import { InfoModal } from './InfoModal'
// 창고의 다른 모달(학력·자격증)과 같은 48px 칸 — 한 화면에 40px 이 섞이면 어느 쪽이 정상인지 다시 읽는다
import { FIELD_INPUT_CLASS, FIELD_SELECT_CLASS, FIELD_TEXTAREA_CLASS } from '@/components/myinfo/fields'

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

  // U20 — 인라인 검증. 시험명은 자격증 모드에서만 비어있을 수 있음 (어학은 select 기본값)
  const isNameMissing = examType !== 'language' && name.trim().length === 0
  const isDateMissing = date.length !== 10
  // 과거 시험일 = 경고만 (지난 시험 기록 허용 — 저장 차단 아님)
  const isPastDate = date.length === 10 && date < todayLocal()

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
            <label className="block text-text-tertiary text-[11px] mb-1.5">
              종류 <span className="text-danger">*</span>
            </label>
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
              <label className="block text-text-tertiary text-[11px] mb-1.5">
                시험명 <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value)}
                  className={FIELD_SELECT_CLASS}
                >
                  {LANGUAGE_CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="absolute right-4 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">
                시험명 <span className="text-danger">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 컴퓨터활용능력 1급 필기"
                aria-invalid={isNameMissing}
                aria-describedby={isNameMissing ? 'exam-name-error' : undefined}
                className={FIELD_INPUT_CLASS}
              />
              {isNameMissing && (
                <p id="exam-name-error" role="alert" className="mt-1 text-[11px] text-danger">
                  시험명을 입력해주세요
                </p>
              )}
            </div>
          )}

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">
                시험일 <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={isDateMissing}
                aria-describedby={
                  isDateMissing
                    ? 'exam-date-error'
                    : isPastDate
                      ? 'exam-date-warning'
                      : undefined
                }
                className={FIELD_INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-text-tertiary text-[11px] mb-1.5">시간</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={FIELD_INPUT_CLASS}
              />
            </div>
          </div>
          {/* U20 — 시험일 미입력 사유 / 과거 날짜 경고(저장 차단 아님) */}
          {isDateMissing ? (
            <p id="exam-date-error" role="alert" className="-mt-1 text-[11px] text-danger">
              시험일을 입력해주세요
            </p>
          ) : isPastDate ? (
            <p id="exam-date-warning" role="alert" className="-mt-1 text-[11px] text-warning">
              지난 날짜예요. 기록용으로 저장할 수 있어요.
            </p>
          ) : null}

          {/* 장소 */}
          <div>
            <label className="block text-text-tertiary text-[11px] mb-1.5">장소 (선택)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 홍익대학교 종합교육관"
              className={FIELD_INPUT_CLASS}
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
              className={`${FIELD_TEXTAREA_CLASS} resize-none`}
            />
            <p className={`text-[10px] text-right mt-1 ${memo.length >= 500 ? 'text-danger' : memo.length >= 450 ? 'text-warning' : 'text-text-quaternary'}`}>
              {memo.length} / 500
            </p>
          </div>
      </div>
    </InfoModal>
  )
}
