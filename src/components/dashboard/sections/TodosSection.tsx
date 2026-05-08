import { TodoList } from '@/components/dashboard/TodoList'
import type { Todo } from '@/api/todos'

interface TodosSectionProps {
  todos: Todo[] | undefined
  isLoading: boolean
  todayStr: string
}

export function TodosSection({ todos, isLoading, todayStr }: TodosSectionProps) {
  const todayTodos = todos?.filter((t) => t.date === todayStr) ?? []
  const doneCount = todayTodos.filter((t) => t.is_done).length
  const totalCount = todayTodos.length

  return (
    <section>
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
      <TodoList todos={todos} isLoading={isLoading} />
    </section>
  )
}
