import { useState } from 'react'
import { CollapsibleChevron } from '@/components/common/CollapsibleChevron'
import { toast } from '@/stores/toastStore'
import { formatMonthDay } from '@/utils/datetime'
import { useDemoMode } from '@/contexts/demoMode'
import { useDeleteJobPosting } from '@/hooks/useJobPosting'
import {
  JobPostingModal,
  type JobPostingModalMode,
} from '@/components/coverletter/JobPostingModal'
import { hasJobPostingData, countJobPostingItems, normalizeJobPosting, type JobPosting } from '@/api/jobPosting'

/**
 * 📋 공고 요건 UI — 두 표면 공용 (자소서 페이지 · 카드 상세). 단일 구현.
 * F안 (SectionTitle brand 틱 + 타이포 위계) 문법 재사용.
 *
 * variant:
 *  - 'banner' (기본, 자소서): 회사 조사 배너 아래 배너. 데이터=접힘 배너 / 빈=CTA 박스 / 정리중=스켈레톤.
 *  - 'section' (카드 상세): DART 접힘 카드와 동일 패턴. 항상 접힘 헤더(요건 N개 정리됨 / 미정리 / 정리 중)
 *    + 펼치면 요건 표시·파싱 유도. localStorage 기억은 소비 측(BoardDetail)이 expanded/onToggle 로 제어.
 *
 * 공통: 데이터 있음=섹션별 표시 + "M/D 정리됨" + 수정·다시 정리·삭제 · 빈=파싱 유도 CTA ·
 *       정리 중=진행 스켈레톤 · 모바일·RN(readOnly)=액션 미노출·빈 상태 미노출 · 파싱/수정 = JobPostingModal.
 */

interface Props {
  applicationId: string
  jobPosting: JobPosting | null | undefined
  /** 'parsing' = 정리 중 (새로고침 재진입 표시). 서버가 2분 stale 시 null 로 회수 */
  jobPostingStatus?: 'parsing' | null
  readOnly: boolean
  expanded: boolean
  onToggle: () => void
  /** 'banner' = 자소서(기본) · 'section' = 카드 상세 DART 스타일 접힘 카드 */
  variant?: 'banner' | 'section'
}

