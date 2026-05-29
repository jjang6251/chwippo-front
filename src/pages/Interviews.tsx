import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApplications } from '@/hooks/useApplications'
import {
  useDeleteInterviewSession,
  useInterviewPrepSessions,
} from '@/hooks/useInterviewPrep'
import { NewInterviewSessionModal } from '@/components/card/NewInterviewSessionModal'
import { toast } from '@/stores/toastStore'
import {
  INTERVIEW_TYPE_LABEL,
  INTERVIEW_TYPE_STYLE,
} from '@/types/interviewPrep'

/**
 * F6 PR 2 Phase 4 — 면접 준비 통합 페이지 (`/interviews`).
 *
 * 기업 그룹 헤더 + 세션 리스트. 세션 클릭 → `/interviews/:sessionId` 상세.
 * 활동일지 `.aj-content` 너비 표준 (max-w-1100, px-9 py-9 desktop).
 */
export function Interviews() {
  const { data: applications = [], isLoading } = useApplications()
  const [creatingForAppId, setCreatingForAppId] = useState<string | null>(null)

  const active = useMemo(
    () =>
      applications.filter((a) =>
        ['CREATED', 'IN_PROGRESS', 'PASSED'].includes(a.status),
      ),
    [applications],
  )

  if (isLoading) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9 space-y-3">
        <Header />
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-32 bg-surface-2 border border-line rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (active.length === 0) {
    return (
      <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
        <Header />
        <div className="bg-surface-2 border border-dashed border-line rounded-xl p-10 text-center mt-5">
          <div className="text-3xl mb-3">🎤</div>
          <p className="text-text-secondary text-base font-medium mb-2">
            아직 지원 카드가 없어요
          </p>
          <p className="text-text-tertiary text-sm leading-relaxed mb-6">
            보드에서 회사 카드를 먼저 만든 뒤 면접 세션을 만들 수 있어요.
          </p>
          <Link
            to="/board"
            className="inline-block px-5 py-2.5 text-sm font-medium text-white bg-brand hover:bg-accent rounded-lg transition-colors"
          >
            보드로 이동 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <Header />
      <div className="space-y-6 mt-6">
        {active.map((app) => (
          <ApplicationInterviewGroup
            key={app.id}
            applicationId={app.id}
            companyName={app.companyName}
            jobTitle={app.jobTitle}
            jobCategory={app.jobCategory}
            onCreate={() => setCreatingForAppId(app.id)}
          />
        ))}
      </div>

      {creatingForAppId && (
        <NewInterviewSessionModal
          applicationId={creatingForAppId}
          onClose={() => setCreatingForAppId(null)}
          onCreated={() => setCreatingForAppId(null)}
        />
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="space-y-2">
      <h1 className="text-text-primary text-[26px] font-bold leading-tight">
        면접 준비 <span className="text-brand italic">모아보기</span>
      </h1>
      <p className="text-text-tertiary text-sm leading-relaxed">
        지원한 회사들의 면접 세션을 한곳에서 확인. 세션 만들기·편집은 회사 그룹에서.
      </p>
    </header>
  )
}

function ApplicationInterviewGroup({
  applicationId,
  companyName,
  jobTitle,
  jobCategory,
  onCreate,
}: {
  applicationId: string
  companyName: string
  jobTitle: string | null
  jobCategory: string | null
  onCreate: () => void
}) {
  const { data: sessions = [], isLoading } = useInterviewPrepSessions(
    applicationId,
  )
  const { mutate: deleteSession } = useDeleteInterviewSession(applicationId)

  const handleDelete = (
    e: React.MouseEvent,
    sessionId: string,
    round: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const ok = window.confirm(
      `🗑️ "${round}" 세션을 정말 삭제하시겠어요?\n\n생성된 질문과 메모가 모두 삭제됩니다 (회사 조사 캐시는 보존).\n복구할 수 없습니다.`,
    )
    if (!ok) return
    deleteSession(sessionId, {
      onSuccess: () => toast.show('세션을 삭제했어요.'),
      onError: () => toast.error('삭제에 실패했어요.'),
    })
  }

  if (isLoading) {
    return (
      <div className="border border-line bg-surface-2 rounded-xl px-5 py-4">
        <div className="h-5 w-40 bg-surface-3 rounded animate-pulse mb-2" />
        <div className="h-4 w-56 bg-surface-3 rounded animate-pulse" />
      </div>
    )
  }

  // 기업 단위 강한 구분 — 회사 헤더 + 카드 그룹
  return (
    <section>
      {/* 기업 헤더 (그룹 라벨) */}
      <div className="flex items-end justify-between gap-3 mb-3 px-1">
        <div className="min-w-0">
          <h2 className="text-text-primary text-lg font-bold leading-tight truncate">
            {companyName}
          </h2>
          {(jobTitle || jobCategory) && (
            <p className="text-text-tertiary text-xs mt-0.5 truncate">
              {[jobCategory, jobTitle].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button
          onClick={onCreate}
          className="text-xs text-brand hover:text-brand-hover border border-brand/30 hover:border-brand/60 bg-brand/5 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap font-medium"
        >
          + 새 세션
        </button>
      </div>

      {/* 세션 카드 컨테이너 */}
      {sessions.length === 0 ? (
        <div className="border border-dashed border-line bg-surface-2/50 rounded-xl px-5 py-6 text-center">
          <p className="text-text-tertiary text-sm">
            아직 면접 세션이 없어요
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="relative group">
              <Link
                to={`/interviews/${s.id}`}
                className="block border border-line bg-surface-2 hover:bg-surface-3 hover:border-line-strong rounded-xl px-4 py-3.5 pr-12 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-text-primary text-sm font-semibold truncate">
                      {s.round}
                    </span>
                    {s.interviewType && (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${INTERVIEW_TYPE_STYLE[s.interviewType]}`}
                      >
                        {INTERVIEW_TYPE_LABEL[s.interviewType]}
                      </span>
                    )}
                  </div>
                  <span className="text-text-faint text-xs shrink-0">
                    {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                {(s.jobDescription || s.emphasisPoints) && (
                  <p className="text-text-tertiary text-xs mt-1.5 line-clamp-1">
                    {s.emphasisPoints && (
                      <>
                        <span className="text-brand font-medium">강조 ·</span>{' '}
                        {s.emphasisPoints}
                      </>
                    )}
                  </p>
                )}
              </Link>
              <button
                onClick={(e) => handleDelete(e, s.id, s.round)}
                className="absolute top-2 right-2 text-text-quaternary hover:text-danger px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="세션 삭제"
                aria-label={`${s.round} 세션 삭제`}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
