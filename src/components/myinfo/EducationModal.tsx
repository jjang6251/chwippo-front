import { useEffect, useState } from 'react'
import type { Education, EducationMinor } from '@/api/myinfo'
import { FileUpload } from '@/components/myinfo/FileUpload'
import { EMPTY_SLOT, resolveFileForSubmit, slotFromExisting, type FileSlot } from '@/utils/fileSlot'
import { toast } from '@/stores/toastStore'
import { SchoolAutocomplete } from './SchoolAutocomplete'
import { MajorAutocomplete } from './MajorAutocomplete'
import type { SchoolKind } from '@/api/schools'

const EDUCATION_DEGREES = ['고등학교', '전문대', '대학교 (학사)', '대학원 (석사)', '대학원 (박사)', '기타']
const EDUCATION_STATUSES = ['재학중', '졸업', '졸업예정', '휴학', '수료', '편입', '중퇴']
const MINOR_TYPES = ['복수전공', '부전공', '이중전공', '연계전공', '심화전공']

function degreeToKind(degree: string): SchoolKind | null {
  if (degree === '고등학교') return 'high'
  if (degree === '전문대' || degree === '대학교 (학사)' || degree === '대학원 (석사)' || degree === '대학원 (박사)') return 'univ'
  return null // '기타' 또는 미선택 → 자동완성 비활성
}

// Toss 톤 — 큰 필드 (h-12 48px), rounded-xl, focus 4px halo
const INPUT_MODAL =
  'w-full bg-input border border-line/70 rounded-xl px-4 h-12 text-base text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all'
const SELECT_MODAL =
  'w-full appearance-none bg-input border border-line/70 rounded-xl pl-4 pr-11 h-12 text-base text-text-primary cursor-pointer focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all'

const DEGREE_STYLE: Record<string, { emoji: string; ring: string; bg: string; text: string }> = {
  '고등학교':        { emoji: '🏫', ring: 'ring-warning/30', bg: 'bg-warning/10', text: 'text-warning' },
  '전문대':          { emoji: '🎓', ring: 'ring-success/30', bg: 'bg-success/10', text: 'text-success' },
  '대학교 (학사)':   { emoji: '🎓', ring: 'ring-success/30', bg: 'bg-success/10', text: 'text-success' },
  '대학원 (석사)':   { emoji: '📘', ring: 'ring-info/30',    bg: 'bg-info/10',    text: 'text-info' },
  '대학원 (박사)':   { emoji: '📚', ring: 'ring-violet/30',  bg: 'bg-violet/10',  text: 'text-violet' },
  '기타':            { emoji: '🎓', ring: 'ring-brand/30',   bg: 'bg-brand/10',   text: 'text-brand' },
}

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
        className="bg-surface border border-line rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[calc(100dvh-6rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          isEdit={isEdit}
          degree={form.degree}
          schoolName={form.school_name}
          onClose={onClose}
        />
        <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-2 pb-4">
          <Section title="학교 정보" first>
            <FieldLabel required>학교 단계</FieldLabel>
            <Select
              label=""
              hideLabel
              value={form.degree}
              onChange={(v) => setForm((f) => ({
                ...f,
                degree: v,
                gpa_max: f.gpa_max || (v === '고등학교' ? '5.0' : '4.5'),
              }))}
              options={EDUCATION_DEGREES}
            />
            <div className="h-3" />
            <FieldLabel required>학교명</FieldLabel>
            <SchoolAutocomplete
              value={form.school_name}
              onChange={(v) => setForm((f) => ({ ...f, school_name: v }))}
              kind={degreeToKind(form.degree)}
              placeholder={degreeToKind(form.degree) === 'high' ? '고등학교명 입력...' : '대학교명 입력...'}
              inputClassName={INPUT_MODAL}
            />
            <div className="h-3" />
            <FieldLabel>{isHighSchool ? '계열' : '전공'}</FieldLabel>
            {isHighSchool ? (
              <input
                type="text"
                value={form.major}
                onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))}
                placeholder="예: 이과 / 문과 / 자연계열"
                className={INPUT_MODAL}
              />
            ) : (
              <MajorAutocomplete
                value={form.major}
                onChange={(v) => setForm((f) => ({ ...f, major: v }))}
                placeholder="예: 컴퓨터공학"
                inputClassName={INPUT_MODAL}
              />
            )}
          </Section>

          <Section title="재학 기간">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select
                label="상태"
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                options={EDUCATION_STATUSES}
              />
              <Field
                label="입학"
                type="date"
                value={form.start_at}
                onChange={(v) => setForm((f) => ({ ...f, start_at: v }))}
              />
              <Field
                label="졸업/예정"
                type="date"
                value={form.end_at}
                onChange={(v) => setForm((f) => ({ ...f, end_at: v }))}
              />
            </div>
          </Section>

          <Section title="성적">
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
          </Section>

          <Section title="추가 정보">
            <Field
              label="위치"
              value={form.location}
              onChange={(v) => setForm((f) => ({ ...f, location: v }))}
              placeholder="선택 입력"
            />

            {/* 복수·부전공 — 대학교/대학원에서만 */}
            {!isHighSchool && (
              <div className="pt-3">
                <FieldLabel>복수·부전공</FieldLabel>
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
          </Section>

          <Section title="증빙 파일">
            <FileUpload
              slot={slot}
              scope="myinfo/education"
              onChange={setSlot}
              hint="예: 졸업증명서, 성적증명서, 재학증명서"
              disabled={saving}
            />
          </Section>
        </div>
        <div className="flex items-center gap-2 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-line bg-surface shrink-0">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              aria-label="삭제"
              className="shrink-0 inline-flex items-center gap-1 text-xs text-text-quaternary hover:text-danger w-11 h-11 sm:w-auto sm:h-12 sm:px-3 justify-center transition-colors disabled:opacity-50"
            >
              <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">삭제</span>
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 sm:flex-none sm:min-w-[6rem] h-12 px-4 sm:px-5 text-sm font-medium text-text-secondary border border-line/70 rounded-xl hover:bg-card active:bg-card-strong transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-none sm:min-w-[7rem] h-12 px-4 sm:px-6 text-sm font-bold bg-brand hover:bg-accent active:bg-accent-hover text-text-primary rounded-xl shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-accent/30 transition-all disabled:opacity-50 disabled:shadow-none"
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
      <label className="block text-sm text-text-secondary mb-2 font-medium">
        {label}
        {required && <span className="text-danger ml-1" aria-label="필수 입력">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_MODAL}
      />
    </div>
  )
}

