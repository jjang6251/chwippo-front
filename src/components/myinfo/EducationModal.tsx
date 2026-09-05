import { useEffect, useId, useState } from 'react'
import { Drawer } from 'vaul'
import type { AdmissionType, CampusType, DayNight, Education, EducationMinor, EducationTrack } from '@/api/myinfo'
import { FileUpload } from '@/components/myinfo/FileUpload'
import { EMPTY_SLOT, resolveFileForSubmit, slotFromExisting, type FileSlot } from '@/utils/fileSlot'
import { toast } from '@/stores/toastStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { SchoolAutocomplete } from './SchoolAutocomplete'
import { MajorAutocomplete } from './MajorAutocomplete'
import type { SchoolKind } from '@/api/schools'
import { SegmentedToggle } from '@/components/common/SegmentedToggle'
import { DurationChips } from '@/components/common/DurationChips'
import { SEMESTER_PRESETS } from '@/utils/durationPresets'
import { HelpPill } from '@/components/common/HelpPill'

const EDUCATION_DEGREES = ['고등학교', '전문대', '대학교 (학사)', '대학원 (석사)', '대학원 (박사)', '기타']
const EDUCATION_STATUSES = ['재학중', '졸업', '졸업예정', '휴학', '수료', '편입', '중퇴']
const MINOR_TYPES = ['복수전공', '부전공', '이중전공', '연계전공', '심화전공']

/** 지원서 8/11 이 묻는 학력 상세 — 옵션이 사이트 간 같아 enum 으로 고정된다 */
const CAMPUS_OPTIONS: { value: CampusType; label: string }[] = [
  { value: 'main', label: '본교' },
  { value: 'branch', label: '분교' },
]
const DAY_NIGHT_OPTIONS: { value: DayNight; label: string }[] = [
  { value: 'day', label: '주간' },
  { value: 'night', label: '야간' },
]
const ADMISSION_OPTIONS: { value: AdmissionType; label: string }[] = [
  { value: 'regular', label: '입학' },
  { value: 'transfer', label: '편입' },
  { value: 'transfer_other', label: '타교 편입' },
]

/**
 * 고등학교 계열 — 지원서가 「인문/자연/예체능」으로 묻고, 특성화고는 따로 센다.
 * 🔴 저장값은 코드고 보이는 글자는 한글이라 공용 `SelectField`(value=label)를 못 쓴다 —
 * 주소의 시/도 칸과 같은 이유다.
 */
const TRACK_OPTIONS: { value: EducationTrack; label: string }[] = [
  { value: 'humanities', label: '인문' },
  { value: 'natural', label: '자연' },
  { value: 'arts', label: '예체능' },
  { value: 'vocational', label: '특성화' },
  { value: 'other', label: '기타' },
]

/** 예 / 아니오 — 해외 학교 여부 */
const YES_NO = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니오' },
] as const

/** 폼 칸 영역 — 데스크탑은 스크롤 컨테이너 자신이, 모바일은 그 안쪽 div 가 두른다 */
const FIELDS_CLASS = 'px-8 pt-2 pb-4'

function degreeToKind(degree: string): SchoolKind | null {
  if (degree === '고등학교') return 'high'
  if (degree === '전문대' || degree === '대학교 (학사)' || degree === '대학원 (석사)' || degree === '대학원 (박사)') return 'univ'
  return null // '기타' 또는 미선택 → 자동완성 비활성
}

// Toss 톤 — 큰 필드 (h-12 48px), rounded-xl, focus 4px halo
const INPUT_MODAL =
  'w-full bg-input border border-line rounded-xl px-4 h-12 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all'
const SELECT_MODAL =
  'w-full appearance-none bg-input border border-line rounded-xl pl-4 pr-11 h-12 text-base text-text-primary cursor-pointer focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-all'

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
  /**
   * 추가 모드에서 미리 고를 학교 단계 — 「최종 학력」 카드의 [+ 대학교 추가] 가 쓴다.
   * 단계를 이미 아는 자리에서 왔는데 다시 고르게 하면 그 카드가 의미가 없다.
   */
  initialDegree?: string
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
  campus_type: 'main' as CampusType,
  day_night: 'day' as DayNight,
  admission_type: 'regular' as AdmissionType,
  total_credits: '',
  is_ged: false,
  track: '' as EducationTrack | '',
  country: '',
}