export function JobPostingBanner({
  applicationId,
  jobPosting,
  jobPostingStatus,
  readOnly,
  expanded,
  onToggle,
  variant = 'banner',
}: Props) {
  /* 기술 스택·자격증·키워드 펼침 — 배너 펼침과 같은 **세션성**(회사 조사 배너와 같은 규칙) */
  const [showMoreReq, setShowMoreReq] = useState(false)
  const [modalMode, setModalMode] = useState<JobPostingModalMode | null>(null)
  const [confirm, setConfirm] = useState<'delete' | 'reparse' | null>(null)
  const { mutate: remove, isPending: removing } =
    useDeleteJobPosting(applicationId)
  // 데모 모드 전용 더미 고지 — 실서비스(useDemoMode=false)에선 절대 미노출
  const isDemo = useDemoMode()

  const hasData = hasJobPostingData(jobPosting)

  const modal = modalMode && (
    <JobPostingModal
      open
      onClose={() => setModalMode(null)}
      applicationId={applicationId}
      mode={modalMode}
      initial={jobPosting ?? null}
    />
  )

  /**
   * 요건 — **자소서 문항이 묻는 것**(core)과 **지원 자격 확인용**(more)으로 가른다.
   * 담당업무·자격요건·우대사항은 지원동기·직무역량 문항의 직접 재료지만,
   * 기술 스택은 이미 자격요건에 녹아 있고 자격증·어학·키워드는 "내가 지원할 수 있나"를
   * 볼 때 쓴다. 자소서를 쓰는 중에는 앞의 셋이면 된다.
   */
  const renderCore = (data: JobPosting) => (
    <>
      {data.responsibilities?.trim() && (
        <TextItem title="담당업무" content={data.responsibilities} />
      )}
      {data.requirements.length > 0 && (
        <ListItem title="자격요건 (필수)" items={data.requirements} />
      )}
      {data.preferred.length > 0 && (
        <ListItem title="우대사항 ⭐" items={data.preferred} />
      )}
    </>
  )
  const renderMore = (data: JobPosting) => (
    <>
      {/*
        🔴 「기술 스택」이 아니라 「기술·툴」 — 이 요건은 이제 **전 직군 공고**에서 자동으로
        채워진다(공고 붙여넣기). 간호사 카드에 「기술 스택: 수술실 간호」가 뜨면 그 자리에서
        앱이 개발자용으로 읽힌다. 0개면 섹션째 숨긴다 (아래 조건).
      */}
      {data.techStack.length > 0 && (
        <ChipItem title="기술·툴" chips={data.techStack} />
      )}
      {data.qualifications.length > 0 && (
        <ChipItem title="자격증·어학" chips={data.qualifications} />
      )}
      {data.keywords.length > 0 && (
        <ChipItem title="키워드" chips={data.keywords} />
      )}
    </>
  )
  const hasMoreReq = (data: JobPosting) =>
    data.techStack.length > 0 ||
    data.qualifications.length > 0 ||
    data.keywords.length > 0
  // 섹션 모드(카드 상세·면접 사이드바)는 전부 — 거기선 자소서 본문과 자리를 다투지 않는다
  const renderRequirements = (data: JobPosting) => (
    <>
      {renderCore(data)}
      {renderMore(data)}
    </>
  )

  // 데모 더미 고지 (배너·섹션 공용) — 요건 표시 하단. 데모에서만.
  const demoNotice = isDemo && (
    <p className="text-text-quaternary text-[11px] leading-relaxed mt-2">
      예시용 더미 공고 요건이에요 — 실제 채용 공고가 아닙니다
    </p>
  )

  // 수정·다시 정리·삭제 액션 (배너·섹션 공용)
  const actions = !readOnly && (
    <div className="flex items-center gap-1">
      <ActionBtn onClick={() => setModalMode('edit')}>수정</ActionBtn>
      <ActionBtn onClick={() => setConfirm('reparse')}>다시 정리</ActionBtn>
      <ActionBtn onClick={() => setConfirm('delete')} danger>
        삭제
      </ActionBtn>
    </div>
  )

  // 확인 다이얼로그 (배너·섹션 공용)
  const confirmDialogs = (
    <>
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

  // ── variant 'section' — 카드 상세 DART 스타일 접힘 카드 ──
  if (variant === 'section') {
    // 빈 상태 + readOnly + 정리 중 아님 → 미노출 (자소서 정책 일치)
    if (!hasData && readOnly && jobPostingStatus !== 'parsing') return null

    const parsing = jobPostingStatus === 'parsing'
    /* `as` 대신 정규화 — 배열이 비어 와도 화면이 안 죽는다 (읽기 경계 방어) */
    const data = hasData ? normalizeJobPosting(jobPosting) : null
    const hint = parsing
      ? '정리 중…'
      : data
        ? `요건 ${countJobPostingItems(data)}개 정리됨`
        : '미정리'

    return (
      <>
        <section
          aria-labelledby="job-posting-heading"
          className="border border-line bg-surface-2 rounded-xl overflow-hidden"
        >
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className="w-full flex items-center justify-between gap-2 px-5 py-4 hover:bg-card active:bg-card-strong transition-colors text-left"
          >
            <span className="flex items-center gap-2 min-w-0">
              <h2
                id="job-posting-heading"
                className="text-text-primary text-sm font-semibold shrink-0"
              >
                📋 공고 요건
              </h2>
              <span className="text-text-quaternary text-[11px] truncate">
                {hint}
              </span>
            </span>
            <CollapsibleChevron open={expanded} />
          </button>

          {expanded && (
            <div className="px-5 pb-5 border-t border-line pt-4 text-xs">
              {parsing ? (
                <div
                  className="space-y-1.5"
                  aria-live="polite"
                  aria-label="공고 요건 정리 중"
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2.5 bg-surface-3 rounded animate-pulse"
                      style={{ width: `${88 - i * 16}%` }}
                    />
                  ))}
                </div>
              ) : data ? (
                <>
                  {renderRequirements(data)}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2 mt-1 border-t border-line">
                    <p className="text-text-quaternary text-[10px]">
                      {data.parsedAt
                        ? `${formatMonthDay(data.parsedAt)} 정리됨 · 회원님의 지원 준비에만 활용돼요`
                        : ''}
                    </p>
                    {actions}
                  </div>
                  {demoNotice}
                </>
              ) : (
                <div>
                  <p className="text-text-secondary text-xs font-medium mb-1">
                    참고할 만한 공고 내용을 정리해두면 좋아요
                  </p>
                  <p className="text-text-quaternary text-[11px] leading-relaxed mb-2.5">
                    담당업무·자격요건·우대사항을 붙여넣으면 AI가 항목별로 정리해드려요
                  </p>
                  <button
                    onClick={() => setModalMode('create')}
                    className="text-[11px] text-brand bg-brand/8 border border-brand/25 hover:bg-brand/15 px-2.5 py-1 rounded-full transition-colors"
                  >
                    + 공고 요건 정리하기
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {modal}
        {confirmDialogs}
      </>
    )
  }

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

  /* 위 `hasData` 게이트를 통과한 값 — `as` 대신 정규화로 타입을 참으로 만든다 */
  const data = normalizeJobPosting(jobPosting)!

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
          /* 회사 조사 배너와 같은 14px — 세로로 나란히 있는 형제라 크기가 다르면
             한쪽이 덜 중요해 보인다. 접힘이 이미 위계를 만들고 있어서 크기로 또
             낮추지 않는다 (섹션 제목 11px 과 3px 차이로 위계는 선명하다). */
          <div className="px-3 pb-2 text-sm">
            {renderCore(data)}
            {hasMoreReq(data) && (
              <>
                {showMoreReq && renderMore(data)}
                <button
                  type="button"
                  onClick={() => setShowMoreReq((v) => !v)}
                  aria-expanded={showMoreReq}
                  className="flex items-center gap-1 min-h-[32px] text-[11px] font-semibold text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <CollapsibleChevron open={showMoreReq} />
                  {showMoreReq ? '접기' : '더보기'}
                </button>
              </>
            )}

            {/*
              🔴 `flex-wrap` 필수 — 이 섹션은 카드 상세(넓음)뿐 아니라 **면접 세션
              사이드바(280px)** 에서도 쓰인다. wrap 이 없으면 "수정·다시 정리·삭제" 가
              날짜와 한 줄에 눌려 깨져 보인다. 좁으면 날짜 → 버튼 순으로 두 줄이 된다.
            */}
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2 mt-1 border-t border-line">
              <p className="text-text-quaternary text-[10px]">
                {data.parsedAt ? `${formatMonthDay(data.parsedAt)} 정리됨` : ''}
              </p>
              {actions}
            </div>
            {demoNotice}
          </div>
        )}
      </div>

      {modal}
      {confirmDialogs}
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
      className={`text-[10px] px-2 min-h-[32px] inline-flex items-center rounded transition-colors ${
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
            className={`flex-1 py-2 text-xs font-medium text-bg rounded-lg transition-colors disabled:opacity-50 ${
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
