import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useApplications } from '@/hooks/useApplications'
import { useDemoNavigate } from '@/hooks/useDemoNavigate'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/common/PullToRefreshIndicator'
import { BETA_FEATURES } from '@/config/betaFeatures'
import { useTourStore } from '@/stores/tourStore'
import { useAuthStore } from '@/stores/authStore'
import { CompanyCard } from '@/components/card/CompanyCard'
import { AddCardModal } from '@/components/card/AddCardModal'
import { StartApplicationModal } from '@/components/card/StartApplicationModal'
import { SetResultModal } from '@/components/card/SetResultModal'
import { SampleCardBadge } from '@/components/board/SampleCardBadge'
import { SampleCardGuideOverlay } from '@/components/board/SampleCardGuideOverlay'
import { SampleCardDismissBar } from '@/components/board/SampleCardDismissBar'
import { EmptyBoardState } from '@/components/board/EmptyBoardState'
import { BoardViewToggle } from '@/components/board/BoardViewToggle'
import { BoardListRow } from '@/components/board/BoardListRow'
import { BoardGroupedView } from '@/components/board/BoardGroupedView'
import type { ApplicationStatus } from '@/types/application'
import { sortApplications } from '@/utils/sortApplications'
import { loadBoardView, saveBoardView, type BoardView } from '@/utils/boardViewGroups'
import type { LucideIcon } from 'lucide-react'
import { Search, ClipboardList, Pin } from 'lucide-react'

type FilterTab = 'all' | ApplicationStatus

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'PLANNED', label: '지원 예정' },
  { key: 'IN_PROGRESS', label: '지원 중' },
  { key: 'PASSED', label: '합격' },
  { key: 'FAILED', label: '불합격' },
]

function CardSkeleton() {
  return (
    <div className="bg-surface-2 border border-line rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg bg-card" />
        <div className="flex-1">
          <div className="h-3.5 bg-card rounded w-24 mb-2" />
          <div className="h-2.5 bg-card rounded w-16" />
        </div>
      </div>
      <div className="h-2 bg-card rounded w-full mb-1" />
      <div className="h-2 bg-card rounded w-3/4" />
    </div>
  )
}

