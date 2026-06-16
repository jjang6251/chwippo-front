import { describe, expect, it } from 'vitest'
import {
  AUDIT_ACTION_KR,
  alertTypeLabel,
  auditActionLabel,
  featureLabel,
  modelLabel,
} from './featureLabel'

describe('featureLabel', () => {
  it('등록된 feature → 한국어 라벨', () => {
    expect(featureLabel('company_research')).toBe('회사 조사')
    expect(featureLabel('coverletter_draft_v2')).toBe('자소서 AI 답변')
    expect(featureLabel('interview_prep_session')).toBe('면접 질문 생성')
    expect(featureLabel('note_summary')).toBe('노트 요약')
  })

  it('legacy / deprecated feature → 명시 표기', () => {
    expect(featureLabel('coverletter')).toBe('자소서 (legacy)')
    expect(featureLabel('score')).toBe('점수 (deprecated)')
    expect(featureLabel('auto_tag')).toBe('자동 태그 (deprecated)')
  })

  it('미등록 feature → 원본 fallback', () => {
    expect(featureLabel('unknown_new_feature')).toBe('unknown_new_feature')
  })

  it('빈 string → 빈 string fallback', () => {
    expect(featureLabel('')).toBe('')
  })
})

describe('modelLabel', () => {
  it('등록된 model → 짧은 한국어 표기', () => {
    expect(modelLabel('gpt-4o')).toBe('GPT-4o')
    expect(modelLabel('claude-haiku-4-5')).toBe('Claude Haiku 4.5')
    expect(modelLabel('claude-haiku-4-5-20251001')).toBe('Claude Haiku 4.5')
    expect(modelLabel('mock')).toBe('Mock (테스트)')
  })

  it('미등록 model → fallback', () => {
    expect(modelLabel('llama-3-70b')).toBe('llama-3-70b')
  })
})

describe('auditActionLabel + AUDIT_ACTION_KR', () => {
  it('action enum 17종 모두 매핑 (Phase 1 + 기존)', () => {
    const expected = [
      'grant_coin',
      'revoke_coin',
      'suspend',
      'unsuspend',
      'update_suspend_reason',
      'auto_unsuspend',
      'grant_admin',
      'revoke_admin',
      'rename',
      'delete',
      'warn',
      'export',
      'update_tier',
      'reset_ai_quota',
      'auto_ban_ai',
      'update_ai_quota',
      'update_alert_thresholds',
    ]
    for (const action of expected) {
      expect(AUDIT_ACTION_KR[action]).toBeDefined()
      expect(AUDIT_ACTION_KR[action].label).toMatch(/[가-힣]/)
      expect(AUDIT_ACTION_KR[action].icon).toBeTruthy()
      expect(AUDIT_ACTION_KR[action].tone).toMatch(
        /^(success|warning|danger|info|neutral)$/,
      )
    }
  })

  it('grant_coin → 코인 지급 (tone info, icon 🪙)', () => {
    expect(auditActionLabel('grant_coin')).toBe('코인 지급')
    expect(AUDIT_ACTION_KR.grant_coin.tone).toBe('info')
    expect(AUDIT_ACTION_KR.grant_coin.icon).toBe('🪙')
  })

  it('suspend → 정지 (tone danger)', () => {
    expect(AUDIT_ACTION_KR.suspend.tone).toBe('danger')
  })

  it('미등록 action → 원본 fallback', () => {
    expect(auditActionLabel('made_up_action')).toBe('made_up_action')
  })
})

describe('alertTypeLabel', () => {
  it('alert_type 모두 매핑', () => {
    expect(alertTypeLabel('daily_cost')).toBe('일 누적 비용 초과')
    expect(alertTypeLabel('hourly_error_rate')).toBe('시간당 에러율 초과')
    expect(alertTypeLabel('abuser_ban')).toBe('어뷰저 자동 ban')
    expect(alertTypeLabel('provider_down')).toBe('AI provider 장애')
  })

  it('미등록 → fallback', () => {
    expect(alertTypeLabel('unknown_alert')).toBe('unknown_alert')
  })
})
