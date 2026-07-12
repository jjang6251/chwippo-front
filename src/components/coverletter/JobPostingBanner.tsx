import { useState } from 'react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { toast } from '@/stores/toastStore'
import { formatMonthDay } from '@/utils/datetime'
import { useDeleteJobPosting } from '@/hooks/useJobPosting'
import {
  JobPostingModal,
  type JobPostingModalMode,
} from '@/components/coverletter/JobPostingModal'
import type { JobPosting } from '@/api/jobPosting'

/**
 * 📋 공고 요건 배너 — 자소서 페이지, 회사 조사 배너 아래.
 * F안 (SectionTitle brand 틱 + 타이포 위계) 문법 재사용, 회사 조사 배너와 톤 일치.
 *
 * - 데이터 있음: 접힘 배너 + 섹션별 표시 + "M/D 정리됨" 신선도 + 수정·다시 정리·삭제 액션
 * - 빈 상태: 값 어필 + CTA → 입력 모달
 * - 정리 중(parsing): CTA·기존 데이터 대신 진행 상태 + 스켈레톤. 상세 polling 이 완료 시 자동 전환.
 * - 모바일·RN(readOnly): 액션 미노출 (자소서 정책 일치). 빈 상태도 미노출.
 */

interface Props {
  applicationId: string
  jobPosting: JobPosting | null | undefined
  /** 'parsing' = 정리 중 (새로고침 재진입 표시). 서버가 2분 stale 시 null 로 회수 */
  jobPostingStatus?: 'parsing' | null
  readOnly: boolean
  expanded: boolean
  onToggle: () => void
}

