import { apiClient } from '@/api/client'

/** 이 feature 에서 고를 수 있는(또는 못 고르는) 모델 하나 */
export interface SelectableModel {
  id: string
  label: string
  provider: string
  /** 코인 기준(anchor $1/M) 대비 원가 배수 — 비교·경고용 */
  costMultiplier: number
  /** 실단가 (USD per 1M tokens). 우리가 실제로 내는 값 — 청구서와 대조된다 */
  inputUsd: number
  outputUsd: number
  /**
   * null 이면 선택 가능. 아니면 **불가 사유**.
   * 목록에서 지우지 않고 사유와 함께 주는 이유 — 화면이 "왜 회색인지" 를 그대로 보여줘야
   * 관리자가 "이 모델은 왜 안 되지" 로 헤매지 않는다.
   */
  blockedReason: string | null
}

export interface FeatureModelRow {
  feature: string
  provider: string
  model: string
  label: string
  costMultiplier: number
  inputUsd: number
  outputUsd: number
  maxOutputTokens: number
  /** 이 feature 가 스트리밍을 필수로 요구하는가 (chat) */
  requiresStreaming: boolean
  updatedBy: string | null
  updatedAt: string | null
  selectable: SelectableModel[]
}

const unwrap = <T>(r: { data: { data: T } }) => r.data.data

export const featureModelAdminApi = {
  listAll: () =>
    apiClient.get<{ data: FeatureModelRow[] }>('/admin/feature-model').then(unwrap),

  /** provider 는 서버가 모델에서 파생한다 — 보내지 않는다 */
  update: (feature: string, model: string) =>
    apiClient
      .patch<{ data: FeatureModelRow }>(`/admin/feature-model/${feature}`, {
        model,
      })
      .then(unwrap),
}
