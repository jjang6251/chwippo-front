/**
 * M6 — CountdownPillCard 회사명 오버플로 방어 시나리오:
 * 1. 무공백 영문 40자 회사명 → 회사명 <p> 에 truncate 클래스
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CountdownPillCard } from './CountdownPillCard'
import type { DdayItem } from '@/api/dashboard'

const LONG_NAME = 'Verylongcompanynamewithoutanyspaces12345'

const event: DdayItem = {
  type: 'step',
  applicationId: 'a1',
  stepName: '서류 접수',
  companyName: LONG_NAME,
  date: '2026-07-20',
  dday: 5,
}

describe('CountdownPillCard — 회사명 truncate (M6)', () => {
  it('1) 긴 회사명 → truncate 클래스', () => {
    render(
      <MemoryRouter>
        <CountdownPillCard event={event} />
      </MemoryRouter>,
    )
    const nameEl = screen.getByText(LONG_NAME)
    expect(nameEl.className).toContain('truncate')
  })
})
