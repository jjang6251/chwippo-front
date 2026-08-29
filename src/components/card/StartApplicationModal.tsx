import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/common/Modal'
import { JobTitleField } from '@/components/card/JobTitleField'
import { PromoteJobTitleRow } from '@/components/card/PromoteJobTitleRow'
import { useUpdateApplication } from '@/hooks/useApplications'
import { useAuthStore } from '@/stores/authStore'
import { showFirstCardCelebration } from '@/stores/celebrationStore'
import { JOB_SERIES, classifyJob } from '@/utils/jobRole'
import { shouldCelebrateFirstCard } from '@/utils/firstCardCelebration'
import { toast } from '@/stores/toastStore'
import type { Application, JobTitleSource } from '@/types/application'

interface StartApplicationModalProps {
  open: boolean
  onClose: () => void
  applicationId: string
  companyName: string
  /** 이미 적어둔 직무 — 비우면 안 되므로 prefill 한다 */
  currentJobTitle?: string | null
}

/** 밑줄 칸 위 캡션 라벨 — `AddCardModal` 과 같은 규격 */
const CAPTION_LABEL =
  'block text-[11px] font-semibold text-text-quaternary tracking-wide mb-0.5'

export function StartApplicationModal({
  open, onClose, applicationId, companyName, currentJobTitle,
}: StartApplicationModalProps) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  /*
    🔴 **카드에 적힌 직무가 언제나 이긴다.** 온보딩 프리필은 그 칸이 **비어 있을 때만**
    들어간다 — 사용자가 이미 적어둔 값을 시스템이 가진 다른 값으로 덮으면 그건 프리필이
    아니라 덮어쓰기다. (온보딩 2단으로 담긴 카드는 직무가 이미 채워져 있으므로 이 경로에서
    프리필이 도는 건 손으로 만든 빈 지원 예정 카드다.)
  */
  const existingTitle = currentJobTitle?.trim() ?? ''
  const prefillTitle = existingTitle ? '' : (user?.signupJobTitle?.trim() ?? '')
  const initialTitle = existingTitle || prefillTitle
  const prefillVerdict = initialTitle ? classifyJob(initialTitle) : null

  const [deadline, setDeadline] = useState('')
  const [jobTitle, setJobTitle] = useState(initialTitle)
  const [jobTitleSource, setJobTitleSource] = useState<JobTitleSource>(
    prefillTitle ? 'prefill' : 'typed',
  )
  const [seriesId, setSeriesId] = useState<string | null>(
    prefillVerdict?.status === 'confident' ? prefillVerdict.series.id : null,
  )
  const { mutate: update, isPending } = useUpdateApplication(applicationId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = jobTitle.trim()
    // 🔴 계열이 안 잡히면 **안 보낸다** — undefined 는 PATCH 에서 빠지므로 기존 값이 보존된다
    const seriesLabel = seriesId
      ? JOB_SERIES.find((s) => s.id === seriesId)?.label
      : undefined

    update(
      {
        status: 'IN_PROGRESS',
        deadline: deadline || undefined,
        jobCategory: seriesLabel,
        jobTitle: trimmedTitle || undefined,
        jobTitleSource: trimmedTitle ? jobTitleSource : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${companyName} 지원을 시작했어요!`)
          /*
            A5 — 첫 지원 카드 축하. 🔴 `AddCardModal` 과 **같은 판정 함수**를 쓴다.

            온보딩이 담아 준 픽 카드는 `PLANNED` 라 「이미 카드가 있던 사람」으로 세지 않으므로
            (`utils/firstCardCelebration`), 그 픽을 **여기서 지원 중으로 승격하는 순간**이
            그 사람의 첫 「지원 중」 카드다 — 축하가 나가야 하는 바로 그 지점인데, 진입점이
            카드 추가 모달 하나뿐이라 온보딩으로 시작한 사람은 축하를 영영 못 봤다.

            🔴 `createdId` 에 이 카드 id 를 넘긴다. 안 넘기면 승격이 반영된 캐시에서
            **자기 자신**이 「이미 있던 지원 중 카드」로 세어져 축하가 스스로를 막는다.
          */
          if (
            shouldCelebrateFirstCard({
              userId: user?.id,
              existingApplications: qc.getQueryData<Application[]>(['applications']),
              createdId: applicationId,
            })
          ) {
            showFirstCardCelebration({
              appId: applicationId,
              companyName,
              // 지원 시작 = 전형 단계가 생기는 순간이다 (모달 안내 문구와 같은 약속)
              hadTemplate: true,
              deadline: deadline || null,
              planned: false,
            })
          }
          setDeadline('')
          onClose()
        },
        onError: () => toast.error('업데이트에 실패했습니다.'),
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="지원 시작">
      <p className="text-text-tertiary text-xs mb-4">
        <span className="text-text-primary font-medium">{companyName}</span> 지원을 시작합니다.
        기본 4단계 스텝이 자동으로 생성됩니다.
      </p>
      {/*
        카드 추가 모달과 **같은 결** (2026-08-28 A안) — 저장되는 주인공 칸(직무)은 밑줄,
        부가 항목(마감일)은 조용한 면. 「라벨 + 채움 박스」를 나란히 쌓지 않는다.
      */}
      <form onSubmit={handleSubmit}>
        {/*
          지원 직무 (2026-08-06 추가) — 이 모달이 **지원 예정 → 지원 시작** 전환 지점이라
          사용자가 직무를 가장 확실히 아는 순간이다. 원래 직군 태그만 받아서, 이 경로로
          시작한 카드는 직무가 영영 비어 있었다. AI 결과 기준이 되는 값이다.

          🔴 21개 직군 칩(`TagSelector`)을 걷어내고 직무 입력 한 칸으로 합쳤다 — 계열은
          적은 직무에서 파생한다 (`JobTitleField`). 칩 목록은 원리적으로 전 직군을 못 덮었다.
        */}
        {/*
          🔴 순서: 직무 → 마감일 (2026-08-28). A안 문법에서 밑줄 필드가 주인공이라 위로 오고,
          마감일 `type="date"` 에 autoFocus 를 주면 모바일에서 모달이 열리자마자 날짜 피커가
          튀어나온다 — 첫 질문은 사람이 답할 수 있는 칸이어야 한다.
        */}
        <div>
          <JobTitleField
            variant="underline"
            autoFocus
            value={jobTitle}
            onChange={(v, source) => {
              setJobTitle(v)
              setJobTitleSource(source)
            }}
            seriesId={seriesId}
            onSeriesChange={(id) => setSeriesId(id)}
          />
          {/* 이 카드 직무가 내 희망 직무와 다르면 맞추자고 제안한다 (탭해야만 반영) */}
          <PromoteJobTitleRow
            profileTitle={user?.signupJobTitle ?? null}
            jobTitle={jobTitle}
            seriesId={seriesId}
          />
        </div>
        <div className="mt-6">
          <label htmlFor="start-app-deadline" className={CAPTION_LABEL}>
            서류 마감일 (선택)
          </label>
          <input
            id="start-app-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-card border border-line rounded-lg px-3 py-2.5 text-base lg:text-sm text-text-primary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>
        <div className="flex gap-2 pt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">
            취소
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 text-xs font-medium text-bg bg-brand hover:bg-accent active:bg-accent-hover rounded-lg transition-colors disabled:opacity-40">
            {isPending ? '처리 중...' : '지원 시작'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
