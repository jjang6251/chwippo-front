export type ApplicationStatus = 'PLANNED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED'

export interface ApplicationStep {
  id: string
  applicationId: string
  orderIndex: number
  name: string
  scheduledDate: string | null
  location: string | null
}

export interface Application {
  id: string
  userId: string
  companyName: string
  jobTitle: string | null
  jobCategory: string | null
  status: ApplicationStatus
  deadline: string | null
  jobUrl: string | null
  memo: string | null
  currentStepIndex: number
  needsDetail: boolean
  steps: ApplicationStep[]
  createdAt: string
  updatedAt: string
}

export interface CreateApplicationDto {
  companyName: string
  jobTitle?: string
  jobCategory?: string
  status?: 'PLANNED' | 'IN_PROGRESS'
  deadline?: string
  jobUrl?: string
  needsDetail?: boolean
}

export interface UpdateApplicationDto {
  companyName?: string
  jobTitle?: string
  jobCategory?: string
  status?: ApplicationStatus
  deadline?: string
  jobUrl?: string
  memo?: string
  currentStepIndex?: number
  needsDetail?: boolean
}

export interface UpdateStepsDto {
  steps: Array<{
    orderIndex: number
    name: string
    scheduledDate?: string
    location?: string
  }>
}