export function Board() {
  const [searchParams] = useSearchParams()
  const initialFilter = (searchParams.get('filter') as FilterTab) || 'all'
  const [filter, setFilter] = useState<FilterTab>(initialFilter)
  const [search, setSearch] = useState('')
  const [view, setViewState] = useState<BoardView>(loadBoardView)
  const setView = (next: BoardView) => {
    setViewState(next)
    saveBoardView(next)
  }
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addModalStatus, setAddModalStatus] = useState<'PLANNED' | 'IN_PROGRESS' | null>(null)
  const [startAppId, setStartAppId] = useState<string | null>(null)
  const [resultAppId, setResultAppId] = useState<string | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useDemoNavigate()

  const { data: applications = [], isLoading } = useApplications()
  const qc = useQueryClient()
  const pull = usePullToRefresh(async () => {
    await qc.invalidateQueries({ queryKey: ['applications'] })
  })
  const tourActive = useTourStore((s) => s.active)
  const tourStep = useTourStore((s) => s.step)
  const tourNext = useTourStore((s) => s.next)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = applications.filter((app) => {
    // 검색
    const matchSearch =
      !search ||
      app.companyName.toLowerCase().includes(search.toLowerCase()) ||
      app.jobTitle?.toLowerCase().includes(search.toLowerCase())

    // 필터 탭
    if (filter === 'all') {
      return matchSearch && app.status !== 'FAILED'
    }
    return matchSearch && app.status === filter
  })

  const sorted = sortApplications(filtered)

  // W1 — 진짜 카드와 샘플 카드 분리. 진짜 위·샘플 아래.
  const realCards = sorted.filter((a) => !a.isSample)
  const sampleCards = sorted.filter((a) => a.isSample)
  const allSampleCount = applications.filter((a) => a.isSample).length
  const user = useAuthStore((s) => s.user)
  const showDismissBar =
    !user?.sampleCardsDismissedAt && allSampleCount > 0 && filter !== 'PLANNED' && filter !== 'PASSED' && filter !== 'FAILED'

  const startApp = applications.find((a) => a.id === startAppId)
  const resultApp = applications.find((a) => a.id === resultAppId)

  const openStep = (appId: string, stepId: string) => navigate(`/board/${appId}/steps/${stepId}`)

  const countByStatus = (status: ApplicationStatus) => applications.filter((a) => a.status === status).length
  const failedCount = countByStatus('FAILED')

  return (
    <div className="w-full mx-auto px-[18px] pt-6 pb-[88px] lg:max-w-[1100px] lg:px-9 lg:py-9">
      <PullToRefreshIndicator {...pull} />
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-text-primary text-xl font-bold">지원 현황</h1>
          <p className="text-text-tertiary text-xs mt-0.5">
            {applications.filter((a) => a.status !== 'FAILED' && a.status !== 'PLANNED').length}개 지원 중
            {countByStatus('PASSED') > 0 && ` · 🎉 ${countByStatus('PASSED')}개 합격`}
          </p>
        </div>

        {/* + 추가 버튼 */}
        <div ref={addMenuRef} className="relative">
          <button
            data-tour="add-card-btn"
            onClick={() => {
              if (tourActive && tourStep === 3) {
                setAddModalStatus('IN_PROGRESS')
                tourNext()
              } else {
                setAddMenuOpen(!addMenuOpen)
              }
            }}
            className="flex items-center gap-1.5 bg-brand hover:bg-accent active:bg-accent-hover text-text-primary text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors shadow-lg shadow-brand/20"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            추가
          </button>

          {addMenuOpen && (
            <div className="absolute right-0 top-10 z-20 bg-surface border border-line rounded-xl shadow-2xl py-1.5 w-44 animate-fadeInUp">
              <button
                onClick={() => { setAddModalStatus('PLANNED'); setAddMenuOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-xs text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
              >
                <span className="block font-medium text-text-primary">지원 예정 추가</span>
                <span className="text-text-quaternary">회사명만 입력</span>
              </button>
              <div className="my-1 border-t border-line" />
              <button
                onClick={() => { setAddModalStatus('IN_PROGRESS'); setAddMenuOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-xs text-text-secondary hover:bg-card active:bg-card-strong transition-colors"
              >
                <span className="block font-medium text-text-primary">지원 중으로 추가</span>
                <span className="text-text-quaternary">스텝 자동 생성</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 검색 + 필터 탭 + 뷰 토글 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {/* W5 — 검색 (베타 D+1주 예정, 지금 hide) */}
        {BETA_FEATURES.search && (
          <div className="relative flex-1 sm:max-w-64">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-quaternary" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 12l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="회사명, 직무명 검색"
              className="w-full bg-input border border-line rounded-lg pl-8 pr-3 py-2 text-base sm:text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
          </div>
        )}

        {/* 필터 탭 + 뷰 토글 한 줄 — sm+: 좌우 분리, 모바일: 토글이 아래 줄로 wrap */}
        <div className="flex flex-wrap items-center gap-2 min-w-0 sm:flex-1 sm:flex-nowrap sm:justify-between">
          {/* 필터 탭 — 모바일: 독립 칩 (가로 스크롤) / sm+: segmented control */}
          <div
            className="w-full sm:w-auto min-w-0 overflow-x-auto sm:overflow-visible"
            style={{ scrollbarWidth: 'none' }}
          >
            <div role="tablist" aria-label="지원 상태 필터" className="flex items-center gap-1.5 sm:gap-1 whitespace-nowrap sm:bg-surface-2 sm:border sm:border-line sm:rounded-lg sm:p-1">
              {FILTER_TABS.map((tab) => {
              const count = tab.key === 'all'
                ? applications.filter((a) => a.status !== 'FAILED').length
                : tab.key === 'FAILED'
                ? failedCount
                : countByStatus(tab.key as ApplicationStatus)
              const isActive = filter === tab.key

              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  role="tab"
                  aria-selected={isActive}
                  className={`flex-none px-3 py-1.5 text-xs rounded-full sm:rounded-md font-medium transition-all whitespace-nowrap text-center border sm:border-transparent
                    ${isActive
                      ? 'bg-brand/15 border-brand/30 text-brand sm:bg-card-strong sm:text-text-primary sm:shadow-sm'
                      : 'bg-card border-line text-text-tertiary hover:text-text-secondary sm:bg-transparent sm:text-text-tertiary'
                    }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[10px] ${isActive ? 'text-brand/70 sm:text-text-tertiary' : 'text-text-quaternary'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
            </div>
          </div>

          {/* 뷰 토글 — 카드·리스트·그룹 */}
          <BoardViewToggle value={view} onChange={setView} className="ml-auto sm:ml-0" />
        </div>
      </div>

      {/* W1 — 샘플 dismiss 바 (sticky, 진짜+샘플 둘 다 있을 때만) */}
      {showDismissBar && <SampleCardDismissBar count={allSampleCount} />}

      {/* 카드 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        // W1 — 진짜+샘플 0건 (sample dismiss 됨 or 신규 미생성). search 결과 빈 화면은 기존 EmptyState
        search ? (
          <EmptyState filter={filter} search={search} onAdd={() => setAddModalStatus('IN_PROGRESS')} />
        ) : (
          <EmptyBoardState onAddFirst={() => setAddModalStatus('IN_PROGRESS')} />
        )
      ) : view === 'list' ? (
        // A11 — 리스트 뷰. 정렬·필터·검색 파이프라인(sorted)을 그대로 소비, 행만 다르게 렌더.
        <div className="bg-card-solid border border-line rounded-xl overflow-hidden shadow-sm divide-y divide-line">
          {sorted.map((app) => (
            <BoardListRow key={app.id} application={app} />
          ))}
        </div>
      ) : view === 'group' ? (
        // A11 — 그룹 뷰. 같은 sorted 를 단계 그룹으로 묶어 렌더 (빈 그룹 숨김).
        <BoardGroupedView applications={sorted} />
      ) : (
        <div className="grid gap-3 [grid-auto-rows:1fr] grid-cols-1 sm:grid-cols-2">
          {realCards.map((app) => (
            <CompanyCard
              key={app.id}
              application={app}
              onStartApplication={setStartAppId}
              onSetResult={setResultAppId}
              onCurrentStepClick={openStep}
            />
          ))}
          {sampleCards.map((app, i) => (
            <SampleCardWrap key={app.id} index={i}>
              <CompanyCard
                application={app}
                onStartApplication={setStartAppId}
                onSetResult={setResultAppId}
                onCurrentStepClick={openStep}
              />
            </SampleCardWrap>
          ))}
        </div>
      )}

      {/* 모달들 */}
      <AddCardModal
        open={addModalStatus !== null}
        onClose={() => setAddModalStatus(null)}
        defaultStatus={addModalStatus ?? 'IN_PROGRESS'}
      />

      {startApp && (
        <StartApplicationModal
          open={true}
          onClose={() => setStartAppId(null)}
          applicationId={startApp.id}
          companyName={startApp.companyName}
          currentCategory={startApp.jobCategory}
          currentJobTitle={startApp.jobTitle}
        />
      )}

      {resultApp && (
        <SetResultModal
          open={true}
          onClose={() => setResultAppId(null)}
          applicationId={resultApp.id}
          companyName={resultApp.companyName}
        />
      )}
    </div>
  )
}

/**
 * W1 — 샘플 카드 wrap.
 * group/sample-card relative + 우상단 "📌 샘플" 배지 + hover 시 GuideOverlay 노출.
 * dashed warning ring 으로 진짜 카드와 시각 분리 (CompanyCard 본체는 그대로, ring 만 overlay).
 */
function SampleCardWrap({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div className="group/sample-card relative h-full">
      {/* dashed warning ring — pointer-events-none 으로 클릭 차단 X */}
      <div className="absolute inset-0 rounded-xl border border-dashed border-warning/40 pointer-events-none z-[1]" />
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <SampleCardBadge />
      </div>
      {children}
      <SampleCardGuideOverlay index={index} />
    </div>
  )
}

function EmptyState({ filter, search, onAdd }: { filter: FilterTab; search: string; onAdd: () => void }) {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Search size={40} strokeWidth={1.5} className="text-text-quaternary mb-3" aria-hidden="true" />
        <p className="text-text-secondary text-sm font-medium">검색 결과가 없어요</p>
        <p className="text-text-quaternary text-xs mt-1">다른 회사명이나 직무명으로 검색해보세요</p>
      </div>
    )
  }

  // 기능 아이콘(빈 상태 안내) = lucide · 감정 순간(응원)은 이모지 유지 (아이콘 정책 · DESIGN.md)
  const messages: Record<FilterTab, { Icon?: LucideIcon; emoji?: string; title: string; desc: string }> = {
    all: { Icon: ClipboardList, title: '아직 지원한 회사가 없어요', desc: '첫 지원 카드를 추가해보세요!' },
    PLANNED: { Icon: Pin, title: '지원 예정 카드가 없어요', desc: '관심 기업을 미리 등록해두세요.' },
    IN_PROGRESS: { emoji: '🚀', title: '진행 중인 지원이 없어요', desc: '지원을 시작해보세요!' },
    PASSED: { emoji: '🎉', title: '아직 합격한 곳이 없어요', desc: '곧 좋은 소식이 올 거예요!' },
    FAILED: { emoji: '💪', title: '불합격 내역이 없어요', desc: '' },
  }

  const msg = messages[filter]
  const EmptyIcon = msg.Icon
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {EmptyIcon
        ? <EmptyIcon size={44} strokeWidth={1.5} className="text-text-quaternary mb-4" aria-hidden="true" />
        : <div className="text-4xl mb-4" aria-hidden="true">{msg.emoji}</div>}
      <p className="text-text-secondary text-sm font-medium mb-1">{msg.title}</p>
      {msg.desc && <p className="text-text-quaternary text-xs mb-6">{msg.desc}</p>}
      {filter === 'all' && (
        <button
          onClick={onAdd}
          className="bg-brand hover:bg-accent active:bg-accent-hover text-text-primary text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-brand/20"
        >
          + 첫 회사 추가하기
        </button>
      )}
    </div>
  )
}
