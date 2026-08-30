import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { Modal } from './Modal'
import { JobTitleField } from '@/components/card/JobTitleField'
import { PromoteJobTitleRow } from '@/components/card/PromoteJobTitleRow'
import { useJobTitleGateStore } from '@/stores/jobTitleGateStore'
import { useApplication, useUpdateApplication } from '@/hooks/useApplications'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { JOB_SERIES } from '@/utils/jobRole'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/stores/toastStore'
import type { JobTitleSource } from '@/types/application'

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
  const user = useAuthStore((s) => s.user)

  const [value, setValue] = useState('')
  const [source, setSource] = useState<JobTitleSource>('typed')
  const [seriesId, setSeriesId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isMobile = useIsMobile()

  const trimmed = value.trim()

  const handleSave = async () => {
    if (submitting || !trimmed) return
    setSubmitting(true)
    try {
      // 🔴 계열은 **확정됐을 때만** 라벨로 나간다 — 카드 추가 모달과 같은 규칙
      const seriesLabel = seriesId
        ? JOB_SERIES.find((s) => s.id === seriesId)?.label
        : undefined
      await updateApp({
        jobTitle: trimmed,
        // 관측 전용 — 「직접 침」과 「추천 수용」을 통계에서 가른다
        jobTitleSource: source,
        jobCategory: seriesLabel,
      })
      done()
    } catch {
      toast.error('직무 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      /*
        Enter 로도 저장된다 — 한 칸짜리 폼이라 버튼까지 가는 게 손해다.
        추천 목록에서 항목을 고르는 중(↑↓로 강조된 상태)이면 `JobTitleField` 가
        preventDefault 하므로 제출이 아니라 선택으로 간다.
      */
      onSubmit={(e) => {
        e.preventDefault()
        void handleSave()
      }}
      className="space-y-4 text-sm leading-relaxed"
    >
        {/*
          「직무를 알아야 그 직무에 맞는 자소서·면접 질문을 만들 수 있어요」는 뺐다 —
          바로 아래 `JobTitleField` 의 helper 가 같은 말을 한다. 한 화면에서 같은 이유를
          두 번 대면 설명이 아니라 소음이다. 이 자리는 **묻는 문장** 하나면 된다.
        */}
        <p className="text-text-secondary">
          {app?.companyName ? (
            <>
              <b className="text-text-primary">{app.companyName}</b> 에 어떤 직무로
              지원하시나요?
            </>
          ) : (
            '어떤 직무로 지원하시나요?'
          )}
        </p>

        <div>
          {/*
            🔴 직무가 들어오는 세 길(온보딩 · 카드 추가 · 이 게이트)이 **같은 입력기**를 쓴다.
            여기만 맨 input 이면 이 자리에서만 사전 추천도, 계열 판정도 없다 — 그런데
            게이트야말로 「필요한 순간에 묻는」 자리라 입력 품질이 제일 중요하다.
          */}
          <JobTitleField
            id="job-title-gate-input"
            labelText={
              <>
                지원 직무 <span className="text-danger">*</span>
              </>
            }
            // 모바일은 열자마자 키보드가 모달을 덮는다 — 먼저 보고, 탭해서 입력 (2026-08-30 iPhone 실사고).
            // 이 폼은 모달이 열릴 때만 마운트되므로 `open` 대신 마운트 자체가 그 조건이다.
            autoFocus={!isMobile}
            value={value}
            onChange={(v, src) => {
              setValue(v.slice(0, MAX_LEN))
              setSource(src)
            }}
            seriesId={seriesId}
            onSeriesChange={(id) => setSeriesId(id)}
          />
          {/* 이 카드 직무가 내 희망 직무와 다르면 맞추자고 제안한다 (탭해야만 반영) */}
          <PromoteJobTitleRow
            profileTitle={user?.signupJobTitle ?? null}
            jobTitle={value}
            seriesId={seriesId}
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
            type="submit"
            disabled={submitting || !trimmed}
            aria-live="polite"
            className="flex-[1.5] px-4 py-2.5 text-xs font-semibold text-bg bg-brand hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '저장 중…' : '저장하고 계속'}
          </button>
      </div>
    </form>
  )
}
