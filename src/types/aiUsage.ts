export interface AiUsageOverview {
  totalCalls: number
  totalCostUsd: number
  byFeature: Array<{ feature: string; calls: number; costUsd: number }>
  byStatus: Array<{ status: string; count: number }>
}

export interface AiUsageByUserRow {
  userId: string
  totalCalls: number
  totalCostUsd: number
  totalPromptTokens: number
  totalCompletionTokens: number
}

export interface AiUsageCallLog {
  id: string
  userId: string
  feature: string
  model: string
  promptTokens: number
  completionTokens: number
  costUsd: string
  latencyMs: number
  status: string
  errorMessage: string | null
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}
