/**
 * 내 정보 「경력·경험」 경량 폼 — 저장소는 **활동 일지와 같은 `Activity`**, 입구만 둘이다.
 *
 * 계획 A′(`autofill-census-2026-09.md` 최종 갭 목록 🟡 프로젝트 행): 일지로 건너가 다른
 * 폼을 쓰는 건 불편하다는 지적에서 나왔다. 여기서는 **이력서에 옮겨 적을 만큼만** 받고
 * (활동명·유형·기관·역할·기간·성과·지원서용 요약), 로그·회고 같은 깊이는 활동 일지의 몫으로 둔다.
 * 원칙 = 「즉시 활동, 깊이는 나중에」.
 *
 * 유형 칩은 활동 일지의 `TYPE_GROUPS` 를 **그대로** 재사용한다 — 같은 저장소에 다른
 * 분류 목록을 두면 두 화면이 서로 다른 말을 하게 된다. 다만 `mode` 로 **한쪽만** 보여준다:
 * 「경력」 입구에서 동아리를, 「경험」 입구에서 정규직을 고를 수 있으면 방금 추가한 항목이
 * 다른 섹션으로 사라진다 (CEO 2026-09-06 「경험이랑 경력은 분류해야지」).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { InfoModal } from '@/components/myinfo/InfoModal'
import { Field, FieldLabel, ModalSection } from '@/components/myinfo/fields'
import { CharCounter } from '@/components/common/CharCounter'
import { HelpPill } from '@/components/common/HelpPill'
import { SegmentedToggle } from '@/components/common/SegmentedToggle'
import { countChars } from '@/utils/charCount'
import { toast } from '@/stores/toastStore'
import { TYPE_GROUPS, TYPE_KO } from '@/pages/Activity/constants'
import { useCreateActivity, useUpdateActivity } from '@/hooks/useActivities'
import { isCareerType } from '@/types/activity'
import type { Activity, ActivityType, CreateActivityDto, UpdateActivityDto } from '@/types/activity'

/** 지원서용 요약 상한 — 백엔드 계약(≤500)과 같은 숫자 */
export const APPLICATION_SUMMARY_MAX = 500
/** 성과 상한 — `activities.outcome` 기존 계약 */
const OUTCOME_MAX = 200

/** 어느 입구에서 열렸나 — 유형 칩 목록·제목·기본 선택이 여기서 갈린다 */
export type ExperienceFormMode = 'career' | 'experience'

/**
 * 모드별 기본 유형 — **고를 수 없는 값이 기본이면 안 된다**. 경험 모드에서 `intern` 을
 * 기본으로 두면 칩에 없는 값이 선택돼 있고, 그대로 저장하면 방금 만든 항목이 경력 섹션으로
 * 사라진다. 그래서 경험 모드는 첫 비경력 칩(동아리)로 연다.
 */
const DEFAULT_TYPE: Record<ExperienceFormMode, ActivityType> = {
  career: 'intern',
  experience: 'club',
}

const MODE_LABEL: Record<ExperienceFormMode, string> = { career: '경력', experience: '경험' }
const MODE_EMOJI: Record<ExperienceFormMode, string> = { career: '💼', experience: '🌱' }

/**
 * 첫 칸의 말 — 두 모드가 같은 문구를 쓰면 어느 입구로 들어왔는지 화면이 알려주지 못한다
 * (CEO 실기 2026-09-06). 「경력명」을 물으면서 예시가 동아리면 그것도 어긋나므로 예시까지 함께 간다.
 */
const NAME_FIELD: Record<ExperienceFormMode, { section: string; label: string; placeholder: string }> = {
  career:     { section: '경력 정보', label: '경력명', placeholder: '예: 화장품 브랜드 마케팅 인턴' },
  experience: { section: '활동 정보', label: '활동명', placeholder: '예: 마케팅 학회' },
}

const YES_NO = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니오' },
] as const

interface Props {
  /** 경력 입구인가 경험 입구인가 — 편집이면 항목의 유형을 보고 **호출부가** 정한다 */
  mode: ExperienceFormMode
  /** null = 추가 모드 */
  editing: Activity | null
  onClose: () => void
  onDelete?: () => void
}

