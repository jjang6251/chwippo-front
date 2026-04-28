import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Application } from '@/types/application'
import { StepBar } from './StepBar'
import { DdayBadge } from './DdayBadge'
import { useUpdateCurrentStep, useDeleteApplication } from '@/hooks/useApplications'
import { toast } from '@/stores/toastStore'
import { calcDday } from '@/utils/dday'
import { parseTags, JOB_CATEGORY_COLOR, JOB_CATEGORY_EMOJI, getAvatarColor } from '@/utils/tags'

interface CompanyCardProps {
  application: Application
  onStartApplication?: (id: string) => void
  onSetResult?: (id: string) => void
}

const STATUS_ACCENT: Record<string, string> = {
  PLANNED:     'border-l-white/20',
  IN_PROGRESS: 'border-l-brand/60',
  PASSED:      'border-l-success/70',
  FAILED:      'border-l-white/10',
}

function formatRegisteredDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 등록`
}

export function CompanyCard({ application, onStartApplication, onSetResult }: CompanyCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { mutate: updateStep } = useUpdateCurrentStep()
  const { mutate: deleteApp, isPending: isDeleting } = useDeleteApplication()

  const isPassed = application.status === 'PASSED'
  const isFailed = application.status === 'FAILED'
  const isPlanned = application.status === 'PLANNED'
  const needsResult =
    application.status === 'IN_PROGRESS' &&
    application.deadline &&
    calcDday(application.deadline) < 0

  const tags = parseTags(application.jobCategory)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleStepClick = (index: number) => {
    const steps = [...application.steps].sort((a, b) => a.orderIndex - b.orderIndex)
    const isLastStep = index === steps.length - 1
    if (isLastStep) {
      if (confirm(`"${steps[index].name}"을(를) 완료하면 최종 합격으로 처리됩니다. 진행할까요?`)) {
        updateStep({ id: application.id, stepIndex: index })
      }
    } else {
      updateStep({ id: application.id, stepIndex: index })
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    navigate(`/board/${application.id}`)
  }

  const handleDelete = () => {
    deleteApp(application.id, {
      onSuccess: () => toast.show('카드가 삭제되었습니다.'),
      onError: () => toast.error('삭제에 실패했습니다.'),
    })
  }

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative group border-l-2 rounded-xl p-4 cursor-pointer
        transition-all duration-200
        ${STATUS_ACCENT[application.status]}
        ${isFailed ? 'opacity-45 bg-surface-2 border border-white/5 hover:opacity-60' : ''}
        ${isPassed
          ? 'bg-gradient-to-br from-success/8 to-surface-2 border border-success/20 hover:border-success/35 hover:shadow-lg hover:shadow-success/5'
          : !isFailed
          ? 'bg-surface-2 border border-white/7 hover:border-white/14 hover:bg-[#1d1e20] hover:shadow-lg hover:shadow-black/30'
          : ''
        }
      `}
    >
      {/* 상단: 아바타 + 회사명 + 메뉴 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`
            flex-none w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold tracking-tight
            ${isPassed ? 'bg-success/15 text-success' : isFailed ? 'bg-white/5 text-text-quaternary' : getAvatarColor(application.companyName)}
          `}>
            {application.companyName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-text-primary text-sm font-semibold truncate">{application.companyName}</h3>
              {isPassed && (
                <span className="text-[10px] text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-full border border-success/20 flex-none">
                  🎉 합격
                </span>
              )}
            </div>
            {application.jobTitle ? (
              <p className="text-text-tertiary text-xs truncate mt-0.5">{application.jobTitle}</p>
            ) : isPlanned ? (
              <p className="text-text-quaternary text-xs mt-0.5">{formatRegisteredDate(application.createdAt)}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-none">
          {/* D-day 배지 */}
          {application.deadline && !isPassed && !isFailed && (
            <DdayBadge deadline={application.deadline} />
          )}

          {/* ... 메뉴 */}
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-white/6 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 bg-surface border border-white/10 rounded-xl shadow-2xl py-1.5 w-36 animate-fadeInUp">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/board/${application.id}`); setMenuOpen(false) }}
                  className="w-full text-left px-3.5 py-2 text-xs text-text-secondary hover:bg-white/5 transition-colors"
                >상세 보기</button>
                <div className="mx-3 my-1 border-t border-white/6" />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setMenuOpen(false) }}
                  className="w-full text-left px-3.5 py-2 text-xs text-danger hover:bg-danger/8 transition-colors"
                >카드 삭제</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 태그들 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag) => {
            const colorClass = JOB_CATEGORY_COLOR[tag] ?? JOB_CATEGORY_COLOR['기타']
            return (
              <span key={tag} className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium rounded-full border ${colorClass}`}>
                {JOB_CATEGORY_EMOJI[tag]} {tag}
              </span>
            )
          })}
        </div>
      )}

      {/* 스텝바 */}
      {!isPlanned && application.steps.length > 0 && (
        <div className="mb-2">
          <StepBar
            steps={application.steps}
            currentStepIndex={application.currentStepIndex}
            onStepClick={!isPassed && !isFailed ? handleStepClick : undefined}
            size="sm"
          />
          {/* 현재 단계 텍스트 */}
          {(() => {
            const sorted = [...application.steps].sort((a, b) => a.orderIndex - b.orderIndex)
            const currentStepName = sorted[application.currentStepIndex]?.name
            if (!currentStepName || isPassed) return null
            return (
              <p className="text-text-tertiary text-xs mt-1.5 truncate">
                📍 현재: {currentStepName}
              </p>
            )
          })()}
        </div>
      )}

      {/* 지원 예정 — 지원 시작 버튼 */}
      {isPlanned && (
        <button
          onClick={(e) => { e.stopPropagation(); onStartApplication?.(application.id) }}
          className="mt-2 w-full py-2.5 text-xs font-semibold text-brand border border-brand/30 rounded-lg hover:bg-brand/10 hover:border-brand/50 transition-all flex items-center justify-center gap-1.5"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          지원 시작하기
        </button>
      )}

      {/* 하단 배지 */}
      {(application.needsDetail || needsResult) && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {application.needsDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/board/${application.id}`) }}
              className="text-[10px] text-warning bg-warning/8 border border-warning/25 px-2 py-0.5 rounded-full hover:bg-warning/14 transition-colors font-medium"
            >
              📝 상세 입력 필요
            </button>
          )}
          {needsResult && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetResult?.(application.id) }}
              className="text-[10px] text-danger bg-danger/8 border border-danger/25 px-2 py-0.5 rounded-full hover:bg-danger/14 transition-colors font-medium"
            >
              ⚠️ 결과 입력 필요
            </button>
          )}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false) }}
        >
          <div
            className="bg-surface border border-white/10 rounded-2xl p-6 w-80 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-text-primary font-semibold text-sm mb-1">카드를 삭제할까요?</h3>
            <p className="text-text-tertiary text-xs mb-5">
              <span className="text-text-secondary font-medium">{application.companyName}</span> 카드와 모든 정보가 삭제됩니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-white/5 hover:bg-white/8 rounded-lg transition-colors">취소</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2.5 text-xs font-medium text-white bg-danger/80 hover:bg-danger rounded-lg transition-colors disabled:opacity-50">
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
