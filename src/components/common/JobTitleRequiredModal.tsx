import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { Modal } from './Modal'
import { useJobTitleGateStore } from '@/stores/jobTitleGateStore'
import { useApplication, useUpdateApplication } from '@/hooks/useApplications'
import { toast } from '@/stores/toastStore'

/** 카드 `jobTitle` 컬럼과 DTO `@MaxLength(100)` 에 맞춘다 */
const MAX_LEN = 100

/**
 * AI 호출 직전 지원 직무가 비어 있을 때 띄우는 모달.
 *
 * `useRequireJobTitle()` → `jobTitleGateStore.request(applicationId)` → 이 모달.
 * [저장하고 계속] → PATCH /applications/:id { jobTitle } → resolve(true)
 * [취소] / 배경 클릭 → resolve(false) (caller 가 silent skip)
 *
 * 🔴 **입력값은 카드에 저장된다.** 여기서만 쓰고 버리면 다음 AI 호출 때 또 물어야 하고,
 * 카드의 빈 칸도 영영 안 채워진다. 자소서·면접 어디서 입력하든 카드가 채워지는 게 목적이다.
 *
 * App layer 에 1개만 마운트 (`AiConsentRequiredModal` 과 동일).
 */
export function JobTitleRequiredModal() {
  const applicationId = useJobTitleGateStore((s) => s.applicationId)
  const cancel = useJobTitleGateStore((s) => s.cancel)

  return (
    <Modal
      open={applicationId !== null}
      onClose={cancel}
      title="지원 직무를 알려주세요"
      width="max-w-md"
    >
      {/*
        🔴 `key` 로 카드가 바뀌면 폼이 **통째로 새로 마운트**된다.
        effect 로 입력값을 리셋하면 렌더 중 setState 가 되어 lint 가 막는다
        (cascading render). 다른 카드의 입력이 남는 것도 이 방식이 원천 차단한다.
      */}
      {applicationId && <JobTitleForm key={applicationId} applicationId={applicationId} />}
    </Modal>
  )
}

function JobTitleForm({ applicationId }: { applicationId: string }) {
  const done = useJobTitleGateStore((s) => s.done)
  const cancel = useJobTitleGateStore((s) => s.cancel)

  const { data: app } = useApplication(applicationId)
  const { mutateAsync: updateApp } = useUpdateApplication(applicationId)

  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const trimmed = value.trim()

  const handleSave = async () => {
    if (submitting || !trimmed) return
    setSubmitting(true)
    try {
      await updateApp({ jobTitle: trimmed })
      done()
    } catch {
      toast.error('직무 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 text-sm leading-relaxed">
        <p className="text-text-secondary">
          {app?.companyName ? (
            <>
              <b className="text-text-primary">{app.companyName}</b> 에 어떤 직무로
              지원하시나요?
            </>
          ) : (
            '어떤 직무로 지원하시나요?'
          )}{' '}
          직무를 알아야 <b className="text-text-primary">그 직무에 맞는</b> 자소서·면접
          질문을 만들 수 있어요.
        </p>

        <div>
          <label
            htmlFor="job-title-gate-input"
            className="block text-xs text-text-tertiary mb-1.5"
          >
            지원 직무 <span className="text-danger">*</span>
          </label>
          <input
            id="job-title-gate-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed) void handleSave()
            }}
            maxLength={MAX_LEN}
            placeholder="예: 백엔드 개발자 / 퍼포먼스 마케터 / 재무회계"
            /* 지원 회사마다 다른 값 — 본인 직함 자동완성이 끼면 틀린 값이 들어간다 */
            autoComplete="off"
            autoFocus
            /* iOS 포커스 줌 방지 — 모바일 노출 입력은 16px 이상 (text-base) */
            className="w-full bg-input border border-line rounded-lg px-3 py-2.5 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
          <p className="text-text-faint text-[11px] mt-1.5 flex items-center gap-1">
            <Briefcase size={12} strokeWidth={1.75} aria-hidden="true" />
            공고에 적힌 직무명 그대로가 가장 좋아요. 카드에도 함께 저장됩니다.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-text-tertiary bg-card hover:bg-card-strong border border-line rounded-md transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting || !trimmed}
            aria-live="polite"
            className="flex-[1.5] px-4 py-2.5 text-xs font-semibold text-bg bg-brand hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '저장 중…' : '저장하고 계속'}
          </button>
      </div>
    </div>
  )
}
