import { useNavigate } from 'react-router-dom'
import { StatCard } from '@/components/dashboard/StatCard'
import { DdayList } from '@/components/dashboard/DdayList'
import { TodoList } from '@/components/dashboard/TodoList'
import { useDashboardStats, useDdayList } from '@/hooks/useDashboard'
import { useTodos } from '@/hooks/useTodos'
import { useProfile } from '@/hooks/useMyinfo'

export function Dashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: dday, isLoading: ddayLoading } = useDdayList()
  const { data: todos, isLoading: todosLoading } = useTodos()
  const { data: profile } = useProfile()

  const goals = profile?.goal_other
    ?.split('\n')
    .map((g) => g.trim())
    .filter(Boolean) ?? []

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const month = now.getMonth() + 1
  const date = now.getDate()
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const day = dayNames[now.getDay()]

  const todayTodos = todos?.filter((t) => t.date === todayStr) ?? []
  const doneCount = todayTodos.filter((t) => t.is_done).length
  const totalCount = todayTodos.length

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <p className="text-text-quaternary text-xs mb-1">{month}월 {date}일 ({day})</p>
        <h1 className="text-text-primary text-xl font-bold">대시보드</h1>
      </div>

      {/* 통계 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label="전체 지원"
          value={stats?.total}
          icon="📋"
          description="서류부터 최종까지 진행 중인 기업"
          filterKey="all"
          accent="brand"
          isLoading={statsLoading}
        />
        <StatCard
          label="면접 진행중"
          value={stats?.interviews}
          icon="🗓️"
          description="현재 면접 단계에 있는 기업"
          filterKey="IN_PROGRESS"
          accent="warning"
          isLoading={statsLoading}
        />
        <StatCard
          label="최종 합격"
          value={stats?.passed}
          icon="🎉"
          description="합격이 확정된 기업"
          filterKey="PASSED"
          accent="success"
          isLoading={statsLoading}
        />
      </div>

      {/* 오늘 할 일 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text-primary text-sm font-semibold">✅ 오늘 할 일</h2>
          {totalCount > 0 && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              doneCount === totalCount
                ? 'bg-success/15 text-success border border-success/20'
                : 'bg-white/8 text-text-tertiary border border-white/10'
            }`}>
              {doneCount} / {totalCount} 완료
            </span>
          )}
        </div>
        <div className="bg-surface-2 border border-white/7 rounded-xl p-4">
          <TodoList todos={todos} isLoading={todosLoading} />
        </div>
      </section>

      {/* D-day 임박 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text-primary text-sm font-semibold">📅 D-day 임박</h2>
        </div>
        <div className="bg-surface-2 border border-white/7 rounded-xl p-4">
          <DdayList items={dday} isLoading={ddayLoading} />
        </div>
      </section>

      {/* 내 스펙 목표 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text-primary text-sm font-semibold">🎯 내 스펙 목표</h2>
          <button
            onClick={() => navigate('/myinfo#goals')}
            className="text-[11px] text-text-quaternary hover:text-text-tertiary transition-colors"
          >
            편집 →
          </button>
        </div>
        <div className="bg-surface-2 border border-white/7 rounded-xl p-4">
          {goals.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2 text-center">
              <p className="text-2xl">🎯</p>
              <p className="text-text-tertiary text-xs">아직 목표가 없어요</p>
              <button
                onClick={() => navigate('/myinfo')}
                className="mt-1 text-[11px] text-brand hover:text-accent transition-colors"
              >
                내 정보 창고에서 목표 추가하기 →
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {goals.map((goal, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger/60 flex-none" />
                  {goal}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
