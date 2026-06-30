import { useEffect, useState } from 'react'
import type { Education, EducationMinor } from '@/api/myinfo'
import { FileUpload } from '@/components/myinfo/FileUpload'
import { EMPTY_SLOT, resolveFileForSubmit, slotFromExisting, type FileSlot } from '@/utils/fileSlot'
import { INPUT_BASE_SM, SELECT_BASE_SM } from '@/utils/inputStyles'
import { toast } from '@/stores/toastStore'

const EDUCATION_DEGREES = ['고등학교', '전문대', '대학교 (학사)', '대학원 (석사)', '대학원 (박사)', '기타']
const EDUCATION_STATUSES = ['재학중', '졸업', '졸업예정', '휴학', '수료', '편입', '중퇴']
const MINOR_TYPES = ['복수전공', '부전공', '이중전공', '연계전공', '심화전공']

interface Props {
  initial?: Education | null
  onClose: () => void
  onSave: (dto: Omit<Education, 'id'>) => Promise<void>
  onDelete?: () => void
}

const emptyForm = {
  school_name: '',
  major: '',
  gpa: '',
  gpa_max: '',
  start_at: '',
  end_at: '',
  location: '',
  degree: '대학교 (학사)',
  status: '재학중',
}

export function EducationModal({ initial, onClose, onSave, onDelete }: Props) {
  const isEdit = !!initial
  const [form, setForm] = useState(emptyForm)
  const [minors, setMinors] = useState<EducationMinor[]>([])
  const [slot, setSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [saving, setSaving] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initial) {
      setForm({
        school_name: initial.school_name ?? '',
        major:       initial.major ?? '',
        gpa:         initial.gpa ?? '',
        gpa_max:     initial.gpa_max ?? '',
        start_at:    initial.start_at ?? '',
        end_at:      initial.end_at ?? '',
        location:    initial.location ?? '',
        degree:      initial.degree ?? '대학교 (학사)',
        status:      initial.status ?? '재학중',
      })
      setMinors(initial.minors ?? [])
      setSlot(slotFromExisting(initial.file_url, initial.file_size_bytes))
    } else {
      setForm(emptyForm)
      setMinors([])
      setSlot(EMPTY_SLOT)
    }
  }, [initial])
  /* eslint-enable react-hooks/set-state-in-effect */

  const isHighSchool = form.degree === '고등학교'

  const handleSave = async () => {
    if (saving) return
    if (!form.school_name.trim()) {
      toast.error('학교명을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const fileFields = await resolveFileForSubmit(slot, 'myinfo/education')
      const dto: Omit<Education, 'id'> = {
        ...form,
        minors,
        file_url: fileFields.file_url ?? undefined,
        file_size_bytes: fileFields.file_size_bytes ?? undefined,
      }
      await onSave(dto)
      onClose()
    } catch {
      toast.error('저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:pb-0"
      onClick={() => { if (!saving) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? '학력 편집' : '학력 추가'}
        className="bg-surface border border-line rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-text-primary px-6 pt-6 pb-3 shrink-0">
          {isEdit ? '학력 편집' : '학력 추가'}
        </h3>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-3">
          <Field
            label="학교명"
            value={form.school_name}
            onChange={(v) => setForm((f) => ({ ...f, school_name: v }))}
            placeholder="예: 서울대학교 / ○○고등학교"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="학교 단계"
              value={form.degree}
              onChange={(v) => setForm((f) => ({
                ...f,
                degree: v,
                gpa_max: f.gpa_max || (v === '고등학교' ? '5.0' : '4.5'),
              }))}
              options={EDUCATION_DEGREES}
            />
            <Select
              label="상태"
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={EDUCATION_STATUSES}
            />
          </div>
          <Field
            label={isHighSchool ? '계열' : '전공'}
            value={form.major}
            onChange={(v) => setForm((f) => ({ ...f, major: v }))}
            placeholder={isHighSchool ? '예: 이과 / 문과 / 자연계열' : '예: 컴퓨터공학'}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="학점"
              value={form.gpa}
              onChange={(v) => setForm((f) => ({ ...f, gpa: v }))}
              placeholder="예: 3.8"
            />
            <Field
              label="만점"
              value={form.gpa_max}
              onChange={(v) => setForm((f) => ({ ...f, gpa_max: v }))}
              placeholder="예: 4.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="입학일"
              type="date"
              value={form.start_at}
              onChange={(v) => setForm((f) => ({ ...f, start_at: v }))}
            />
            <Field
              label="졸업/예정일"
              type="date"
              value={form.end_at}
              onChange={(v) => setForm((f) => ({ ...f, end_at: v }))}
            />
          </div>
          <Field
            label="위치"
            value={form.location}
            onChange={(v) => setForm((f) => ({ ...f, location: v }))}
            placeholder="선택 입력"
          />

          {/* 복수·부전공 — 대학교/대학원에서만 */}
          {!isHighSchool && (
          <div className="pt-2">
            <label className="block text-xs text-text-tertiary mb-1.5 font-medium">복수·부전공</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {minors.map((m, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 text-[11px] bg-card border border-line rounded-full pl-2.5 pr-1 py-1"
                >
                  <span className="text-text-quaternary">{m.type}</span>
                  <span className="text-text-secondary">·</span>
                  <span className="text-text-primary">{m.name}</span>
                  {m.gpa && (
                    <>
                      <span className="text-text-secondary">·</span>
                      <span className="text-text-tertiary font-mono tabular-nums">
                        {m.gpa}{m.gpa_max ? `/${m.gpa_max}` : ''}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setMinors((arr) => arr.filter((_, i) => i !== idx))}
                    aria-label="제거"
                    className="w-5 h-5 flex items-center justify-center rounded-full text-text-quaternary hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
              <MinorAddChip onAdd={(m) => setMinors((arr) => [...arr, m])} />
            </div>
          </div>
          )}

          {/* 파일 첨부 */}
          <div className="pt-2">
            <FileUpload
              slot={slot}
              scope="myinfo/education"
              onChange={setSlot}
              hint="예: 졸업증명서, 성적증명서, 재학증명서"
              disabled={saving}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6 border-t border-line shrink-0">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="text-xs text-text-quaternary hover:text-danger px-2 py-2.5 transition-colors disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-w-[5rem] py-2.5 text-xs text-text-secondary border border-line rounded-lg hover:bg-card active:bg-card-strong transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-w-[5rem] py-2.5 text-xs font-semibold bg-brand hover:bg-accent active:bg-accent-hover text-text-primary rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : isEdit ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-text-tertiary mb-1.5 font-medium">
        {label}
        {required && <span className="text-danger ml-0.5" aria-label="필수 입력">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_BASE_SM}
      />
    </div>
  )
}

function Select({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div>
      <label className="block text-xs text-text-tertiary mb-1.5 font-medium">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_BASE_SM}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

function MinorAddChip({ onAdd }: { onAdd: (m: EducationMinor) => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(MINOR_TYPES[0])
  const [name, setName] = useState('')
  const [gpa, setGpa] = useState('')
  const [gpaMax, setGpaMax] = useState('')

  const reset = () => { setName(''); setGpa(''); setGpaMax(''); setOpen(false) }
  const submit = () => {
    if (!name.trim()) return
    onAdd({
      type,
      name: name.trim(),
      gpa: gpa.trim() || undefined,
      gpa_max: gpaMax.trim() || undefined,
    })
    reset()
  }
  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
    if (e.key === 'Escape') reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-text-quaternary hover:text-text-secondary bg-card hover:bg-card active:bg-card-strong border border-line border-dashed rounded-full px-2.5 py-1 transition-colors"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M4.5 1.5v6M1.5 4.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        추가
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-card border border-line rounded-lg px-2 py-1.5 w-full">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="text-[11px] bg-card hover:bg-card-strong text-text-secondary px-2 py-1 rounded-md focus:outline-none transition-colors"
      >
        {MINOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleEnter}
        autoFocus
        placeholder="전공명"
        className="text-[11px] bg-card text-text-primary placeholder:text-text-tertiary outline-none w-24 px-2 py-1 rounded-md border border-transparent focus:border-brand/40 transition-colors"
      />
      <span className="text-text-quaternary text-[10px]">·</span>
      <input
        value={gpa}
        onChange={(e) => setGpa(e.target.value)}
        onKeyDown={handleEnter}
        placeholder="학점"
        className="text-[11px] bg-card text-text-primary placeholder:text-text-tertiary outline-none w-14 px-2 py-1 rounded-md border border-transparent focus:border-brand/40 transition-colors font-mono tabular-nums"
      />
      <span className="text-text-quaternary text-[10px]">/</span>
      <input
        value={gpaMax}
        onChange={(e) => setGpaMax(e.target.value)}
        onKeyDown={handleEnter}
        placeholder="만점"
        className="text-[11px] bg-card text-text-primary placeholder:text-text-tertiary outline-none w-14 px-2 py-1 rounded-md border border-transparent focus:border-brand/40 transition-colors font-mono tabular-nums"
      />
      <button
        type="button"
        onClick={submit}
        aria-label="추가"
        className="w-7 h-7 flex items-center justify-center rounded-full text-brand hover:bg-brand/15 transition-colors ml-auto"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={reset}
        aria-label="취소"
        className="w-7 h-7 flex items-center justify-center rounded-full text-text-quaternary hover:text-text-secondary transition-colors"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
