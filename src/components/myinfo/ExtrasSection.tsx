/**
 * 「우대·기타」 섹션 본문 — 보훈 · 장애(민감정보) · 추가 정보 슬롯.
 *
 * 왜 한 섹션인가: 지원서 폼 실측에서 보훈 9/11 · 장애 8/11 로 거의 모든 폼이 묻는데,
 * **대부분의 사용자는 「비대상」 한 번 저장으로 끝난다**(`autofill-census-2026-09.md`).
 * 그래서 기본값을 비대상으로 두고, 「대상」일 때만 칸을 편다.
 *
 * 🔴 장애 4칸은 **민감정보**라 별도 동의 카드 뒤에만 나온다. 동의 전에는 칸 자체가
 * 렌더되지 않으므로 저장 경로가 없다(백엔드도 `sensitive_consent` 없으면 400).
 *
 * 프레임(`SectionCard`)은 `MyInfo.tsx` 가 씌운다 — 여기는 본문만 그린다.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from '@/stores/toastStore'
import {
  useProfile, useUpdateProfile, useFieldDictionary, useUpdateExtraFields,
} from '@/hooks/useMyinfo'
import type {
  DisabilityGrade, FieldDictionaryEntry, PatriotRelation, UpdateProfileDto,
} from '@/api/myinfo'
import { SegmentedToggle } from '@/components/common/SegmentedToggle'
import { HelpPill } from '@/components/common/HelpPill'
import { Field, FieldLabel, SelectField } from '@/components/myinfo/fields'
import { Modal } from '@/components/common/Modal'

/** §17 고정 문장 — 사용자 대면 표면 전부에 같은 문장이 들어간다. 변경은 CEO 승인. */
export const AI_NO_PII_SENTENCE = '이 정보는 AI 에 전달되지 않습니다.'

const YES_NO = [
  { value: 'no', label: '비대상' },
  { value: 'yes', label: '대상' },
] as const

const PATRIOT_RELATIONS: { value: PatriotRelation; label: string }[] = [
  { value: 'self', label: '본인' },
  { value: 'family', label: '가족' },
  { value: 'bereaved', label: '유족' },
]

const PATRIOT_RATES = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
] as const

const DISABILITY_GRADES: { value: DisabilityGrade; label: string }[] = [
  { value: 'severe', label: '심한 장애' },
  { value: 'mild', label: '심하지 않은 장애' },
]

const BOOL_OPTIONS = [
  { value: 'true', label: '예' },
  { value: 'false', label: '아니오' },
] as const

function notifySaveError(err: unknown) {
  const shown = (err as { config?: { _toastShown?: boolean } } | null)?.config?._toastShown
  if (!shown) toast.error('저장에 실패했어요.')
}

/**
 * 저장값 → 세그먼트 값. `null` = **아직 안 골랐다** — 어느 쪽도 눌린 상태가 아니다.
 * 🔴 「비대상」이 기본으로 눌려 보이면 저장 전인데도 답한 줄 알고, 게이지는 계속 미완료라 어긋난다.
 */
const yn = (v: boolean | null): 'yes' | 'no' | null => (v == null ? null : v ? 'yes' : 'no')

