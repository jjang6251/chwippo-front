import { useState, useRef, useEffect } from 'react'
import { useApplications } from '@/hooks/useApplications'
import { CompanyCard } from '@/components/card/CompanyCard'
import { AddCardModal } from '@/components/card/AddCardModal'
import { StartApplicationModal } from '@/components/card/StartApplicationModal'
import { SetResultModal } from '@/components/card/SetResultModal'
import type { Application, ApplicationStatus } from '@/types/application'

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
    <div className="bg-surface-2 border border-white/6 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-lg bg-white/6" />
        <div className="flex-1">
          <div className="h-3.5 bg-white/6 rounded w-24 mb-2" />
          <div className="h-2.5 bg-white/4 rounded w-16" />
        </div>
      </div>
      <div className="h-2 bg-white/6 rounded w-full mb-1" />
      <div className="h-2 bg-white/4 rounded w-3/4" />
    </div>
  )
}

export function Board() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addModalStatus, setAddModalStatus] = useState<'PLANNED' | 'IN_PROGRESS' | null>(null)
  const [startAppId, setStartAppId] = useState<string | null>(null)
  const [resultAppId, setResultAppId] = useState<string | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  const { data: applications = [], isLoading } = useApplications()

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

  // 마감일 임박순 정렬 (null은 뒤로)
  const sorted = [...filtered].sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  })

  const startApp = applications.find((a) => a.id === startAppId)
  const resultApp = applications.find((a) => a.id === resultAppId)

  const countByStatus = (status: ApplicationStatus) => applications.filter((a) => a.status === status).length
  const failedCount = countByStatus('FAILED')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
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
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            className="flex items-center gap-1.5 bg-brand hover:bg-accent text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-lg shadow-brand/20"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            추가
          </button>

          {addMenuOpen && (
            <div className="absolute right-0 top-10 z-20 bg-surface border border-white/10 rounded-xl shadow-2xl py-1.5 w-44 animate-fadeInUp">
              <button
                onClick={() => { setAddModalStatus('PLANNED'); setAddMenuOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-xs text-text-secondary hover:bg-white/5 transition-colors"
              >
                <span className="block font-medium text-text-primary">지원 예정 추가</span>
                <span className="text-text-quaternary">회사명만 입력</span>
              </button>
              <div className="my-1 border-t border-white/6" />
              <button
                onClick={() => { setAddModalStatus('IN_PROGRESS'); setAddMenuOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-xs text-text-secondary hover:bg-white/5 transition-colors"
              >
                <span className="block font-medium text-text-primary">지원 중으로 추가</span>
                <span className="text-text-quaternary">스텝 자동 생성</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 검색 + 필터 탭 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* 검색 */}
        <div className="relative flex-1 max-w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-quaternary" width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 12l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="회사명, 직무명 검색"
            className="w-full bg-surface-2 border border-white/8 rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/15 transition-all"
          />
        </div>

        {/* 필터 탭 */}
        <div className="flex items-center gap-1 bg-surface-2 border border-white/6 rounded-lg p-1">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === 'all'
              ? applications.filter((a) => a.status !== 'FAILED').length
              : tab.key === 'FAILED'
              ? failedCount
              : countByStatus(tab.key as ApplicationStatus)

            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all whitespace-nowrap
                  ${filter === tab.key
                    ? 'bg-white/10 text-text-primary shadow-sm'
                    : 'text-text-quaternary hover:text-text-secondary'
                  }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1.5 text-[10px] ${filter === tab.key ? 'text-text-tertiary' : 'text-text-quaternary'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 카드 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState filter={filter} search={search} onAdd={() => setAddModalStatus('IN_PROGRESS')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((app) => (
            <CompanyCard
              key={app.id}
              application={app}
              onStartApplication={setStartAppId}
              onSetResult={setResultAppId}
            />
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

function EmptyState({ filter, search, onAdd }: { filter: FilterTab; search: string; onAdd: () => void }) {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-3xl mb-3">🔍</div>
        <p className="text-text-secondary text-sm font-medium">검색 결과가 없어요</p>
        <p className="text-text-quaternary text-xs mt-1">다른 회사명이나 직무명으로 검색해보세요</p>
      </div>
    )
  }

  const messages: Record<FilterTab, { emoji: string; title: string; desc: string }> = {
    all: { emoji: '📋', title: '아직 지원한 곳이 없어요', desc: '첫 지원 카드를 추가해보세요!' },
    PLANNED: { emoji: '📌', title: '지원 예정 카드가 없어요', desc: '관심 기업을 미리 등록해두세요.' },
    IN_PROGRESS: { emoji: '🚀', title: '진행 중인 지원이 없어요', desc: '지원을 시작해보세요!' },
    PASSED: { emoji: '🎉', title: '아직 합격한 곳이 없어요', desc: '곧 좋은 소식이 올 거예요!' },
    FAILED: { emoji: '💪', title: '불합격 내역이 없어요', desc: '' },
  }

  const msg = messages[filter]
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-4">{msg.emoji}</div>
      <p className="text-text-secondary text-sm font-medium mb-1">{msg.title}</p>
      {msg.desc && <p className="text-text-quaternary text-xs mb-6">{msg.desc}</p>}
      {filter === 'all' && (
        <button
          onClick={onAdd}
          className="bg-brand hover:bg-accent text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-brand/20"
        >
          + 첫 카드 추가하기
        </button>
      )}
    </div>
  )
}
