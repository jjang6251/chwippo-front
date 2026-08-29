import { useState, useRef, useEffect } from 'react'
import { useSwipeable } from 'react-swipeable'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import type { Application, UpdateApplicationDto } from '@/types/application'
import { needsResult as isAwaitingResult } from '@/utils/boardViewGroups'
import { StepBar } from './StepBar'
import { DdayBadge } from './DdayBadge'
import { StarToggle } from './StarToggle'
import { useUpdateCurrentStep, useDeleteApplication, useUpdateApplication } from '@/hooks/useApplications'
import { useInterviewNudgeFlow } from '@/hooks/useInterviewNudgeFlow'
import { InterviewNudgeModal } from '@/components/card/InterviewNudgeModal'
import { NewInterviewSessionModal } from '@/components/card/NewInterviewSessionModal'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { toast } from '@/stores/toastStore'
import { celebrate, showFailedCare } from '@/stores/celebrationStore'
import { parseTags, JOB_CATEGORY_COLOR, JOB_CATEGORY_ICON } from '@/utils/tags'
import { CompanyAvatar } from '@/components/board/CompanyAvatar'
import { Trash2, Star, PenLine, TriangleAlert, Lightbulb } from 'lucide-react'

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
  const navigate = useDemoNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFailConfirm, setShowFailConfirm] = useState(false)
  const [showPassConfirm, setShowPassConfirm] = useState(false)
  const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { mutate: updateStep } = useUpdateCurrentStep()
  // 면접 단계로 이동하면 안내 모달 — 판정은 서버 응답 + 프론트 면접 유형 판정의 AND
  const nudge = useInterviewNudgeFlow()
  const { mutate: deleteApp, isPending: isDeleting } = useDeleteApplication()
  const { mutate: updateApp } = useUpdateApplication(application.id)
  const isMobile = useIsMobile()
  const [swipeOffset, setSwipeOffset] = useState(0)

  // W4 — 모바일 좌 swipe=삭제 (confirm) / 우 swipe=핀 토글
  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      // 수평 20° 이내만 인정 (세로 스크롤과 충돌 방지)
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 0.36) return
      setSwipeOffset(e.deltaX)
    },
    onSwipedLeft: (e) => {
      setSwipeOffset(0)
      if (Math.abs(e.deltaX) < 100 || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 0.36) return
      // 삭제는 파괴적 액션 — 기존 confirm 모달 재사용
      setShowDeleteConfirm(true)
    },
    onSwipedRight: (e) => {
      setSwipeOffset(0)
      if (Math.abs(e.deltaX) < 100 || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 0.36) return
      updateApp({ isStarred: !application.isStarred })
    },
    onTouchEndOrOnMouseUp: () => setSwipeOffset(0),
    trackMouse: false, // 데스크탑 마우스는 비활성 (모바일 touch 만)
    delta: 20,
    preventScrollOnSwipe: false,
  })

  const isPassed = application.status === 'PASSED'
  const isFailed = application.status === 'FAILED'
  const isPlanned = application.status === 'PLANNED'

  const sortedSteps = [...application.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const currentStep = sortedSteps[application.currentStepIndex]

  // D-day: 현재 스텝 날짜만 사용 (날짜 없으면 배지 없음)
  const ddayTarget = currentStep?.scheduledDate ?? null

  // 결과 배지: 마지막 스텝에서만, 날짜가 지났을 때.
  // 판정은 boardViewGroups 단일 구현 — 예전엔 여기·BoardDetail 이 각자 인라인으로
  // 갖고 있었고 셋 다 로컬 TZ 를 타서 비KST 기기에서 하루 일찍 떴다.
  const needsResult = isAwaitingResult(application)

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
      setPendingStepIndex(index)
      setShowPassConfirm(true)
    } else {
      updateStep(
        { id: application.id, stepIndex: index },
        { onSuccess: (app) => nudge.consider(app, index) },
      )
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('button')) return
    /**
     * 🔴 스텝바 노드 행은 **빗나가도 아무 일도 안 일어나야 한다.**
     *
     * 노드 히트 영역을 셀 폭 × 32px 로 키웠지만 위아래로는 여전히 빗나갈 수 있다.
     * 예전엔 그 순간 이 핸들러가 받아 **카드 상세로 튀었다** — 단계를 옮기려던 사람이
     * 갑자기 다른 화면에 있게 된다 (2026-08-24 실사용 보고). 노드를 키우는 것보다
     * **빗나갔을 때의 대가를 없애는 쪽**이 체감을 바꾼다.
     */
    if (el.closest('[data-no-card-nav]')) return
    navigate(`/board/${application.id}`)
  }

  const handleDelete = () => {
    deleteApp(application.id, {
      onSuccess: () => toast.show('카드가 삭제되었습니다.'),
      onError: () => toast.error('삭제에 실패했습니다.'),
    })
  }

  const shouldSwipeHint = isMobile && Math.abs(swipeOffset) > 20
  const swipingLeft = shouldSwipeHint && swipeOffset < 0
  const swipingRight = shouldSwipeHint && swipeOffset > 0

  return (
    <div className="relative overflow-hidden rounded-xl h-full">
      {/* W4 좌 swipe hint 배경 (danger 삭제) */}
      {swipingLeft && (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-end gap-1.5 pr-6 bg-danger/15 text-danger text-sm font-semibold pointer-events-none">
          <Trash2 size={15} strokeWidth={1.75} /> 삭제
        </div>
      )}
      {/* W4 우 swipe hint 배경 (brand 즐겨찾기) */}
      {swipingRight && (
        <div aria-hidden="true" className="absolute inset-0 flex items-center gap-1.5 pl-6 bg-brand/15 text-brand text-sm font-semibold pointer-events-none">
          <Star size={15} strokeWidth={1.75} fill="currentColor" /> {application.isStarred ? '즐겨찾기 해제' : '즐겨찾기'}
        </div>
      )}
      <div
        {...(isMobile ? swipeHandlers : {})}
        onClick={handleCardClick}
        /* 🔴 e2e 전용 식별자. 예전엔 `data-tour-card-id` 였는데 **투어 앵커가 아니라
           카드 열거용 선택자**로 쓰이고 있었다 (`e2e/board-card-height.spec.ts` — 카드 높이
           통일 검증이 이걸로 카드를 센다). 2026-08-17 투어를 지우며 함께 없앨 뻔했다 —
           `src` 만 grep 해서 「소비처 0」으로 오판했고 `e2e/` 를 안 봤다. 이름에서 tour 를 뗀다. */
        data-card-id={application.id}
        style={isMobile && swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)`, transition: 'none' } : undefined}
        className={`
          relative group border-l-2 rounded-xl p-4 cursor-pointer
          flex flex-col h-full
          transition-all duration-200
          ${STATUS_ACCENT[application.status]}
          ${isFailed ? 'opacity-45 bg-surface-2 border border-line hover:opacity-60' : ''}
          ${isPassed
            ? 'passed-card bg-gradient-to-br from-success/30 to-success/5 border-2 border-success/55 hover:border-success/70 hover:shadow-lg hover:shadow-success/20'
            : !isFailed
            ? 'bg-surface-2 border border-line hover:border-line-strong hover:bg-surface-3 hover:shadow-lg hover:shadow-black/30'
            : ''
          }
        `}
      >
      {/* 상단: 아바타 + 회사명 + 메뉴 */}
      {/* 🔴 `data-card-*` 는 **시각 무변경 훅**이다 — 앱 소개 투어 1장이 카드 내부 요소를
          순서대로 등장시키려고 잡는 자리다(`index.css` 의 `.tour-stage-1` 스코프).
          클래스 이름으로 잡으면 스타일을 손대는 순간 안무가 조용히 끊긴다. */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div data-card-header className="flex items-center gap-3 min-w-0">
          {isPassed || isFailed ? (
            <div
              className={`flex-none w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold tracking-tight ${
                isPassed ? 'bg-success/15 text-success' : 'bg-card text-text-quaternary'
              }`}
            >
              {application.companyName.charAt(0)}
            </div>
          ) : (
            <CompanyAvatar
              name={application.companyName}
              domain={application.domain}
              size="md"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-text-primary text-sm font-semibold truncate">{application.companyName}</h3>
              {isPassed && (
                <span className="text-[10px] text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-full border border-success/20 flex-none">
                  🎉 합격
                </span>
              )}
            </div>
            {/* 직무명 줄 — 없어도 빈 줄로 높이 예약 (카드 높이 통일) */}
            {application.jobTitle ? (
              <p className="text-text-tertiary text-xs truncate mt-0.5">{application.jobTitle}</p>
            ) : isPlanned ? (
              <p className="text-text-quaternary text-xs mt-0.5">{formatRegisteredDate(application.createdAt)}</p>
            ) : (
              <p className="text-xs mt-0.5" aria-hidden>&nbsp;</p>
            )}
          </div>
        </div>

        <div data-card-actions className="flex items-center gap-1 flex-none">
          {/* 별 토글 */}
          <StarToggle
            starred={application.isStarred}
            onToggle={() => updateApp({ isStarred: !application.isStarred })}
          />

          {/* D-day 배지 */}
          {ddayTarget && !isPassed && !isFailed && (
            <span data-card-dday className="inline-flex">
              <DdayBadge deadline={ddayTarget} />
            </span>
          )}

          {/* ... 메뉴 */}
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              aria-label="더보기 메뉴"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-quaternary hover:text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 bg-surface border border-line rounded-xl shadow-2xl py-1.5 w-36 animate-fadeInUp">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/board/${application.id}`); setMenuOpen(false) }}
                  className="w-full text-left px-3.5 py-2 text-xs text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
                >상세 보기</button>
                {application.status === 'IN_PROGRESS' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFailConfirm(true); setMenuOpen(false) }}
                    className="w-full text-left px-3.5 py-2 text-xs text-warning hover:bg-warning/8 transition-colors"
                  >불합격 처리</button>
                )}
                {/* A9 — 잘못 처리한 결과 롤백 (합격·불합격 공통) */}
                {(application.status === 'FAILED' || application.status === 'PASSED') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      updateApp(
                        { status: application.steps.length > 0 ? 'IN_PROGRESS' : 'PLANNED' },
                        {
                          onSuccess: () => toast.show('결과를 되돌렸어요 — 진행 중으로 복귀했어요.'),
                          onError: () => toast.error('되돌리기에 실패했습니다.'),
                        },
                      )
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-text-secondary hover:bg-card transition-colors"
                  >결과 되돌리기</button>
                )}
                <div className="mx-3 my-1 border-t border-line" />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setMenuOpen(false) }}
                  className="w-full text-left px-3.5 py-2 text-xs text-danger hover:bg-danger/8 transition-colors"
                >카드 삭제</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 태그들 — 없어도 한 줄 높이 예약 (카드 높이 통일) */}
      <div data-card-tags className="flex flex-wrap gap-1 mb-3 min-h-[22px]">
        {tags.map((tag) => {
          const colorClass = JOB_CATEGORY_COLOR[tag] ?? JOB_CATEGORY_COLOR['기타']
          const TagIcon = JOB_CATEGORY_ICON[tag] ?? JOB_CATEGORY_ICON['기타']
          return (
            <span key={tag} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${colorClass}`}>
              <TagIcon size={11} strokeWidth={2} aria-hidden="true" /> {tag}
            </span>
          )
        })}
      </div>

      {/* 하단 액션 클러스터 — mt-auto 로 카드 바닥 고정 (상태별 콘텐츠 높이 차를 상단 여백으로 흡수해 카드 높이 통일) */}
      <div className="mt-auto">
      {/* 스텝바 + 현재 단계명 */}
      {!isPlanned && application.steps.length > 0 && (
        <div className="mb-2">
          <StepBar
            steps={application.steps}
            currentStepIndex={application.currentStepIndex}
            status={application.status}
            /*
              🔴 **`onStepNameClick` 을 주지 않는다** — 그래야 `StepBar` 가 노드와 레이블을
              한 타깃으로 묶는다 (셀 폭 × 49px, 44×44 기준 충족).

              예전엔 8px 사이로 붙은 두 타깃이 **서로 다른 일**을 했다: 위는 단계 이동,
              아래(15px 높이)는 스텝 상세로 화면 전환. 그 애매함이 「노드를 누르다 카드
              상세로 넘어간다」의 절반이었다.

              보드에서 스텝 상세로 가는 직행은 사라진다 — 카드 상세의 「스텝 열기」·레이블,
              일정 있으면 캘린더, 노트 있으면 공부 노트 허브가 받는다. 보드는 훑고 옮기는
              화면이라는 판단(CEO 2026-08-25).
            */
            onStepClick={!isPassed && !isFailed ? handleStepClick : undefined}
            size="sm"
          />
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

      {/*
        하단 배지 — 둘이 **동시에** 뜰 수 있어서 색으로 우열을 가른다.
        상세 입력(warning) < 결과 입력(danger). 결과 입력이 더 급하다.

        리스트 뷰 칩·BoardDetail 배너는 같은 상태를 warning 으로 그리는데, 거기엔
        경쟁하는 배지가 없어 한 단계 올릴 이유가 없기 때문이다 — 뷰마다 색이 제각각인 게
        아니라 **여기만 옆 배지 때문에 올린 것**이다.
      */}
      {(application.needsDetail || needsResult) && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {application.needsDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/board/${application.id}`) }}
              className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/8 border border-warning/25 px-2 py-0.5 rounded-full hover:bg-warning/14 transition-colors font-medium"
            >
              <PenLine size={12} strokeWidth={2} aria-hidden="true" /> 상세 입력 필요
            </button>
          )}
          {needsResult && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetResult?.(application.id) }}
              className="inline-flex items-center gap-1 text-[10px] text-danger bg-danger/8 border border-danger/25 px-2 py-0.5 rounded-full hover:bg-danger/14 transition-colors font-medium"
            >
              <TriangleAlert size={12} strokeWidth={2} aria-hidden="true" /> 결과 입력 필요
            </button>
          )}
        </div>
      )}
      </div>

      {/* 불합격 확인 모달 */}
      {showFailConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowFailConfirm(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="불합격 처리 확인"
            className="bg-surface border border-line rounded-xl p-6 w-80 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-text-primary font-semibold text-sm mb-1">불합격 처리할까요?</h3>
            <p className="text-text-tertiary text-xs mb-5">
              <span className="text-text-secondary font-medium">{application.companyName}</span> 카드가 불합격으로 전환됩니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowFailConfirm(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">취소</button>
              <button
                onClick={() => {
                  // A9 — 처리 성공 시 전역 케어 오버레이. 카드는 FAILED 필터로 즉시
                  // 언마운트되므로 (인라인 모달은 케어가 뜨자마자 사라짐) 스냅샷 전달
                  const snapshot = {
                    applicationId: application.id,
                    currentStepIndex: application.currentStepIndex,
                    steps: application.steps.map((st) => ({
                      name: st.name,
                      orderIndex: st.orderIndex,
                    })),
                  }
                  updateApp(
                    { status: 'FAILED' } as UpdateApplicationDto,
                    {
                      onSuccess: () => showFailedCare(snapshot),
                      onError: () => toast.error('처리에 실패했습니다.'),
                    },
                  )
                  setShowFailConfirm(false)
                }}
                className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-warning/70 hover:bg-warning/90 rounded-lg transition-colors"
              >
                불합격 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="카드 삭제 확인"
            className="bg-surface border border-line rounded-xl p-6 w-80 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-text-primary font-semibold text-sm mb-1">카드를 삭제할까요?</h3>
            <p className="text-text-tertiary text-xs mb-5">
              <span className="text-text-secondary font-medium">{application.companyName}</span> 카드와 모든 정보가 삭제됩니다.
            </p>
            {/* A9 — 진행 중 카드 삭제 인터셉트: 탈락이라 지우는 경우가 많음 →
              * 불합격 기록의 이득(자소서 재사용·통과율 통계)을 그 순간에 제시 */}
            {application.status === 'IN_PROGRESS' && (
              <div className="bg-brand/8 border border-brand/25 rounded-lg px-3 py-2.5 mb-4">
                <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
                  <Lightbulb size={13} strokeWidth={1.75} className="inline-block align-[-0.125em] mr-1 text-brand" aria-hidden="true" />탈락이라 지우시는 거라면 — <span className="font-semibold">불합격으로 기록</span>하면
                  자소서는 다음 지원에서 재사용되고, 나의 통과율 통계에도 남아요.
                </p>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    // A9 — 세 번째 불합격 진입 경로도 동일한 전역 케어 오버레이로
                    const snapshot = {
                      applicationId: application.id,
                      currentStepIndex: application.currentStepIndex,
                      steps: application.steps.map((st) => ({
                        name: st.name,
                        orderIndex: st.orderIndex,
                      })),
                    }
                    updateApp(
                      { status: 'FAILED' },
                      {
                        onSuccess: () => showFailedCare(snapshot),
                        onError: () => toast.error('업데이트에 실패했습니다.'),
                      },
                    )
                  }}
                  className="w-full py-2 text-xs font-medium text-brand bg-brand/10 border border-brand/25 hover:bg-brand/15 rounded-lg transition-colors"
                >
                  불합격으로 기록 (삭제 안 함)
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">취소</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-danger/80 hover:bg-danger rounded-lg transition-colors disabled:opacity-50">
                {isDeleting ? '삭제 중...' : application.status === 'IN_PROGRESS' ? '그래도 삭제' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 최종 합격 확인 모달 */}
      {showPassConfirm && pendingStepIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowPassConfirm(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="최종 합격 처리 확인"
            className="bg-surface border border-line rounded-xl p-6 w-80 shadow-2xl animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-2xl mb-3">🎉</div>
            <h3 className="text-text-primary font-semibold text-sm mb-1">최종 합격 처리할까요?</h3>
            <p className="text-text-tertiary text-xs mb-5">
              <span className="text-text-secondary font-medium">{[...application.steps].sort((a, b) => a.orderIndex - b.orderIndex)[pendingStepIndex]?.name}</span> 완료 시 이 카드가 최종 합격으로 전환됩니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowPassConfirm(false)} className="flex-1 py-2.5 text-xs font-medium text-text-secondary bg-card hover:bg-card-strong active:bg-surface-3 rounded-lg transition-colors">취소</button>
              <button
                onClick={() => { updateStep({ id: application.id, stepIndex: pendingStepIndex }, { onSuccess: (app) => { celebrate(application.companyName); nudge.consider(app, pendingStepIndex) } }); setShowPassConfirm(false) }}
                className="flex-1 py-2.5 text-xs font-medium text-text-primary bg-success/80 hover:bg-success rounded-lg transition-colors"
              >
                합격 처리
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* 면접 유도 모달 — 닫기 4경로(X·오버레이·ESC·CTA)가 전부 close() 로 온다 */}
      <InterviewNudgeModal
        /* 🔴 열릴 때마다 새로 마운트시킨다 — 모달 안 `askDate` 초기값이 그때의 날짜 유무로
           잡혀야 한다 (`open` 이 false 여도 이 컴포넌트는 마운트된 채다). */
        key={nudge.pending?.stepId ?? 'closed'}
        open={nudge.pending !== null}
        variant={nudge.pending?.variant ?? 'first'}
        appId={nudge.pending?.appId ?? ''}
        stepId={nudge.pending?.stepId ?? ''}
        stepName={nudge.pending?.stepName ?? ''}
        companyName={nudge.pending?.companyName ?? ''}
        domain={nudge.pending?.domain}
        /* 🔴 **`pending` 의 스냅샷이 아니라 목록의 살아 있는 값**을 준다 — 모달 안에서 날짜를
           저장하면 캐시가 갱신되는데, 스냅샷을 쓰면 화면이 안 따라가 방금 넣은 날짜가
           「날짜 설정하기」로 되돌아간 것처럼 보인다. */
        scheduledDate={application.steps.find((st) => st.id === nudge.pending?.stepId)?.scheduledDate ?? null}
        onClose={nudge.close}
        onGo={nudge.go}
      />
      {/* CTA → 세션 생성 모달을 **바로** 연다 (면접 차수는 방금 이동한 스텝으로 미리 채움) */}
      {nudge.creating && (
        <NewInterviewSessionModal
          applicationId={nudge.creating.appId}
          defaultStepId={nudge.creating.stepId}
          onClose={nudge.cancelCreating}
          onCreated={(sessionId) => {
            nudge.cancelCreating()
            navigate(`/interviews/${sessionId}`)
          }}
          onNeedCoverletter={() => {
            const appId = nudge.creating?.appId
            nudge.cancelCreating()
            if (appId) navigate(`/board/${appId}/coverletter`)
          }}
        />
      )}
    </div>
  )
}