// ────────────────────────────────────────────────────────────
export function ExtrasSectionBody({ onSaved, focus, focusSeq }: {
  onSaved: () => void
  /** 게이지 칩이 지목한 칸 — `patriot` | `disability`. 그 토글로 스크롤·포커스한다 */
  focus?: string
  /** 같은 칩을 다시 눌러도 다시 움직이게 하는 값 (옵션이 같으면 effect 가 안 뛴다) */
  focusSeq?: number
}) {
  const { data: profile } = useProfile()
  const { mutate: update, isPending } = useUpdateProfile()
  const patriotRef = useRef<HTMLDivElement>(null)
  const disabilityRef = useRef<HTMLDivElement>(null)
  const patriotLabelId = useId()
  const patriotHelpId = useId()
  const disabilityLabelId = useId()
  const disabilityHelpId = useId()
  const disabilityGradeLabelId = useId()

  const [form, setForm] = useState({
    patriot_yn: null as boolean | null,
    patriot_number: '',
    patriot_relation: '' as PatriotRelation | '',
    patriot_rate: '' as '' | '0' | '5' | '10',
    disability_yn: null as boolean | null,
    disability_grade: '' as DisabilityGrade | '',
    disability_type: '',
    disability_number: '',
  })
  const [loaded, setLoaded] = useState(false)
  /** 이 세션에서 [동의] 를 누른 경우 — 서버 `sensitive_consent_at` 이 돌아오기 전에도 칸을 연다 */
  const [justConsented, setJustConsented] = useState(false)
  /**
   * 이 세션에서 [철회] 가 성공한 경우 — 캐시의 `sensitive_consent_at` 이 아직 옛 값이어도
   * 즉시 닫는다. 재조회를 기다리면 방금 지운 칸이 잠깐 더 보인다.
   */
  const [justRevoked, setJustRevoked] = useState(false)
  /** [동의하지 않음] 을 누른 경우 — 저장하지 않고 카드만 접는다 */
  const [declined, setDeclined] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)

  if (profile && !loaded) {
    setForm({
      patriot_yn: profile.patriot_yn ?? null,
      patriot_number: profile.patriot_number ?? '',
      patriot_relation: profile.patriot_relation ?? '',
      patriot_rate: profile.patriot_rate == null ? '' : (String(profile.patriot_rate) as '0' | '5' | '10'),
      disability_yn: profile.disability_yn ?? null,
      disability_grade: profile.disability_grade ?? '',
      disability_type: profile.disability_type ?? '',
      disability_number: profile.disability_number ?? '',
    })
    setLoaded(true)
  }

  /*
    게이지의 「보훈 여부」·「장애 정보」 칩 — 섹션 위가 아니라 **그 토글**로 데려간다 (추가 정보가
    길어 섹션 상단에서는 안 보인다). 동의 전이면 장애 블록엔 동의 카드가 있으니 그 첫 버튼에 선다.
  */
  useEffect(() => {
    if (!focus) return
    const el = focus === 'patriot' ? patriotRef.current : focus === 'disability' ? disabilityRef.current : null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line chwippo/no-bare-autofocus -- 게이지 칩을 탭한 뒤에만 도는 이동이다 (열자마자 포커스가 아니다)
    el.querySelector<HTMLElement>('button')?.focus()
  }, [focus, focusSeq])

  const save = (dto: UpdateProfileDto) =>
    update(dto, { onSuccess: onSaved, onError: notifySaveError })

  /** 🔴 장애 4칸은 항상 동의 플래그를 함께 싣는다 — 빠지면 백엔드가 400 으로 막는다 */
  const saveSensitive = (dto: UpdateProfileDto) => save({ ...dto, sensitive_consent: true })

  /**
   * 철회 — 동의 카드가 「동의 철회 시 즉시 삭제」를 약속하므로 철회 경로가 있어야 한다.
   * 🔴 body 는 **`sensitive_consent: false` 하나뿐**이다. 민감 필드를 같이 보내면 400 이고,
   * 지우는 건 서버 몫이다(장애 4필드를 null 로 비운다). 프론트는 지운 결과만 로컬에 반영한다.
   */
  const revokeConsent = () =>
    update(
      { sensitive_consent: false },
      {
        onSuccess: () => {
          setJustConsented(false)
          setJustRevoked(true)
          setForm((f) => ({
            ...f,
            // 서버가 지운 값이다 — 「비대상」이 아니라 **미선택**으로 돌아간다
            disability_yn: null,
            disability_grade: '',
            disability_type: '',
            disability_number: '',
          }))
          setRevokeOpen(false)
          onSaved()
        },
        onError: (err) => {
          setRevokeOpen(false)
          notifySaveError(err)
        },
      },
    )

  const consented = justConsented || (!justRevoked && !!profile?.sensitive_consent_at)

  return (
    <div className="space-y-6">
      {/* ── 보훈 ───────────────────────────────────────── */}
      <div ref={patriotRef}>
        <FieldLabel label="보훈 대상 여부" id={patriotLabelId} />
        <SegmentedToggle
          label="보훈 대상 여부"
          labelledBy={patriotLabelId}
          describedBy={form.patriot_yn === true ? undefined : patriotHelpId}
          value={yn(form.patriot_yn)}
          options={YES_NO}
          onChange={(v) => {
            const next = v === 'yes'
            setForm((f) => ({ ...f, patriot_yn: next }))
            save({ patriot_yn: next })
          }}
        />
        {/* 미선택 → 「한 번 눌러 달라」, 비대상 저장 → 「이걸로 끝」. 대상이면 아래 칸이 설명한다 */}
        {form.patriot_yn == null ? (
          <HelpPill label="확인" id={patriotHelpId}>한 번 눌러 확인해 주세요 — 비대상이면 그대로 끝이에요</HelpPill>
        ) : form.patriot_yn === false ? (
          <HelpPill label="대부분" id={patriotHelpId}>비대상이면 여기서 끝이에요 — 지원서의 보훈 칸이 자동으로 「비대상」으로 채워져요</HelpPill>
        ) : null}

        {form.patriot_yn && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Field
              label="보훈 번호"
              value={form.patriot_number}
              onChange={(v) => setForm((f) => ({ ...f, patriot_number: v }))}
              onBlur={() => save({ patriot_number: form.patriot_number || null })}
              maxLength={30}
              placeholder="국가보훈 등록번호"
              spellCheck={false}
            />
            {/*
              🔴 저장 전에는 **아무것도 눌려 있지 않다**. 「본인」·「0%」를 미리 눌러 두면
              사용자는 이미 답한 줄 알고 넘어가는데 서버에는 값이 없다 (보훈 여부와 같은 규칙).
            */}
            <div>
              <FieldLabel label="관계" />
              <SegmentedToggle
                label="보훈 대상과의 관계"
                value={form.patriot_relation || null}
                options={PATRIOT_RELATIONS}
                onChange={(v) => {
                  setForm((f) => ({ ...f, patriot_relation: v }))
                  save({ patriot_relation: v })
                }}
              />
            </div>
            <div>
              <FieldLabel label="가점 비율" />
              <SegmentedToggle
                label="보훈 가점 비율"
                value={form.patriot_rate || null}
                options={PATRIOT_RATES}
                onChange={(v) => {
                  setForm((f) => ({ ...f, patriot_rate: v }))
                  save({ patriot_rate: Number(v) })
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 장애 (민감정보) ─────────────────────────────── */}
      <div className="pt-6 border-t border-line" ref={disabilityRef}>
        <p className="text-[13px] font-bold text-text-primary mb-3">장애 정보</p>

        {!consented ? (
          declined ? (
            <div className="rounded-xl border border-line bg-card px-4 py-3.5">
              <p className="text-sm text-text-tertiary leading-relaxed">
                장애 정보는 저장하지 않아요. 지원서의 해당 칸은 직접 입력하시면 됩니다.
              </p>
              <button
                type="button"
                onClick={() => setDeclined(false)}
                className="mt-2 text-[11px] font-medium text-brand hover:text-accent min-h-[44px] sm:min-h-0 sm:py-1 transition-colors"
              >
                동의 안내 다시 보기
              </button>
            </div>
          ) : (
            <SensitiveConsentCard
              onAgree={() => {
                setJustConsented(true)
                setJustRevoked(false)
                save({ sensitive_consent: true })
              }}
              onDecline={() => setDeclined(true)}
            />
          )
        ) : (
          <div>
            <FieldLabel label="장애 여부" id={disabilityLabelId} />
            <SegmentedToggle
              label="장애 여부"
              labelledBy={disabilityLabelId}
              describedBy={disabilityHelpId}
              value={yn(form.disability_yn)}
              options={YES_NO}
              onChange={(v) => {
                const next = v === 'yes'
                setForm((f) => ({ ...f, disability_yn: next }))
                saveSensitive({ disability_yn: next })
              }}
            />
            <HelpPill label="민감정보" id={disabilityHelpId}>{AI_NO_PII_SENTENCE} 암호화해 저장돼요</HelpPill>

            {form.disability_yn && (
              <div className="mt-4 space-y-3">
                <div>
                  <FieldLabel label="장애 정도" id={disabilityGradeLabelId} />
                  {/* 여기도 미선택은 미선택으로 — 「심하지 않은 장애」가 미리 눌려 있을 이유가 없다 */}
                  <SegmentedToggle
                    label="장애 정도"
                    labelledBy={disabilityGradeLabelId}
                    value={form.disability_grade || null}
                    options={DISABILITY_GRADES}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, disability_grade: v }))
                      saveSensitive({ disability_grade: v })
                    }}
                  />
                </div>
                <Field
                  label="장애 유형"
                  value={form.disability_type}
                  onChange={(v) => setForm((f) => ({ ...f, disability_type: v }))}
                  onBlur={() => saveSensitive({ disability_type: form.disability_type || null })}
                  maxLength={40}
                  placeholder="예: 지체, 청각"
                />
                <Field
                  label="장애인 등록번호"
                  value={form.disability_number}
                  onChange={(v) => setForm((f) => ({ ...f, disability_number: v }))}
                  onBlur={() => saveSensitive({ disability_number: form.disability_number || null })}
                  maxLength={30}
                  spellCheck={false}
                />
              </div>
            )}

            {/* 철회 — 동의 카드가 약속한 「동의 철회 시 즉시 삭제」의 실행 경로 */}
            <button
              type="button"
              onClick={() => setRevokeOpen(true)}
              className="mt-4 min-h-[44px] sm:min-h-0 sm:py-1 rounded text-xs text-text-tertiary underline underline-offset-2 hover:text-text-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
            >
              동의 철회
            </button>
            {/*
              🔴 공용 `Modal` 만 쓴다. `Activity/modals/ConfirmModal` 은 전역 클래스
              (`.overlay`·`.modal`)를 쓰는데 그 CSS 가 지연 로드되는 활동 페이지 chunk
              (`activity-mock.css`)에만 있어, /myinfo 에서는 스타일 없이 인라인으로 쏟아진다.
            */}
            <Modal
              open={revokeOpen}
              onClose={() => setRevokeOpen(false)}
              title="민감정보 동의를 철회할까요?"
            >
              <p className="text-sm text-text-secondary leading-relaxed mb-5">
                저장된 장애 정보가 즉시 삭제돼요. 다시 입력하려면 동의가 다시 필요해요.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRevokeOpen(false)}
                  className="flex-1 min-h-[44px] sm:min-h-0 sm:py-2.5 text-[13px] font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={revokeConsent}
                  disabled={isPending}
                  className="flex-1 min-h-[44px] sm:min-h-0 sm:py-2.5 text-[13px] font-medium text-text-primary bg-danger hover:bg-danger/80 rounded-lg transition-colors disabled:opacity-60"
                >
                  철회하고 삭제
                </button>
              </div>
            </Modal>
          </div>
        )}
      </div>

      {/* ── 추가 정보 (필드 사전) ───────────────────────── */}
      <ExtraFieldsBlock onSaved={onSaved} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
