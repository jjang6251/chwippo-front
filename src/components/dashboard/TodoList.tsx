import { useState, useRef } from 'react'
import type { Todo } from '@/api/todos'
import { useCreateTodo, useUpdateTodo, useDeleteTodo, useCarryOverTodo } from '@/hooks/useTodos'

interface TodoListProps {
  todos: Todo[] | undefined
  isLoading: boolean
}

export function TodoList({ todos, isLoading }: TodoListProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { mutate: create } = useCreateTodo()
  const { mutate: update } = useUpdateTodo()
  const { mutate: remove } = useDeleteTodo()
  const { mutate: carryOver } = useCarryOverTodo()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const todayItems = todos?.filter((t) => t.date === today) ?? []
  const yesterdayItems = todos?.filter((t) => t.date === yesterday && !t.is_done) ?? []

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !input.trim()) return
    create({ content: input.trim(), date: today })
    setInput('')
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 bg-surface-2 border border-white/6 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 입력창 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-white/8 rounded-lg focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/15 transition-all">
        <svg className="text-text-quaternary flex-none" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (!e.nativeEvent.isComposing) handleKeyDown(e) }}
          placeholder="할 일 추가 (엔터로 등록)"
          className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-quaternary focus:outline-none"
        />
      </div>

      {/* 오늘 할 일 */}
      {todayItems.length > 0 && (
        <div className="space-y-1">
          {todayItems.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => update({ id: todo.id, is_done: !todo.is_done })}
              onDelete={() => remove(todo.id)}
            />
          ))}
        </div>
      )}

      {todayItems.length === 0 && (
        <p className="text-text-quaternary text-xs text-center py-3">오늘 할 일을 추가해보세요</p>
      )}

      {/* 어제 미완료 */}
      {yesterdayItems.length > 0 && (
        <div>
          <p className="text-text-quaternary text-[10px] font-medium mb-1.5 px-1">어제 미완료</p>
          <div className="space-y-1">
            {yesterdayItems.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => update({ id: todo.id, is_done: !todo.is_done })}
                onDelete={() => remove(todo.id)}
                carryOverButton
                onCarryOver={() => carryOver(todo.id)}
                dimmed
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface TodoItemProps {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
  onCarryOver?: () => void
  carryOverButton?: boolean
  dimmed?: boolean
}

function TodoItem({ todo, onToggle, onDelete, onCarryOver, carryOverButton, dimmed }: TodoItemProps) {
  return (
    <div className={`group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/4 transition-colors ${dimmed ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        className={`flex-none w-4 h-4 rounded border transition-colors ${
          todo.is_done
            ? 'bg-brand border-brand'
            : 'border-white/20 hover:border-brand/60'
        }`}
      >
        {todo.is_done && (
          <svg viewBox="0 0 10 10" fill="none" className="w-full h-full p-0.5">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <span className={`flex-1 text-xs min-w-0 truncate ${todo.is_done ? 'line-through text-text-quaternary' : 'text-text-secondary'}`}>
        {todo.content}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {carryOverButton && onCarryOver && (
          <button
            onClick={onCarryOver}
            className="text-[10px] text-brand hover:text-accent px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
          >
            오늘로
          </button>
        )}
        <button
          onClick={onDelete}
          className="w-5 h-5 flex items-center justify-center text-text-quaternary hover:text-danger transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
