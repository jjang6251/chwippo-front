import { Link } from 'react-router-dom'
import { CoverletterGenerateSection } from '@/components/coverletter/CoverletterGenerateSection'
import { CoverletterOutdatedBanner } from '@/components/coverletter/CoverletterOutdatedBanner'
import {
  useCoverletters,
  useCreateCoverletter,
} from '@/hooks/useApplicationCoverletters'
import { useApplication } from '@/hooks/useApplications'
import { CoverLetterCard } from '@/components/card/CoverLetterCard'
import { toast } from '@/stores/toastStore'

/**
 * BoardDetail 의 자소서 탭 — 보기 전용 카드 리스트 + 풀페이지 진입 링크.
 *
 * 편집·삭제·AI 답변·가져오기·검사 = 모두 `/board/:appId/coverletter` 풀페이지.
 */

const COMMON_QUESTIONS = [
  { label: '지원 동기', question: '해당 직무에 지원하게 된 동기를 작성해 주세요.', category: '지원동기' },
  { label: '성장 과정·가치관', question: '본인의 성장 과정과 가치관을 작성해 주세요.', category: '성장과정·가치관' },
  { label: '입사 후 포부', question: '입사 후 이루고 싶은 목표와 포부를 작성해 주세요.', category: '입사후포부' },
  { label: '직무 역량·핵심 경험', question: '지원 직무와 관련된 본인의 핵심 역량과 경험을 작성해 주세요.', category: '직무역량·핵심경험' },
]

export function CoverLetterTab({ applicationId, active }: { applicationId: string; active: boolean }) {
  const { data: items, isLoading } = useCoverletters(applicationId, active)
  const { mutate: create, isPending: creating } = useCreateCoverletter(applicationId)
  // PR_B1c — application 의 generation status 별 UI 분기 (polling 자동)
  const { data: application } = useApplication(applicationId)

  const handleAdd = (question = '', category?: string) =>
    create({ question, category }, { onError: () => toast.error('추가에 실패했습니다.') })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => <div key={i} className="h-32 bg-surface-2 border border-line rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const list = items ?? []
  const fullscreenHref = `/board/${applicationId}/coverletter`

  // PR_B1c — 자소서 row 없을 때만 GenerateSection (status 별 4 UI). row 있으면 legacy UI 유지
  if (list.length === 0) {
    if (!application) return null
    return (
      <div className="space-y-3">
        <CoverletterGenerateSection application={application} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* PR_B1c Phase G — 회사 정보 outdated 안내 */}
      {application && <CoverletterOutdatedBanner application={application} />}
      {/* PR UI — list.length===0 dead branch 제거 (line 47 에서 early return) */}
      <>
          {/* 풀페이지 진입 강조 */}
          <div className="flex items-center justify-between gap-2 bg-brand/5 border border-brand/20 rounded-xl px-4 py-3">
            <div className="min-w-0">
              <p className="text-text-primary text-sm font-semibold">
                ✨ 자소서 풀페이지에서 AI 와 함께 작성하세요
              </p>
              <p className="text-text-quaternary text-[11px] mt-0.5">
                회사·직무 조사 + 활동일지 + 채팅으로 답변 작성·검토 가능
              </p>
            </div>
            <Link
              to={fullscreenHref}
              className="shrink-0 px-3 py-2 text-xs font-semibold text-text-primary bg-brand hover:bg-accent rounded-lg transition-colors"
            >
              열기 →
            </Link>
          </div>

          <div className="border border-line bg-surface-2 rounded-xl divide-y divide-line overflow-hidden">
            {list.map((cl) => (
              <CoverLetterCard
                key={cl.id}
                cl={cl}
                applicationId={applicationId}
              />
            ))}
          </div>
        </>

      {/* 빠른 추가 — 인라인 (풀페이지 안 가도 빠른 추가 가능, but 편집은 풀페이지에서) */}
      {list.length > 0 && (
        <div className="border border-line bg-surface-2 rounded-xl p-4">
          <p className="text-[11px] text-text-quaternary mb-2.5">
            빠른 추가 — 자주 쓰는 문항 (편집은 풀페이지에서)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_QUESTIONS.map((q) => (
              <button
                key={q.label}
                onClick={() => handleAdd(q.question, q.category)}
                disabled={creating}
                className="text-[11px] text-text-tertiary bg-surface-3 border border-line hover:border-brand/40 hover:text-text-secondary px-2 py-1 rounded-full transition-colors disabled:opacity-40"
              >
                + {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