export function JobPostingBanner({
  applicationId,
  jobPosting,
  jobPostingStatus,
  readOnly,
  expanded,
  onToggle,
}: Props) {
  const [modalMode, setModalMode] = useState<JobPostingModalMode | null>(null)
  const [confirm, setConfirm] = useState<'delete' | 'reparse' | null>(null)
  const { mutate: remove, isPending: removing } =
    useDeleteJobPosting(applicationId)

  const hasData =
    !!jobPosting &&
    (!!jobPosting.responsibilities?.trim() ||
      jobPosting.requirements.length > 0 ||
      jobPosting.preferred.length > 0 ||
      jobPosting.techStack.length > 0 ||
      jobPosting.qualifications.length > 0 ||
      jobPosting.keywords.length > 0)

  const modal = modalMode && (
    <JobPostingModal
      open
      onClose={() => setModalMode(null)}
      applicationId={applicationId}
      mode={modalMode}
      initial={jobPosting ?? null}
    />
  )

  // ── 정리 중 (parsing) ── CTA·기존 데이터보다 우선. 상세 polling 이 완료 감지 시 자동 전환.
  if (jobPostingStatus === 'parsing') {
    return (
      <div
        className="bg-card border border-line rounded-lg p-3.5 mb-4"
        aria-live="polite"
        aria-label="공고 요건 정리 중"
      >
        <p className="text-text-secondary text-xs font-medium mb-1">
          ⏳ AI가 공고 요건을 정리하고 있어요
        </p>
        <p className="text-text-quaternary text-[11px] leading-relaxed mb-2.5">
          곧 자동으로 표시돼요
        </p>
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2.5 bg-surface-3 rounded animate-pulse"
              style={{ width: `${88 - i * 16}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── 빈 상태 ──
  if (!hasData) {
    if (readOnly) return null
    return (
      <>
        <div className="bg-card border border-line rounded-lg p-3.5 mb-4">
          <p className="text-text-secondary text-xs font-medium mb-1">
            📋 참고할 만한 공고 내용을 입력해주세요
          </p>
          <p className="text-text-quaternary text-[11px] leading-relaxed mb-2.5">
            요건을 정리해두면 AI가 이 내용에 맞춰 자소서를 쓰고 점검해드려요
          </p>
          <button
            onClick={() => setModalMode('create')}
            className="text-[11px] text-brand bg-brand/8 border border-brand/25 hover:bg-brand/15 px-2.5 py-1 rounded-full transition-colors"
          >
            + 공고 요건 정리하기
          </button>
        </div>
        {modal}
      </>
    )
  }

  const data = jobPosting as JobPosting

  return (
    <>
      <div className="bg-card border border-line rounded-lg mb-4 overflow-hidden">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label="공고 요건 펼치기/접기"
          className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-card-strong transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-secondary text-xs font-medium shrink-0">
              📋 공고 요건
            </span>
            <span className="text-text-quaternary text-[10px] shrink-0 hidden sm:inline">
              · 회원님의 지원 준비에만 활용돼요
            </span>
            {!expanded && (
              <span className="text-text-quaternary text-[11px] truncate">
                {data.parsedAt ? `${formatMonthDay(data.parsedAt)} 정리됨` : ''}
              </span>
            )}
          </div>
          <CollapsibleChevron open={expanded} />
        </button>
        {expanded && (
          <div className="px-3 pb-2 text-xs">
            {data.responsibilities?.trim() && (
              <TextItem title="담당업무" content={data.responsibilities} />
            )}
            {data.requirements.length > 0 && (
              <ListItem title="자격요건 (필수)" items={data.requirements} />
            )}
            {data.preferred.length > 0 && (
              <ListItem title="우대사항 ⭐" items={data.preferred} />
            )}
            {data.techStack.length > 0 && (
              <ChipItem title="기술 스택" chips={data.techStack} />
            )}
            {data.qualifications.length > 0 && (
              <ChipItem title="자격증·어학" chips={data.qualifications} />
            )}
            {data.keywords.length > 0 && (
              <ChipItem title="키워드" chips={data.keywords} />
            )}

            <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-line">
              <p className="text-text-quaternary text-[10px]">
                {data.parsedAt ? `${formatMonthDay(data.parsedAt)} 정리됨` : ''}
              </p>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <ActionBtn onClick={() => setModalMode('edit')}>수정</ActionBtn>
                  <ActionBtn onClick={() => setConfirm('reparse')}>
                    다시 정리
                  </ActionBtn>
                  <ActionBtn onClick={() => setConfirm('delete')} danger>
                    삭제
                  </ActionBtn>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modal}

      {confirm === 'reparse' && (
        <ConfirmDialog
          label="공고 요건 다시 정리 확인"
          title="새 내용으로 교체할까요?"
          body="새로 입력한 공고로 정리하면 지금 요건은 교체돼요."
          confirmText="새로 정리"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            setModalMode('reparse')
          }}
        />
      )}

      {confirm === 'delete' && (
        <ConfirmDialog
          label="공고 요건 삭제 확인"
          title="공고 요건을 삭제할까요?"
          body="정리된 요건이 삭제되고 AI 참고에서도 빠져요."
          confirmText={removing ? '삭제 중…' : '삭제'}
          danger
          disabled={removing}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            remove(undefined, {
              onSuccess: () => {
                toast.success('공고 요건을 삭제했어요')
                setConfirm(null)
              },
              onError: () => toast.error('삭제에 실패했어요.'),
            })
          }
        />
      )}
    </>
  )
}

// ── 표시 서브 컴포넌트 (F안 SectionTitle 문법) ────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span aria-hidden className="w-1 h-3 rounded-full bg-brand/60" />
      <span className="text-[11px] text-text-secondary font-semibold">
        {title}
      </span>
    </div>
  )
}

function TextItem({ title, content }: { title: string; content: string }) {
  return (
    <div className="py-2">
      <SectionTitle title={title} />
      <p className="text-text-secondary leading-relaxed whitespace-pre-wrap pl-2.5">
        {content}
      </p>
    </div>
  )
}

function ListItem({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="py-2">
      <SectionTitle title={title} />
      <ul className="pl-2.5 space-y-0.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="text-text-secondary leading-relaxed flex gap-1.5"
          >
            <span aria-hidden className="text-text-quaternary">
              ·
            </span>
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChipItem({ title, chips }: { title: string; chips: string[] }) {
  return (
    <div className="py-2">
      <SectionTitle title={title} />
      <div className="flex flex-wrap gap-1 pl-2.5">
        {chips.map((c, i) => (
          <span
            key={i}
            className="text-[11px] text-info bg-info/10 border border-info/20 px-1.5 py-0.5 rounded"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

function ActionBtn({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
        danger
          ? 'text-text-quaternary hover:text-danger'
          : 'text-text-tertiary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

function ConfirmDialog({
  label,
  title,
  body,
  confirmText,
  danger,
  disabled,
  onCancel,
  onConfirm,
}: {
  label: string
  title: string
  body: string
  confirmText: string
  danger?: boolean
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="bg-surface border border-line rounded-xl p-5 w-72 shadow-2xl animate-fadeInUp"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-text-primary font-semibold text-sm mb-1">{title}</h3>
        <p className="text-text-tertiary text-xs mb-4 leading-relaxed">{body}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className={`flex-1 py-2 text-xs font-medium text-text-primary rounded-lg transition-colors disabled:opacity-50 ${
              danger ? 'bg-danger/80 hover:bg-danger' : 'bg-brand hover:bg-accent'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
