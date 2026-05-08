import { useNavigate } from 'react-router-dom'

interface GoalsSectionProps {
  goals: string[]
}

export function GoalsSection({ goals }: GoalsSectionProps) {
  const navigate = useNavigate()

  return (
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
      {goals.length === 0 ? (
        <div className="flex flex-col items-center py-4 gap-2 text-center">
          <p className="text-2xl">🎯</p>
          <p className="text-text-tertiary text-xs">아직 목표가 없어요</p>
          <button
            onClick={() => navigate('/myinfo#goals')}
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
    </section>
  )
}