export function EducationModal({ initial, initialDegree, onClose, onSave, onDelete }: Props) {
  const isEdit = !!initial
  const [form, setForm] = useState(emptyForm)
  const [minors, setMinors] = useState<EducationMinor[]>([])
  const [transcriptSlot, setTranscriptSlot] = useState<FileSlot>(EMPTY_SLOT)
  const [graduationSlot, setGraduationSlot] = useState<FileSlot>(EMPTY_SLOT)
  /**
   * 옛 「기타 증빙」 — 구분 없이 한 칸이던 시절 데이터. **새로 올리는 자리가 아니라서**
   * FileUpload 가 아니라 읽기 전용 행으로 그린다 (지우기만 된다).
   */
  const [legacyFile, setLegacyFile] = useState<{ url: string; size: number | null } | null>(null)
  /**
   * 「해외 학교」 스위치 — 저장값(`country`)에서 파생시키면 켠 직후 국가가 비어 있어 다시
   * 꺼진다. 켠 상태와 채운 값은 다른 것이라 상태를 따로 둔다.
   */
  const [overseas, setOverseas] = useState(false)
  const [saving, setSaving] = useState(false)
  const durationChipsId = useId()

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
        campus_type: initial.campus_type ?? 'main',
        day_night:   initial.day_night ?? 'day',
        admission_type: initial.admission_type ?? 'regular',
        total_credits: initial.total_credits == null ? '' : String(initial.total_credits),
        is_ged:      !!initial.is_ged,
        track:       initial.track ?? '',
        country:     initial.country ?? '',
      })
      setMinors(initial.minors ?? [])
      setOverseas(!!initial.country)
      setTranscriptSlot(slotFromExisting(initial.transcript_file_url, initial.transcript_file_size_bytes))
      setGraduationSlot(slotFromExisting(initial.graduation_file_url, initial.graduation_file_size_bytes))
      setLegacyFile(initial.file_url ? { url: initial.file_url, size: initial.file_size_bytes ?? null } : null)
    } else {
      setForm({
        ...emptyForm,
        degree: initialDegree ?? emptyForm.degree,
        gpa_max: initialDegree === '고등학교' ? '5.0' : '4.5',
      })
      setMinors([])
      setOverseas(false)
      setTranscriptSlot(EMPTY_SLOT)
      setGraduationSlot(EMPTY_SLOT)
      setLegacyFile(null)
    }
  }, [initial, initialDegree])
  /* eslint-enable react-hooks/set-state-in-effect */

  const isHighSchool = form.degree === '고등학교'

  const handleSave = async () => {
    if (saving) return
    if (!form.school_name.trim()) {
      toast.error('학교명을 입력해주세요.')
      return
    }
    const credits = form.total_credits.trim()
    if (credits && !/^\d{1,3}(\.\d)?$/.test(credits)) {
      toast.error('총 이수 학점은 숫자로 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
      const transcript = await resolveFileForSubmit(transcriptSlot, 'myinfo/education')
      const graduation = await resolveFileForSubmit(graduationSlot, 'myinfo/education')
      /** 옛 칸을 지웠으면 빈 문자열로 알린다 (백엔드 EmptyToNull + R2 정리) */
      const legacyCleared = !!initial?.file_url && !legacyFile
      const dto: Omit<Education, 'id'> = {
        school_name: form.school_name,
        major: form.major,
        gpa: form.gpa,
        gpa_max: form.gpa_max,
        start_at: form.start_at,
        end_at: form.end_at,
        location: form.location,
        degree: form.degree,
        status: form.status,
        campus_type: form.campus_type,
        day_night: form.day_night,
        admission_type: form.admission_type,
        minors,
        total_credits: credits ? Number(credits) : undefined,
        // 검정고시는 고등학교에서만 의미가 있다 — 다른 단계에서 켜진 채 넘어가지 않게 자른다
        is_ged: form.degree === '고등학교' ? form.is_ged : false,
        // 계열도 같은 이유로 고등학교 밖에서는 실리지 않는다
        track: form.degree === '고등학교' ? (form.track || undefined) : undefined,
        // 스위치를 끄면 국가를 비운다 — 켠 채 적어 둔 값이 남으면 국내 학교가 해외로 나간다
        country: overseas ? (form.country.trim() || undefined) : '',
        transcript_file_url: transcript.file_url,
        transcript_file_size_bytes: transcript.file_size_bytes,
        graduation_file_url: graduation.file_url,
        graduation_file_size_bytes: graduation.file_size_bytes,
        file_url: legacyFile?.url ?? (legacyCleared ? '' : undefined),
        file_size_bytes: legacyFile ? legacyFile.size : (legacyCleared ? null : undefined),
      }
      await onSave(dto)
      onClose()
    } catch {
      toast.error('저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  const isMobile = useIsMobile()

  const modalHeaderText = (
    <ModalHeaderText isEdit={isEdit} degree={form.degree} schoolName={form.school_name} />
  )

  const modalHeader = (
    <div className="relative shrink-0">
      <ModalCloseButton onClose={onClose} />
      {modalHeaderText}
    </div>
  )

  const fields = (
    <>
      <Section title="학교 정보" first>
        <FieldLabel required>학교 단계</FieldLabel>
        <Select
          label="학교 단계"
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
        {/*
          고등학교의 「계열」은 자유 입력이 아니라 **고정 선택지**다 — 지원서가 인문/자연/
          예체능/특성화로 묻고 그 밖의 표기를 받지 않는다. 대학 이상은 전공 자동완성 그대로.
        */}
        {isHighSchool ? (
          <>
            <FieldLabel>계열</FieldLabel>
            <CodeSelect
              label="계열"
              value={form.track}
              onChange={(v) => setForm((f) => ({ ...f, track: v as EducationTrack | '' }))}
              options={TRACK_OPTIONS}
            />
          </>
        ) : (
          <>
            <FieldLabel>전공</FieldLabel>
            <MajorAutocomplete
              value={form.major}
              onChange={(v) => setForm((f) => ({ ...f, major: v }))}
              placeholder="예: 경영학"
              inputClassName={INPUT_MODAL}
            />
          </>
        )}

        {/* 고등학교는 검정고시 한 칸이면 되고, 그 위 단계는 본/분교·주야·입학구분을 묻는다 */}
        {isHighSchool ? (
          <div className="pt-4">
            <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_ged}
                onChange={(e) => setForm((f) => ({ ...f, is_ged: e.target.checked }))}
                className="w-5 h-5 rounded border-line text-brand focus:ring-2 focus:ring-brand/40 accent-brand"
              />
              <span className="text-sm text-text-secondary font-medium">검정고시</span>
            </label>
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            <div>
              <FieldLabel>캠퍼스</FieldLabel>
              <SegmentedToggle
                label="캠퍼스"
                value={form.campus_type}
                options={CAMPUS_OPTIONS}
                onChange={(v) => setForm((f) => ({ ...f, campus_type: v }))}
              />
            </div>
            <div>
              <FieldLabel>주·야간</FieldLabel>
              <SegmentedToggle
                label="주·야간"
                value={form.day_night}
                options={DAY_NIGHT_OPTIONS}
                onChange={(v) => setForm((f) => ({ ...f, day_night: v }))}
              />
            </div>
            <div>
              <FieldLabel>입학 구분</FieldLabel>
              <SegmentedToggle
                label="입학 구분"
                value={form.admission_type}
                options={ADMISSION_OPTIONS}
                onChange={(v) => setForm((f) => ({ ...f, admission_type: v }))}
              />
            </div>
          </div>
        )}

        {/*
          해외 학교 — 단계와 무관하다 (해외 고등학교도, 해외 대학원도 있다). 켜야만 국가 칸이
          나오는 이유: 국내가 압도적 다수라 항상 보이면 대부분의 사람에게 빈 칸 하나가 는다.
        */}
        <div className="pt-4">
          <FieldLabel>해외 학교</FieldLabel>
          <SegmentedToggle
            label="해외 학교"
            value={overseas ? 'yes' : 'no'}
            options={YES_NO}
            onChange={(v) => setOverseas(v === 'yes')}
          />
          {overseas && (
            <div className="pt-3">
              <Field
                label="국가"
                value={form.country}
                onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                placeholder="예: 미국"
                maxLength={60}
              />
            </div>
          )}
        </div>
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
          {/* 종료일 칸에서 「칩으로 채울 수 있다」를 알려면 칩 묶음이 그 칸의 설명이어야 한다 */}
          <Field
            label="졸업/예정"
            type="date"
            value={form.end_at}
            onChange={(v) => setForm((f) => ({ ...f, end_at: v }))}
            describedBy={durationChipsId}
          />
        </div>
        <DurationChips
          id={durationChipsId}
          className="mt-2.5"
          start={form.start_at}
          presets={SEMESTER_PRESETS}
          label="재학 기간 자동 계산"
          onPick={(end) => setForm((f) => ({ ...f, end_at: end }))}
        />
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
        <HelpPill label="만점 기준">4.3·4.0 만점은 만점 기준을 고르세요 — 지원서가 환산 없이 그대로 받아요</HelpPill>
        {!isHighSchool && (
          <div className="mt-3">
            <Field
              label="총 이수 학점"
              value={form.total_credits}
              onChange={(v) => setForm((f) => ({ ...f, total_credits: v }))}
              placeholder="예: 130"
            />
          </div>
        )}
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

      {/*
        지원 서류 슬롯이 아니라 **여기가 원본**이다 (CEO 2026-09-05) — 같은 증명서를
        슬롯에도 두면 어느 쪽이 최신인지 알 수 없다. 서류함에는 읽기 전용으로 비친다.
      */}
      <Section title="증빙 파일">
        <div role="group" aria-label="성적증명서">
          <FieldLabel>성적증명서</FieldLabel>
          <FileUpload
            slot={transcriptSlot}
            scope="myinfo/education"
            onChange={setTranscriptSlot}
            disabled={saving}
          />
        </div>
        <div className="pt-4" role="group" aria-label="재학·졸업(예정)증명서">
          <FieldLabel>재학·졸업(예정)증명서</FieldLabel>
          <FileUpload
            slot={graduationSlot}
            scope="myinfo/education"
            onChange={setGraduationSlot}
            disabled={saving}
          />
        </div>

        {legacyFile && (
          <div className="mt-4">
            <FieldLabel>기타 증빙(구분 없음)</FieldLabel>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-line rounded-lg">
              <a
                href={legacyFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-secondary hover:text-brand truncate flex-1 transition-colors"
              >
                파일 보기 ↗
              </a>
              <button
                type="button"
                onClick={() => setLegacyFile(null)}
                disabled={saving}
                aria-label="기타 증빙 삭제"
                className="flex-none w-8 h-8 flex items-center justify-center -mr-1.5 text-text-quaternary hover:text-danger transition-colors disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-text-quaternary mt-1.5 pl-1">
              구분이 생기기 전에 올린 파일이에요. 새로 올릴 땐 위 두 칸을 써 주세요.
            </p>
          </div>
        )}
      </Section>
    </>
  )

  const footer = (
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
        className="flex-1 sm:flex-none sm:min-w-[6rem] h-12 px-4 sm:px-5 text-sm font-medium text-text-secondary border border-line rounded-xl hover:bg-card active:bg-card-strong transition-colors disabled:opacity-50"
      >
        취소
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex-1 sm:flex-none sm:min-w-[7rem] h-12 px-4 sm:px-6 text-sm font-bold bg-brand hover:bg-accent active:bg-accent-hover text-bg rounded-xl shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-accent/30 transition-all disabled:opacity-50 disabled:shadow-none"
      >
        {saving ? '저장 중...' : isEdit ? '수정' : '추가'}
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer.Root
        open
        onOpenChange={(open) => { if (!open && !saving) onClose() }}
        shouldScaleBackground={false}
        /* vaul 키보드 보정 해제 — iOS 에서 시트가 두 배로 밀려 올라간다 (근거는 InfoModal.tsx 주석) */
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Drawer.Content
            aria-label={isEdit ? '학력 편집' : '학력 추가'}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line rounded-t-2xl max-h-[92dvh] flex flex-col shadow-2xl outline-none"
          >
            <Drawer.Title className="sr-only">{isEdit ? '학력 편집' : '학력 추가'}</Drawer.Title>
            {/*
              InfoModal 과 같은 구성 — 상단 고정은 drag handle + 닫기 X 뿐이고 emoji·제목·subtitle 은
              스크롤 본문으로 내렸다. 키보드가 올라오면 시트에 남는 세로가 헤더 높이도 안 돼서
              정작 입력칸이 안 보였다 (2026-09-01 iPhone). 데스크탑은 고정 그대로.
            */}
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line-strong shrink-0" aria-hidden="true" />
            <ModalCloseButton onClose={onClose} />
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {modalHeaderText}
              <div className={FIELDS_CLASS}>{fields}</div>
            </div>
            {footer}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => { if (!saving) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? '학력 편집' : '학력 추가'}
        className="bg-surface border border-line rounded-2xl w-full max-w-lg max-h-[calc(100vh-4rem)] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {modalHeader}
        <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${FIELDS_CLASS}`}>
          {fields}
        </div>
        {footer}
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', required, maxLength, describedBy,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  maxLength?: number
  /** 칸 아래 보조 칩·도움말의 id (`aria-describedby`) */
  describedBy?: string
}) {
  // 라벨↔입력 연결 — 없으면 스크린리더가 「입력」 이라고만 읽는다
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-text-secondary mb-2 font-medium">
        {label}
        {required && (
          <span className="text-danger ml-1">
            <span aria-hidden="true">*</span>
            <span className="sr-only">필수</span>
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-required={required}
        aria-describedby={describedBy}
        className={INPUT_MODAL}
      />
    </div>
  )
}

/**
 * 보이는 글자와 저장값이 다른 select — 계열처럼 서버가 **코드값만** 받는 칸.
 * 공용 `SelectField`(value=label)를 못 쓰는 자리이고, chevron 규칙은 동일하게 지킨다.
 */
function CodeSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
}) {
  const id = useId()
  return (
    <div className="relative">
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_MODAL}
      >
        <option value="">선택</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-quaternary pointer-events-none">
        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
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
  const id = useId()
  return (
    <div>
      {!hideLabel && (
        <label htmlFor={id} className="block text-sm text-text-secondary mb-2 font-medium">{label}</label>
      )}
      <div className="relative">
        <select id={id} aria-label={hideLabel ? label : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_MODAL}>
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
        // eslint-disable-next-line chwippo/no-bare-autofocus -- 「+ 추가」 버튼을 눌러야 이 폼이 버튼 자리에 나타난다 — 탭 뒤 등장
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
// 닫기 X 와 제목 묶음을 나눠 둔다 — 모바일은 X 만 고정하고 제목은 본문과 같이 스크롤시키기 때문.

// close X 우상단 — 데스크탑은 헤더 안, 모바일은 시트 상단에 따로 고정해서 쓴다
function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="닫기"
      className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center rounded-lg text-text-quaternary hover:text-text-primary hover:bg-card transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}

// emoji tile + 제목 + subtitle — 데스크탑은 상단 고정, 모바일은 폼과 같이 스크롤된다
function ModalHeaderText({ isEdit, degree, schoolName }: { isEdit: boolean; degree: string; schoolName: string }) {
  const style = DEGREE_STYLE[degree] ?? DEGREE_STYLE['기타']
  return (
    <div className="px-8 pt-8 pb-5">
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
    <div className={first ? '' : 'pt-6 border-t border-line'}>
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
