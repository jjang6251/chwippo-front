import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PenTool, Sparkles } from 'lucide-react'
import { useDemoLink } from '@/hooks/useDemoLink'
import {
  useCoverletters,
  useCreateCoverletter,
} from '@/hooks/useApplicationCoverletters'
import { useApplication } from '@/hooks/useApplications'
import { useCompanyResearchCache } from '@/hooks/useCoverletterDoc'
import { useCoverletterAiBlocked } from '@/hooks/useCoverletterAiBlocked'
import { DesktopOnlyNotice } from '@/components/coverletter/DesktopOnlyNotice'
import { CoverLetterCard } from '@/components/card/CoverLetterCard'
import { CompanyResearchBanner } from '@/components/coverletter/CompanyResearchBanner'
import { JobPostingBanner } from '@/components/coverletter/JobPostingBanner'
import { toast } from '@/stores/toastStore'

/**
 * BoardDetail 의 자소서 탭 — 카드 리스트 + 풀페이지 진입 링크 + 빠른 문항 추가.
 *
 * 편집·삭제·AI 답변·가져오기·검사 = 모두 `/board/:appId/coverletter` 풀페이지.
 *
 * 🔴 `aiBlocked`(모바일·RN)에서 감추는 것은 **AI 안내뿐**이다 (2026-08-23). 문항 추가와
 * 풀페이지 작성은 모바일에서도 되므로 「PC에서 보기」로 안내하면 있는 길을 감춘다.
 */

const COMMON_QUESTIONS = [
  { label: '지원 동기', question: '해당 직무에 지원하게 된 동기를 작성해 주세요.', category: '지원동기' },
  { label: '성장 과정·가치관', question: '본인의 성장 과정과 가치관을 작성해 주세요.', category: '성장과정·가치관' },
  { label: '입사 후 포부', question: '입사 후 이루고 싶은 목표와 포부를 작성해 주세요.', category: '입사후포부' },
  { label: '직무 역량·핵심 경험', question: '지원 직무와 관련된 본인의 핵심 역량과 경험을 작성해 주세요.', category: '직무역량·핵심경험' },
]

// A1 — AI 요소(조사)만 조건부
export function CoverLetterTab({ applicationId, active }: { applicationId: string; active: boolean }) {
  const aiBlocked = useCoverletterAiBlocked()
  const link = useDemoLink()
  const { data: items, isLoading } = useCoverletters(applicationId, active)
  const { mutate: create, isPending: creating } = useCreateCoverletter(applicationId)
  // PR_B1c — application 의 generation status 별 UI 분기 (polling 자동)
  const { data: application } = useApplication(applicationId)
  // 회사 조사 배너 — 모바일 주 진입점에서도 조사 열람 (보기용, 게이트 무관)
  const { data: research, isLoading: researchLoading } = useCompanyResearchCache(
    applicationId,
    active,
  )
  const [bannerExpanded, setBannerExpanded] = useState(false)
  const [jpExpanded, setJpExpanded] = useState(false)

  const banners = (
    <>
      <CompanyResearchBanner
        research={research}
        loading={researchLoading}
        expanded={bannerExpanded}
        onToggle={() => setBannerExpanded((v) => !v)}
      />
      <JobPostingBanner
        applicationId={applicationId}
        jobPosting={application?.jobPosting}
        jobPostingStatus={application?.jobPostingStatus}
        /* 공고 파싱은 AI 호출 — 모바일·RN 에선 계속 닫는다 */
        readOnly={aiBlocked}
        expanded={jpExpanded}
        onToggle={() => setJpExpanded((v) => !v)}
      />
    </>
  )

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
  const fullscreenHref = link(`/board/${applicationId}/coverletter`)

  // A1 — 빈 상태 = 3경로 시작점: ✍️ 직접 쓰기(상시) · 🔎 회사 조사(AI 켜짐 시)
  if (list.length === 0) {
    if (!application) return null
    return (
      <div className="space-y-3">
        {banners}
        <div className="border border-line bg-surface-2 rounded-xl p-4">
          {/*
            🔴 **시작점을 모바일에서도 준다** (2026-08-23). 예전엔 여기서 시작 칩을 통째로
            감추고 안내만 띄웠는데, 이제 풀페이지에서 문항·답변을 쓸 수 있으므로 그 상태는
            **자소서를 시작할 방법이 아예 없는 화면**이 된다. PC 전용으로 남는 AI 는
            아래 안내가 따로 말한다.
          */}
          <p className="text-text-primary text-sm font-semibold mb-1">
            <span className="inline-flex items-center gap-1">
              <PenTool size={15} strokeWidth={1.75} aria-hidden="true" />
              바로 쓰기 — 문항을 추가하고 자유롭게 작성하세요
            </span>
          </p>
          <p className="text-[11px] text-text-quaternary mb-2.5">
            다른 곳에 써둔 자소서가 있다면 문항 추가 후 붙여넣으면 돼요
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
            <button
              onClick={() => handleAdd('')}
              disabled={creating}
              className="text-[11px] text-brand bg-brand/8 border border-brand/25 hover:bg-brand/15 px-2 py-1 rounded-full transition-colors disabled:opacity-40"
            >
              + 직접 입력
            </button>
          </div>
          {aiBlocked && <DesktopOnlyNotice variant="inline" className="mt-3" />}
          <Link
            to={fullscreenHref}
            className="inline-block mt-3 text-[11px] font-medium text-text-tertiary hover:text-text-primary transition-colors"
          >
            자소서 풀페이지에서 작성 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {banners}
      {/* PR_B1c Phase G — 회사 정보 outdated 안내 */}
      {/* PR UI — list.length===0 dead branch 제거 (line 47 에서 early return) */}
      <>
          {/*
            풀페이지 진입 강조 — 모바일·앱에서는 "AI 와 함께 작성하세요" 가 **지킬 수 없는
            약속**이다. 열어도 AI 는 없다(코인 소비 = IAP 방어선). 쓰는 것 자체는 되므로
            안내만 바꿔 끼운다.
          */}
          {aiBlocked ? (
            <DesktopOnlyNotice />
          ) : (
            <div className="flex items-center justify-between gap-2 bg-brand/5 border border-brand/20 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <p className="text-text-primary text-sm font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
                    자소서 풀페이지에서 AI 와 함께 작성하세요
                  </span>
                </p>
                <p className="text-text-quaternary text-[11px] mt-0.5">
                  회사·직무 조사 + 활동일지 + 채팅으로 답변 작성·검토 가능
                </p>
              </div>
              <Link
                to={fullscreenHref}
                className="shrink-0 px-3 py-2 text-xs font-semibold text-bg bg-brand hover:bg-accent rounded-lg transition-colors"
              >
                열기 →
              </Link>
            </div>
          )}

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

      {/*
        빠른 추가 — 인라인 (풀페이지 안 가도 빠른 추가 가능, but 편집은 풀페이지에서).
        🔴 모바일에서도 연다 (2026-08-23) — 추가는 AI 를 부르지 않고, 추가한 문항을
        풀페이지에서 바로 쓸 수 있다.
      */}
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
