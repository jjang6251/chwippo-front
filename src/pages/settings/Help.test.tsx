/**
 * 도움말 — 앱 소개 투어의 **두 번째이자 마지막 진입점**.
 *
 * 기존 사용자에게 투어를 자동으로 띄우지 않기로 했으므로(`plans/app-tour.md` §Out of Scope)
 * 스스로 찾아올 자리가 여기 하나뿐이다. 🔴 `?replay=1` 이 빠지면 다시 보기가
 * **저장을 켜서** 「처음 만난 시각」과 이탈 장면을 오염시킨다.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Help } from './Help'

describe('Help', () => {
  it('「앱 소개 다시 보기」가 replay=1 로 투어를 연다', () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '앱 소개 다시 보기' })
    expect(link).toHaveAttribute('href', '/signup/tour?replay=1')
  })

  it('기존 문의 링크는 그대로 있다', () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '문의하기' })).toHaveAttribute(
      'href',
      '/inquiry',
    )
  })
})