const EMPTY = {
  name: '',
  type: 'intern' as ActivityType,
  org: '',
  role: '',
  startedAt: '',
  endedAt: '',
  outcome: '',
  applicationSummary: '',
  country: '',
  orgDepartment: '',
  isCurrent: false,
}

export function ExperienceFormModal({ mode, editing, onClose, onDelete }: Props) {
  const isEdit = !!editing
  const [form, setForm] = useState({ ...EMPTY, type: DEFAULT_TYPE[mode] })
  const [saving, setSaving] = useState(false)
  /**
   * 저장을 한 번이라도 눌렀나 — 오류 문장은 **누른 뒤에만** 뜬다. 열자마자 빈 칸에
   * 빨간 글씨가 있으면 「내가 뭘 잘못했나」로 읽힌다. 고치면 문장은 스스로 사라진다.
   */
  const [attempted, setAttempted] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const summaryRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const nameErrorId = useId()
  const summaryErrorId = useId()
  const endErrorId = useId()
  const summaryId = useId()
  const summaryHelpId = useId()
  const typeLabelId = useId()
  const currentLabelId = useId()

  const create = useCreateActivity()
  const update = useUpdateActivity(editing?.id ?? '')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        type: editing.type ?? 'other',
        org: editing.org ?? '',
        role: editing.role ?? '',
        startedAt: editing.startedAt ?? '',
        endedAt: editing.endedAt ?? '',
        outcome: editing.outcome ?? '',
        applicationSummary: editing.applicationSummary ?? '',
        country: editing.country ?? '',
        orgDepartment: editing.orgDepartment ?? '',
        isCurrent: !!editing.isCurrent,
      })
    } else {
      setForm({ ...EMPTY, type: DEFAULT_TYPE[mode] })
    }
  }, [editing, mode])
  /* eslint-enable react-hooks/set-state-in-effect */

  const summaryCount = countChars(form.applicationSummary).total
  const overSummary = summaryCount > APPLICATION_SUMMARY_MAX
  const nameEmpty = !form.name.trim()
  const isCareer = isCareerType(form.type)
  /**
   * 이 모드에서 고를 수 있는 유형만 남긴다. 그룹째 지우지 않고 유형별로 거르는 이유:
   * 나중에 경력 유형이 다른 그룹에 끼어도 「경험 입구에 정규직」이 새지 않는다.
   */
  const typeGroups = TYPE_GROUPS
    .map((g) => ({ ...g, types: g.types.filter((t) => isCareerType(t.v) === (mode === 'career')) }))
    .filter((g) => g.types.length > 0)
  /** 재직 중은 경력에서만 뜻이 있다 — 유형을 바꾸면 켜 둔 값이 따라가지 않는다 */
  const isCurrent = isCareer && form.isCurrent
  const summaryLabel = isCareer ? '담당 업무' : '지원서용 요약'
  const nameField = NAME_FIELD[mode]
  const periodInverted = !isCurrent && !!form.startedAt && !!form.endedAt && form.endedAt < form.startedAt
  /*
    🔴 토스트만으로는 **어느 칸이 문제인지** 알 수 없다. 토스트는 5초 뒤 사라지고,
    칸이 열두 개인 폼에서 사용자는 처음부터 다시 읽는다. 칸 아래 한 줄 + 그 칸으로 포커스.
  */
  const nameError = attempted && nameEmpty
  /**
   * 초과는 **누르기 전에도** 말한다 — 초과하면 [추가] 가 비활성이라, 안 알려 주면
   * 「왜 눌리지 않나」로 남는다. 빈 칸·기간 역전과 달리 사용자가 이미 만든 상태다.
   */
  const summaryError = overSummary
  const periodError = attempted && periodInverted

  const handleSave = async () => {
    if (saving) return
    setAttempted(true)
    if (nameEmpty) {
      // 토스트도 칸 이름 그대로 — 화면은 「경력명」인데 「활동명을 입력해 주세요」면 딴 칸을 찾는다
      toast.error(`${nameField.label}을 입력해 주세요.`)
      nameRef.current?.focus()
      return
    }
    if (overSummary) {
      toast.error(`${summaryLabel}은 ${APPLICATION_SUMMARY_MAX}자까지예요.`)
      summaryRef.current?.focus()
      return
    }
    if (periodInverted) {
      toast.error('종료일은 시작일 이후여야 해요.')
      endRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      // 국가는 「해외 경험」에서만 묻는다 — 다른 유형에선 값이 남아 있어도 보내지 않는다
      const country = form.type === 'overseas' ? form.country.trim() : ''
      // 부서도 같은 규칙 — 경력 밖에서는 실리지 않는다
      const orgDepartment = isCareer ? form.orgDepartment.trim() : ''
      if (isEdit) {
        const dto: UpdateActivityDto = {
          name: form.name.trim(),
          type: form.type,
          org: form.org.trim() || undefined,
          role: form.role.trim() || undefined,
          startedAt: form.startedAt || undefined,
          // 재직 중이면 종료일을 보내지 않는다 — 서버가 `isCurrent` 로 null 처리한다
          endedAt: isCurrent ? undefined : (form.endedAt || undefined),
          outcome: form.outcome.trim() || undefined,
          applicationSummary: form.applicationSummary.trim() || null,
          country: country || null,
          orgDepartment: orgDepartment || null,
          isCurrent,
        }
        await update.mutateAsync(dto)
      } else {
        const dto: CreateActivityDto = {
          name: form.name.trim(),
          type: form.type,
          ...(form.org.trim() ? { org: form.org.trim() } : {}),
          ...(form.role.trim() ? { role: form.role.trim() } : {}),
          ...(form.startedAt ? { startedAt: form.startedAt } : {}),
          ...(!isCurrent && form.endedAt ? { endedAt: form.endedAt } : {}),
          ...(form.outcome.trim() ? { outcome: form.outcome.trim() } : {}),
          ...(form.applicationSummary.trim()
            ? { applicationSummary: form.applicationSummary.trim() }
            : {}),
          ...(country ? { country } : {}),
          ...(orgDepartment ? { orgDepartment } : {}),
          ...(isCurrent ? { isCurrent: true } : {}),
        }
        await create.mutateAsync(dto)
      }
      onClose()
    } catch {
      toast.error('저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <InfoModal
      title={`${MODE_LABEL[mode]} ${isEdit ? '편집' : '추가'}`}
      emoji={MODE_EMOJI[mode]}
      accent="success"
      subtitle={isEdit ? [TYPE_KO[form.type], form.name].filter(Boolean).join(' · ') : undefined}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
      onDelete={onDelete}
      saveLabel={isEdit ? '수정' : '추가'}
      saveDisabled={nameEmpty || overSummary}
    >
      <ModalSection title={nameField.section} first>
        <div className="space-y-3">
          <div>
            <Field
              label={nameField.label}
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder={nameField.placeholder}
              maxLength={100}
              required
              invalid={nameError}
              describedBy={nameError ? nameErrorId : undefined}
              inputRef={nameRef}
            />
            {nameError && (
              <p id={nameErrorId} role="alert" className="mt-1 text-[11px] text-danger">
                {nameField.label}을 입력해 주세요.
              </p>
            )}
          </div>

          <div>
            <FieldLabel label="유형" required id={typeLabelId} />
            {/* 그룹 안에 또 그룹 — 바깥 이름이 「유형」이어야 「채용 형태」 안에서 길을 잃지 않는다 */}
            <div role="group" aria-labelledby={typeLabelId} className="space-y-2.5">
              {typeGroups.map((g) => (
                <div key={g.gl}>
                  <p className="text-[10px] font-medium text-text-quaternary mb-1.5">{g.gl}</p>
                  <div role="group" aria-label={g.gl} className="flex flex-wrap gap-1.5">
                    {g.types.map((t) => {
                      const active = form.type === t.v
                      return (
                        <button
                          key={t.v}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setForm((f) => ({ ...f, type: t.v }))}
                          className={`min-h-[44px] sm:min-h-[36px] px-3 rounded-lg border text-[13px] whitespace-nowrap transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg
                            ${active
                              ? 'bg-surface-3 text-text-primary font-medium border-line-strong'
                              : 'bg-card text-text-tertiary border-line hover:text-text-secondary hover:bg-card-hover'
                            }`}
                        >
                          <span aria-hidden="true" className="mr-1">{t.em}</span>
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 경력은 지원서 경력 칸의 말(회사·부서·직위)로 묻는다 — 그 밖은 기관·역할 그대로 */}
          <Field
            label={isCareer ? '회사' : '기관·회사'}
            value={form.org}
            onChange={(v) => setForm((f) => ({ ...f, org: v }))}
            placeholder="예: 아모레퍼시픽"
            maxLength={100}
          />
          {isCareer && (
            <Field
              label="부서"
              value={form.orgDepartment}
              onChange={(v) => setForm((f) => ({ ...f, orgDepartment: v }))}
              placeholder="예: 브랜드마케팅팀"
              maxLength={100}
            />
          )}
          <Field
            label={isCareer ? '직위·직급' : '역할'}
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            placeholder={isCareer ? '예: 사원 / 대리 / 인턴' : '예: SNS 콘텐츠 기획'}
            maxLength={100}
          />

          {form.type === 'overseas' && (
            <Field
              label="국가"
              value={form.country}
              onChange={(v) => setForm((f) => ({ ...f, country: v }))}
              placeholder="예: 미국"
              maxLength={40}
            />
          )}
        </div>
      </ModalSection>

      <ModalSection title="기간">
        {isCareer && (
          <div className="mb-3">
            <FieldLabel label="재직 중" id={currentLabelId} />
            <SegmentedToggle
              label="재직 중"
              labelledBy={currentLabelId}
              value={form.isCurrent ? 'yes' : 'no'}
              options={YES_NO}
              onChange={(v) => setForm((f) => ({ ...f, isCurrent: v === 'yes' }))}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="시작"
            type="date"
            value={form.startedAt}
            onChange={(v) => setForm((f) => ({ ...f, startedAt: v }))}
          />
          {/* 재직 중이면 종료일은 아직 없는 값이다 — 칸을 남겨 두면 지원서에 거짓이 채워진다 */}
          {!isCurrent && (
            <div>
              <Field
                label="종료"
                type="date"
                value={form.endedAt}
                onChange={(v) => setForm((f) => ({ ...f, endedAt: v }))}
                invalid={periodError}
                describedBy={periodError ? endErrorId : undefined}
                inputRef={endRef}
              />
              {periodError && (
                <p id={endErrorId} role="alert" className="mt-1 text-[11px] text-danger">
                  종료일은 시작일 이후여야 해요.
                </p>
              )}
            </div>
          )}
        </div>
      </ModalSection>

      <ModalSection title={`성과 · ${summaryLabel}`}>
        <div className="space-y-3">
          <Field
            label="성과"
            value={form.outcome}
            onChange={(v) => setForm((f) => ({ ...f, outcome: v }))}
            maxLength={OUTCOME_MAX}
            placeholder="예: 인스타그램 팔로워 30% 증가"
          />
          <div>
            <FieldLabel label={summaryLabel} htmlFor={summaryId} />
            <textarea
              id={summaryId}
              ref={summaryRef}
              value={form.applicationSummary}
              onChange={(e) => setForm((f) => ({ ...f, applicationSummary: e.target.value }))}
              placeholder="지원서 활동 칸에 그대로 옮겨 적을 문장"
              rows={4}
              aria-invalid={summaryError}
              aria-describedby={summaryError ? `${summaryErrorId} ${summaryHelpId}` : summaryHelpId}
              className="w-full bg-input border border-line rounded-xl px-4 py-3 text-base text-text-primary placeholder:text-text-tertiary resize-y focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition-[border-color,box-shadow]"
            />
            <CharCounter current={summaryCount} max={APPLICATION_SUMMARY_MAX} />
            {summaryError && (
              <p id={summaryErrorId} role="alert" className="mt-1 text-[11px] text-danger">
                {summaryLabel}은 {APPLICATION_SUMMARY_MAX}자까지예요.
              </p>
            )}
            <HelpPill label="쓰임" id={summaryHelpId}>
              지원서의 「활동 내용」 칸이 대부분 500자예요 — 그 길이에 맞춰 한 번만 써두면 재사용돼요
            </HelpPill>
          </div>
        </div>
      </ModalSection>
    </InfoModal>
  )
}
