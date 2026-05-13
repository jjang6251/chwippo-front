import { apiClient } from './client'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const agreeTerms = () =>
  apiClient.post('/users/me/terms').then(() => undefined)

export const markOnboarded = () =>
  apiClient.post('/users/me/onboard').then(() => undefined)

export const updateNickname = (nickname: string) =>
  apiClient.patch('/users/me/nickname', { nickname }).then(unwrap<{ nickname: string }>)

export const deleteAccount = () => apiClient.delete('/users/me')

export interface DashboardSection {
  id: string
  visible: boolean
}

export interface DashboardConfig {
  sections: DashboardSection[]
}

export const getDashboardConfig = (): Promise<DashboardConfig> =>
  apiClient.get('/users/me/dashboard-config').then(unwrap<DashboardConfig>)

export const patchDashboardConfig = (config: DashboardConfig): Promise<DashboardConfig> =>
  apiClient.patch('/users/me/dashboard-config', config).then(unwrap<DashboardConfig>)
