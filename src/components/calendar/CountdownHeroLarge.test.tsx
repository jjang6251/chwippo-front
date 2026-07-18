/**
 * M1·M7·U21 — Hero 카드 밀림 해소 시나리오:
 * 1. 무공백 영문 40자 회사명 → 회사명 <p> 에 truncate 클래스 (오버플로 방어)
 *    · leading-none 제거 (M7 — 동적 텍스트 겹침 방지)
 * 2. CTA 버튼 행 → flex-wrap 클래스 (좁은 폭에서 카드 밖 밀림 방지)
 *
 * (오버플로 픽셀 단언은 jsdom 미지원 → 클래스 존재로 갈음)
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CountdownHeroLarge } from './CountdownHeroLarge'
import type { DdayItem } from '@/api/dashboard'

const LONG_NAME = 'Verylongcompanynamewithoutanyspaces12345' // 40자 무공백

const baseEvent: DdayItem = {
  type: 'step',
  applicationId: 'a1',
  stepName: '서류 접수',
  companyName: LONG_NAME,
  date: '2026-07-20',
  dday: 3,
  nextAction: 'no_action',
}

function renderHero(event: DdayItem = baseEvent) {
  return render(
    <MemoryRouter>
      <CountdownHeroLarge event={event} />
    </MemoryRouter>,
  )
}

describe('CountdownHeroLarge — 밀림 해소 (M1·M7·U21)', () => {
  it('1) 긴 회사명 → truncate 클래스, leading-none 없음', () => {
    renderHero()
    const nameEl = screen.getByText(LONG_NAME)
    expect(nameEl.className).toContain('truncate')
    expect(nameEl.className).not.toContain('leading-none')
  })

  it('2) CTA 버튼 행 → flex-wrap 클래스', () => {
    renderHero()
    const cta = screen.getByRole('link', { name: '카드 열기' })
    // CTA Link 의 부모 = CTA 버튼 행 div
    expect(cta.parentElement?.className).toContain('flex-wrap')
  })
})
