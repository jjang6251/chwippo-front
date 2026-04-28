import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const updateNickname = (nickname: string) =>
  apiClient.patch('/users/me/nickname', { nickname }).then(unwrap<{ nickname: string }>)

export const deleteAccount = () => apiClient.delete('/users/me')
