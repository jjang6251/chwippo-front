import { apiClient } from './client'

export interface Todo {
  id: string
  user_id: string
  content: string
  date: string
  is_done: boolean
  created_at: string
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const getTodos = () =>
  apiClient.get('/todos').then(unwrap<Todo[]>)

export const createTodo = (body: { content: string; date: string }) =>
  apiClient.post('/todos', body).then(unwrap<Todo>)

export const updateTodo = (id: string, body: { content?: string; is_done?: boolean }) =>
  apiClient.patch(`/todos/${id}`, body).then(unwrap<Todo>)

export const deleteTodo = (id: string) =>
  apiClient.delete(`/todos/${id}`)

export const carryOverTodo = (id: string) =>
  apiClient.patch(`/todos/${id}/carry-over`).then(unwrap<Todo>)
