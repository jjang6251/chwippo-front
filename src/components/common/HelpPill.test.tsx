import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpPill } from './HelpPill'

/**
 * 필드 아래 한 줄 도움말.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. 라벨 pill + 문장이 같이 보인다
 *  2. 문장 톤은 text-text-tertiary text-sm (규칙 고정 — 화면마다 달라지면 안 읽힌다 · 40자 넘는
 *     「읽는 글」이라 DESIGN.md 7-b 최소 14px)
 *  3. id 를 주면 그대로 붙는다 → 입력의 aria-describedby 로 연결 가능
 *  4. id 를 안 주면 없다 (중복 id 사고 방지)
 *  5. ReactNode 자식(강조 포함)도 그대로 렌더된다
 */
describe('HelpPill', () => {
  it('라벨 pill + 문장을 같이 보여준다', () => {
    render(<HelpPill label="입력 형식">영문 성, 이름 순 · 예 HONG GILDONG</HelpPill>)
    expect(screen.getByText('입력 형식')).toBeInTheDocument()
    expect(screen.getByText('영문 성, 이름 순 · 예 HONG GILDONG')).toBeInTheDocument()
  })

  it('문장 톤 고정 — text-text-tertiary · text-sm (14px, 규칙 7-b)', () => {
    const { container } = render(<HelpPill label="만점 기준">4.3·4.0 만점은 만점 기준을 고르세요</HelpPill>)
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-text-tertiary')
    expect(p?.className).toContain('text-sm')
    expect(p?.className).not.toContain('text-xs')
  })

  it('id 를 주면 붙는다 (aria-describedby 연결용)', () => {
    const { container } = render(
      <HelpPill id="help-name-en" label="입력 형식">대문자</HelpPill>,
    )
    expect(container.querySelector('#help-name-en')).toBeInTheDocument()
  })

  it('id 를 안 주면 없다 — 중복 id 사고 방지', () => {
    const { container } = render(<HelpPill label="입력 형식">대문자</HelpPill>)
    expect(container.querySelector('p')?.getAttribute('id')).toBeNull()
  })

  it('자식으로 노드를 넣어도 렌더된다', () => {
    render(
      <HelpPill label="예시">
        예 <strong>HONG</strong>
      </HelpPill>,
    )
    expect(screen.getByText('HONG')).toBeInTheDocument()
  })
})