/**
 * 민감정보 별도 동의 카드 — 항목·목적·보유기간·거부권·거부 시 불이익 **5요소**.
 * 문안은 컨셉 §17 표를 따른다 (변경은 CEO 승인).
 */
function SensitiveConsentCard({ onAgree, onDecline }: { onAgree: () => void; onDecline: () => void }) {
  return (
    <div className="rounded-xl border border-warning/25 bg-warning/8 px-4 py-4">
      <p className="text-[13px] font-semibold text-text-primary mb-1">민감정보 별도 동의</p>
      <p className="text-sm text-text-secondary leading-relaxed">
        장애 관련 정보는 건강정보로 <strong className="text-text-primary">민감정보</strong>에 해당해
        별도로 동의를 받습니다.
      </p>

      {/* 동의 고지는 「읽으라고 만든 문장」 — DESIGN.md 7-b 최소 14px */}
      <dl className="mt-3 space-y-1.5 text-sm">
        <ConsentRow term="수집 항목">장애 여부 · 장애 정도 · 장애 유형 · 장애인 등록번호</ConsentRow>
        <ConsentRow term="이용 목적">
          지원서 자동 입력 — 이용자가 선택한 채용 폼의 해당 칸을 채우는 목적 외에는 쓰지 않습니다
        </ConsentRow>
        <ConsentRow term="보유 기간">회원 탈퇴 또는 동의 철회 시 즉시 삭제</ConsentRow>
        <ConsentRow term="거부할 권리">
          동의하지 않을 수 있으며, 동의하지 않아도 치뽀의 다른 기능은 그대로 이용할 수 있습니다
        </ConsentRow>
        <ConsentRow term="거부 시 불이익">
          지원서의 장애 관련 칸이 자동으로 채워지지 않아 직접 입력해야 합니다
        </ConsentRow>
      </dl>

      <p className="mt-3 text-sm font-medium text-text-primary">
        암호화해 저장합니다. {AI_NO_PII_SENTENCE}
      </p>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onAgree}
          className="min-h-[44px] px-4 rounded-xl bg-brand text-bg text-[13px] font-bold hover:bg-accent active:bg-accent-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          동의
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="min-h-[44px] px-4 rounded-xl border border-line bg-card text-[13px] font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:bg-card-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          동의하지 않음 — 지원서에서 직접 입력
        </button>
      </div>
    </div>
  )
}

