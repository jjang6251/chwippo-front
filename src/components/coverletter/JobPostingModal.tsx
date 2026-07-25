import { useEffect, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { toast } from '@/stores/toastStore'
import { useAutoResize } from '@/hooks/useAutoResize'
import { useAiQuotaBlocked, useMyAiQuota } from '@/hooks/useMyAiQuotas'
import { useRequireAiConsent } from '@/hooks/useRequireAiConsent'
import { useAiConsentStore } from '@/stores/aiConsentStore'
import { useParseJobPosting, useUpdateJobPosting } from '@/hooks/useJobPosting'
import { isNotPosting, isParseBlocked, type JobPosting } from '@/api/jobPosting'

/**
 * 공고 요건 입력·결과 확인/수정 모달 (feature-jobposting-parse).
 *
 * 2단계:
 *  - input  — 붙여넣기 textarea → "✨ AI로 정리하기" → parse (create·reparse 진입)
 *  - review — 파싱/기존 결과를 섹션별(텍스트·칩) 편집 → PATCH 저장 (edit 진입은 여기 바로)
 *
 * dirty 상태에서 ESC·외부 클릭 시 닫기 확인. 파싱 결과는 서버 저장 후 응답이라
 * review 단계 진입 시점에 이미 DB 반영 (resilient save) — 이탈해도 유실 없음.
 */

const RAW_MIN = 30
const RAW_MAX = 10000

type Step = 'input' | 'review'
export type JobPostingModalMode = 'create' | 'edit' | 'reparse'

interface Props {
  open: boolean
  onClose: () => void
  applicationId: string
  mode: JobPostingModalMode
  /** edit 모드 prefill · reparse/create 는 무시 */
  initial: JobPosting | null
}

const emptyDraft: JobPosting = {
  responsibilities: null,
  requirements: [],
  preferred: [],
  techStack: [],
  qualifications: [],
  keywords: [],
  parsedAt: '',
}

export function JobPostingModal({
  open,
  onClose,
  applicationId,
  mode,
  initial,
}: Props) {
  const { mutate: parse, isPending: parsing } = useParseJobPosting(applicationId)
  const { mutate: save, isPending: saving } = useUpdateJobPosting(applicationId)
  const ensureAiConsent = useRequireAiConsent()
  const requestAiConsent = useAiConsentStore((s) => s.request)

  // 배너가 modalMode 로 매 열림마다 새로 mount → useState 초기화가 곧 리셋 (별도 effect 불필요)
  const editEntry = mode === 'edit' && !!initial
  const [step, setStep] = useState<Step>(editEntry ? 'review' : 'input')
  const [rawText, setRawText] = useState('')
  const [draft, setDraft] = useState<JobPosting>(
    editEntry ? (initial as JobPosting) : emptyDraft,
  )
  const [reviewBaseline, setReviewBaseline] = useState<string>(
    editEntry ? serializeDraft(initial as JobPosting) : '',
  )
  const [notPosting, setNotPosting] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const { ref: taRef, autoResize } = useAutoResize(rawText, { min: 180, max: 420 })

  // 잔여 횟수 — 모달 열 때 1회 조회(공유 캐시). parse 응답 quota 로 즉시 override.
  const quotaRow = useMyAiQuota('jobposting_parse')
  const { blocked: soldOut } = useAiQuotaBlocked('jobposting_parse')
  const [quotaOverride, setQuotaOverride] = useState<{
    used: number
    limit: number
  } | null>(null)
  const limit = quotaOverride?.limit ?? quotaRow?.dayLimit ?? 5
  const used = quotaOverride?.used ?? quotaRow?.dayUsed ?? 0
  const remaining = Math.max(0, limit - used)
  const featureDisabled = quotaRow ? !quotaRow.enabled : false
  const dayExhausted = remaining <= 0

  const dirty =
    step === 'input'
      ? rawText.trim().length > 0
      : serializeDraft(draft) !== reviewBaseline

  const attemptClose = () => {
    if (parsing || saving) return
    if (dirty) setCloseConfirm(true)
    else onClose()
  }

  // 공통 Modal 의 ESC 닫기를 선점 — capture 단계(= Modal 의 document bubble 리스너보다 먼저)에서
  // preventDefault 하면 Modal 은 defaultPrevented 를 보고 양보한다. 그래야 dirty 확인 레이어를
  // 건너뛰고 바로 닫히는 일이 없다.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      if (closeConfirm) setCloseConfirm(false)
      else attemptClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closeConfirm, dirty, parsing, saving])

  // 파싱 중 이탈 경고 — 서버는 저장까지 완료하지만(유실 없음) 진행 중 이탈로
  // "차감됐는데 결과를 못 봤다" 혼란 방지 (AI 호출 유실 방지 정책 세트)
  useEffect(() => {
    if (!parsing) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [parsing])

  const handleParse = async () => {
    const text = rawText.trim()
    if (text.length < RAW_MIN || parsing || soldOut) return
    if (!(await ensureAiConsent())) return
    setNotPosting(false)
    parse(text, {
      onSuccess: (res) => {
        setQuotaOverride(res.quota)
        // 이미 정리 중 (다른 요청/새로고침 재진입) — 차감 없음. 모달 닫고 배너가 "정리 중" 이어받음.
        if (isParseBlocked(res) && res.code === 'ALREADY_PARSING') {
          toast.show('이미 정리가 진행 중이에요 — 곧 자동으로 표시돼요', 'info')
          onClose()
          return
        }
        // 200 + blocked 봉투 — 코드별 구분 (ERROR 를 소진으로 오표시하지 않기)
        if (isParseBlocked(res)) {
          if (res.code === 'CONSENT_REQUIRED') {
            void requestAiConsent()
            return
          }
          if (res.code === 'QUOTA_EXCEEDED') {
            toast.error(res.reason ?? '오늘 횟수를 다 썼어요 — 내일 다시, 직접 입력·수정은 계속 가능해요')
          } else {
            // ALREADY_PARSING 은 위 전용 분기가 선처리 — 여기 도달은 ERROR 류
            toast.error(res.reason ?? '정리에 실패했어요. 잠시 후 다시 시도해주세요.')
          }
          return
        }
        if (isNotPosting(res)) {
          setNotPosting(true)
          return
        }
        setDraft(res.jobPosting)
        setReviewBaseline(serializeDraft(res.jobPosting))
        setStep('review')
      },
      onError: (err) => {
        // 400(QUOTA_EXCEEDED 등)은 apiClient 인터셉터가 이미 토스트 — 중복 방지
        const shown = (err as { config?: { _toastShown?: boolean } })?.config
          ?._toastShown
        if (shown) return
        const serverMsg = (
          err as { response?: { data?: { message?: string } } }
        )?.response?.data?.message
        toast.error(serverMsg ?? '정리에 실패했어요. 잠시 후 다시 시도해주세요.')
      },
    })
  }

  const handleSave = () => {
    if (saving) return
    save(
      {
        responsibilities: draft.responsibilities?.trim()
          ? draft.responsibilities.trim()
          : null,
        requirements: cleanList(draft.requirements),
        preferred: cleanList(draft.preferred),
        techStack: cleanList(draft.techStack),
        qualifications: cleanList(draft.qualifications),
        keywords: cleanList(draft.keywords),
      },
      {
        onSuccess: () => {
          toast.success('공고 요건을 저장했어요')
          onClose()
        },
        onError: (err) => {
          const shown = (err as { config?: { _toastShown?: boolean } })?.config
            ?._toastShown
          if (!shown) toast.error('저장에 실패했어요. 잠시 후 다시 시도해주세요.')
        },
      },
    )
  }

  const setField = <K extends keyof JobPosting>(key: K, value: JobPosting[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const title =
    step === 'review' ? '공고 요건 확인·수정' : '공고 요건 정리하기'
  const tooShort = rawText.trim().length > 0 && rawText.trim().length < RAW_MIN

  return (
    <Modal open={open} onClose={attemptClose} title={title} width="max-w-lg">
      {step === 'input' ? (
        <div>
          <p className="text-text-tertiary text-xs leading-relaxed mb-2">
            채용 공고에서 담당업무·자격요건·우대사항 등을 붙여넣으면 AI가 항목별로
            정리해드려요.
          </p>
          <textarea
            ref={taRef}
            autoFocus
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value)
              autoResize()
              if (notPosting) setNotPosting(false)
            }}
            disabled={parsing || soldOut}
            maxLength={RAW_MAX}
            placeholder="예: 우대사항, 자격요건, 담당업무"
            className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-none overscroll-contain disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-1.5 mb-1">
            <p className="text-[11px] text-text-quaternary">
              입력한 내용은 정리된 요건 형태로만 저장돼요
            </p>
            <span className="text-[10px] font-mono text-text-quaternary">
              {rawText.trim().length}/{RAW_MAX}
            </span>
          </div>
          {tooShort && (
            <p className="text-[11px] text-warning mb-1">
              조금 더 입력해주세요 (최소 {RAW_MIN}자)
            </p>
          )}

          {notPosting && (
            <div className="bg-warning/8 border border-warning/20 rounded-lg p-3 my-2">
              <p className="text-[11px] text-warning leading-relaxed">
                공고 요건으로 보이는 내용을 찾지 못했어요 (오늘 횟수는 1회 사용됐어요). 담당업무·자격요건·우대사항이
                담긴 내용을 넣어주세요.
              </p>
            </div>
          )}

          {parsing && (
            <div className="my-3 space-y-2" aria-live="polite" aria-label="정리하는 중">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3 bg-surface-3 rounded animate-pulse"
                  style={{ width: `${90 - i * 15}%` }}
                />
              ))}
            </div>
          )}

          <button
            onClick={() => handleParse()}
            disabled={parsing || soldOut || rawText.trim().length < RAW_MIN}
            className="w-full mt-2 py-2.5 text-xs font-semibold text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-brand"
          >
            {parsing ? '정리하는 중…' : '✨ AI로 정리하기'}
          </button>

          {soldOut ? (
            <p
              role="status"
              className="mt-2 text-xs text-warning font-medium text-center leading-relaxed"
            >
              {featureDisabled
                ? '지금은 정리 기능을 잠시 쉬고 있어요 — 직접 입력·수정은 계속 가능해요'
                : dayExhausted
                  ? '오늘 횟수를 다 썼어요 — 내일 다시, 직접 입력·수정은 계속 가능해요'
                  : '잠시 후 다시 시도해주세요 — 직접 입력·수정은 계속 가능해요'}
            </p>
          ) : (
            <div className="text-center mt-2 space-y-0.5">
              <p className="text-[11px] text-text-quaternary">
                오늘 {remaining}/{limit}회 · 치뽀 코인은 들지 않아요
              </p>
              <p className="text-[11px] text-text-quaternary">
                정리된 내용은 회원님의 지원 준비에만 활용돼요
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-text-tertiary text-xs leading-relaxed mb-3">
            정리된 내용을 확인하고 필요하면 다듬어주세요. 저장하면 AI가 자소서 작성·점검
            시 참고해요.
          </p>
          <div className="max-h-[52vh] overflow-y-auto overscroll-contain pr-0.5 space-y-4">
            <TextSection
              title="담당업무"
              value={draft.responsibilities ?? ''}
              onChange={(v) => setField('responsibilities', v)}
            />
            <ListSection
              title="자격요건 (필수)"
              items={draft.requirements}
              onChange={(v) => setField('requirements', v)}
              placeholder="예: 관련 직무 경력 3년 이상"
            />
            <ListSection
              title="우대사항 ⭐"
              items={draft.preferred}
              onChange={(v) => setField('preferred', v)}
              placeholder="예: 대규모 트래픽 서비스 경험"
            />
            <ChipSection
              title="기술 스택"
              items={draft.techStack}
              onChange={(v) => setField('techStack', v)}
              placeholder="예: React"
            />
            <ChipSection
              title="자격증·어학"
              items={draft.qualifications}
              onChange={(v) => setField('qualifications', v)}
              placeholder="예: 정보처리기사"
            />
            <ChipSection
              title="키워드"
              items={draft.keywords}
              onChange={(v) => setField('keywords', v)}
              placeholder="예: 성장, 협업"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={attemptClose}
              className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-xs font-semibold text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors disabled:opacity-40"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )}

      {closeConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setCloseConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="변경사항 저장 안 함 확인"
            className="bg-surface border border-line rounded-xl p-5 w-72 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-text-primary font-semibold text-sm mb-1">
              작성 중인 내용을 닫을까요?
            </h3>
            <p className="text-text-tertiary text-xs mb-4">
              저장하지 않은 변경사항은 사라져요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCloseConfirm(false)}
                className="flex-1 py-2 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
              >
                계속 작성
              </button>
              <button
                onClick={() => {
                  setCloseConfirm(false)
                  onClose()
                }}
                className="flex-1 py-2 text-xs font-medium text-text-primary bg-danger/80 hover:bg-danger rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── 편집 서브 컴포넌트 ─────────────────────────────────────

function EditLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span aria-hidden className="w-1 h-3 rounded-full bg-brand/60" />
      <span className="text-[11px] text-text-secondary font-semibold">
        {title}
      </span>
    </div>
  )
}

