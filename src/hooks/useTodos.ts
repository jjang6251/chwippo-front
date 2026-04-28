import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTodos, createTodo, updateTodo, deleteTodo, carryOverTodo } from '@/api/todos'
import { toast } from '@/stores/toastStore'

export function useTodos() {
  return useQuery({ queryKey: ['todos'], queryFn: getTodos })
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
    onError: () => toast.error('추가에 실패했습니다.'),
  })
}

export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; content?: string; is_done?: boolean }) =>
      updateTodo(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
    onError: () => toast.error('수정에 실패했습니다.'),
  })
}

export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
    onError: () => toast.error('삭제에 실패했습니다.'),
  })
}

export function useCarryOverTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: carryOverTodo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
    onError: () => toast.error('오류가 발생했습니다.'),
  })
}