function Select({
  label, value, onChange, options, hideLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  hideLabel?: boolean
}) {
  return (
    <div>
      {!hideLabel && (
        <label className="block text-sm text-text-secondary mb-2 font-medium">{label}</label>
      )}
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_MODAL}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
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
        className="w-9 h-9 flex items-center justify-center rounded-full text-brand hover:bg-brand/15 transition-colors ml-auto"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={reset}
        aria-label="취소"
        className="w-9 h-9 flex items-center justify-center rounded-full text-text-quaternary hover:text-text-secondary transition-colors"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ── 헤더 (노션 페이지 톤 — 큰 emoji + title 세로) ────────
function ModalHeader({ isEdit, degree, schoolName, onClose }: { isEdit: boolean; degree: string; schoolName: string; onClose: () => void }) {
  const style = DEGREE_STYLE[degree] ?? DEGREE_STYLE['기타']
  return (
    <div className="relative px-8 pt-8 pb-5 shrink-0">
      {/* close X 우상단 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-primary hover:bg-card transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* 큰 emoji tile — 노션 페이지 감정 */}
      <div className="text-4xl leading-none mb-3" aria-hidden="true">
        {style.emoji}
      </div>

      <h3 className="text-xl font-bold text-text-primary leading-tight">
        {isEdit ? '학력 편집' : '학력 추가'}
      </h3>
      <p className={`text-xs mt-1 truncate font-medium ${schoolName ? style.text : 'text-text-quaternary'}`}>
        {[degree, schoolName].filter(Boolean).join(' · ') || '학교 단계부터 선택해주세요'}
      </p>
    </div>
  )
}

// ── 섹션 (flat + 큰 subheader + 상단 divider) ───────────
function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={first ? '' : 'pt-6 border-t border-line/50'}>
      <p className="text-[13px] font-bold text-text-primary mb-3.5">
        {title}
      </p>
      {children}
    </div>
  )
}

// ── 필드 라벨 (required 별표 포함) ───────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm text-text-secondary mb-2 font-medium">
      {children}
      {required && <span className="text-danger ml-1" aria-label="필수 입력">*</span>}
    </label>
  )
}