function TextSection({
  title,
  value,
  onChange,
}: {
  title: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <EditLabel title={title} />
      <textarea
        ref={(el) => { if (el) autoGrow(el) }}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          autoGrow(e.currentTarget)
        }}
        rows={2}
        placeholder="담당업무를 자유롭게 적어주세요"
        className="w-full bg-input border border-line rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-none overflow-y-auto overscroll-contain"
      />
    </div>
  )
}


/** review 입력 auto-grow — 내용만큼 높이 (300px 상한, 초과 시 스크롤). 시인성 (2026-07-13 CEO) */
function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 300)}px`
}

function ListSection({
  title,
  items,
  onChange,
  placeholder,
}: {
  title: string
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const update = (idx: number, v: string) =>
    onChange(items.map((it, i) => (i === idx ? v : it)))
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))
  return (
    <div>
      <EditLabel title={title} />
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-start gap-1.5">
            <textarea
              ref={(el) => { if (el) autoGrow(el) }}
              value={it}
              onChange={(e) => {
                update(idx, e.target.value)
                autoGrow(e.currentTarget)
              }}
              rows={1}
              placeholder={placeholder}
              className="flex-1 bg-input border border-line rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all resize-none overflow-y-auto overscroll-contain"
            />
            <button
              onClick={() => remove(idx)}
              aria-label={`${title} ${idx + 1}번 삭제`}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-danger hover:bg-card transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ''])}
          className="text-[11px] text-brand hover:text-accent font-medium transition-colors"
        >
          + 항목 추가
        </button>
      </div>
    </div>
  )
}

function ChipSection({
  title,
  items,
  onChange,
  placeholder,
}: {
  title: string
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (!v || items.includes(v)) {
      setInput('')
      return
    }
    onChange([...items, v])
    setInput('')
  }
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))
  return (
    <div>
      <EditLabel title={title} />
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {items.map((it, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] text-info bg-info/10 border border-info/20 pl-2 pr-1 py-0.5 rounded"
            >
              {it}
              <button
                onClick={() => remove(idx)}
                aria-label={`${it} 삭제`}
                className="w-4 h-4 flex items-center justify-center text-info/70 hover:text-info"
              >
                <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 1l12 12M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="w-full bg-input border border-line rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
      />
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────

function cleanList(items: string[]): string[] {
  return items.map((s) => s.trim()).filter((s) => s.length > 0)
}

/** dirty 비교용 — parsedAt 제외한 편집 대상 필드만 직렬화 (trim 후) */
function serializeDraft(d: JobPosting): string {
  return JSON.stringify({
    responsibilities: d.responsibilities?.trim() ?? '',
    requirements: cleanList(d.requirements),
    preferred: cleanList(d.preferred),
    techStack: cleanList(d.techStack),
    qualifications: cleanList(d.qualifications),
    keywords: cleanList(d.keywords),
  })
}
