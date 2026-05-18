import { beforeEach, describe, expect, it } from 'vitest'
import { useCelebrationStore, celebrate } from './celebrationStore'

describe('celebrationStore', () => {
  beforeEach(() => {
    useCelebrationStore.setState({ companyName: null })
  })

  it('초기 상태는 companyName=null (오버레이 닫힘)', () => {
    expect(useCelebrationStore.getState().companyName).toBeNull()
  })

  it('celebrate(name) → companyName 설정 (오버레이 열림)', () => {
    useCelebrationStore.getState().celebrate('카카오')
    expect(useCelebrationStore.getState().companyName).toBe('카카오')
  })

  it('이미 떠 있을 때 다시 celebrate → 마지막 회사명으로 덮어씀', () => {
    useCelebrationStore.getState().celebrate('네이버')
    useCelebrationStore.getState().celebrate('삼성전자')
    expect(useCelebrationStore.getState().companyName).toBe('삼성전자')
  })

  it('dismiss() → companyName=null', () => {
    useCelebrationStore.getState().celebrate('당근마켓')
    useCelebrationStore.getState().dismiss()
    expect(useCelebrationStore.getState().companyName).toBeNull()
  })

  it('celebrate 모듈 함수도 동일하게 동작 (컴포넌트 밖 호출용)', () => {
    celebrate('토스')
    expect(useCelebrationStore.getState().companyName).toBe('토스')
  })
})