function ConsentRow({ term, children }: { term: string; children: React.ReactNode }) {
  // 320px 에선 두 칸이 겹쳐 읽기 어렵다 — 모바일은 위아래로 쌓고 sm 이상에서 두 칸으로
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2">
      <dt className="sm:shrink-0 sm:w-[5.5rem] text-text-quaternary">{term}</dt>
      <dd className="min-w-0 sm:flex-1 text-text-secondary leading-relaxed">{children}</dd>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
/**
 * 「추가 정보」 — 서버 필드 사전(`storage: 'extra'`)을 읽어 타입별로 그린다.
 * 새 항목은 사전 한 줄이면 되고 프론트 배포가 필요 없다 (컨셉 §14).
 *
 * 🔴 `sensitive`·`forbidden` 은 슬롯에 저장하지 않는다 — 렌더 자체를 하지 않는다.
 */
export function ExtraFieldsBlock({ onSaved }: { onSaved: () => void }) {
  const { data: profile } = useProfile()
  const { data: dictionary, isError } = useFieldDictionary()
  const { mutate: updateExtra } = useUpdateExtraFields()
  const labelIdBase = useId()

  const [values, setValues] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  if (profile && !loaded) {
    setValues({ ...(profile.extra_fields ?? {}) })
    setLoaded(true)
  }

  const entries: FieldDictionaryEntry[] = (dictionary?.fields ?? []).filter(
    (f) => f.storage === 'extra' && !f.sensitive && !f.forbidden,
  )

  // 사전이 없거나(백엔드 미배포·장애) 슬롯 항목이 0개면 블록을 통째로 숨긴다
  if (isError || entries.length === 0) return null

  const commit = (key: string, raw: string) =>
    updateExtra({ [key]: raw.trim() ? raw.trim() : null }, {
      onSuccess: onSaved,
      onError: notifySaveError,
    })

  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }))

  return (
    <div className="pt-6 border-t border-line">
      <p className="text-[13px] font-bold text-text-primary mb-1">추가 정보</p>
      <p className="text-sm text-text-tertiary mb-3.5">
        지원서에서 자주 묻는 칸이에요. 채워두면 다음 지원서에서 그대로 쓰여요.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {entries.map((f) => {
          const v = values[f.key] ?? ''
          if (f.type === 'bool') {
            const labelId = `${labelIdBase}-${f.key}`
            return (
              <div key={f.key}>
                <FieldLabel label={f.label} id={labelId} />
                {/* 저장된 값이 없으면 「아니오」가 아니라 **미선택**이다 — 안 고른 걸 답으로 세지 않는다 */}
                <SegmentedToggle
                  label={f.label}
                  labelledBy={labelId}
                  value={v === 'true' ? 'true' : v === 'false' ? 'false' : null}
                  options={BOOL_OPTIONS}
                  onChange={(next) => { set(f.key, next); commit(f.key, next) }}
                />
              </div>
            )
          }
          if (f.type === 'select') {
            return (
              <SelectField
                key={f.key}
                label={f.label}
                value={v}
                options={f.options ?? []}
                onChange={(next) => { set(f.key, next); commit(f.key, next) }}
              />
            )
          }
          if (f.type === 'date') {
            return (
              <Field
                key={f.key}
                label={f.label}
                type="date"
                value={v}
                onChange={(next) => { set(f.key, next); commit(f.key, next) }}
              />
            )
          }
          return (
            <Field
              key={f.key}
              label={f.label}
              value={v}
              maxLength={f.maxLength}
              onChange={(next) => set(f.key, next)}
              onBlur={() => commit(f.key, v)}
            />
          )
        })}
      </div>
    </div>
  )
}
