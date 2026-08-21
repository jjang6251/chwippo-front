/**
 * Clarity 마스킹 경계 — **방침이 약속한 것을 코드가 지키는지** 검증한다.
 *
 * 개인정보처리방침 §5-2: *"자기소개서·활동 기록·내 정보 등 민감한 화면에는 마스킹을 추가로
 * 적용합니다"*. 이 spec 이 없으면 **문구만 남고 마스킹이 빠져도 아무도 모른다.**
 *
 * 🔴 Clarity 에는 "특정 화면 수집 중단" API 가 없다 — SPA 라 스크립트가 한 번 로드되면
 * 이후 라우팅까지 기록된다. **마스킹이 유일한 방어**라 여기가 뚫리면 대안이 없다.
 *
 * 시나리오: 마스킹 속성 부착 · 하위 라우트 전파 · 렌더 분기 무관성
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ClarityMask } from './ClarityMask'

function renderAt(path: string, child: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ClarityMask />}>
          <Route path="/secret" element={child} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClarityMask', () => {
  it('하위 라우트를 마스킹 속성 안에 감싼다', () => {
    const { container } = renderAt('/secret', <p>자소서 본문</p>)
    const masked = container.querySelector('[data-clarity-mask="true"]')
    expect(masked).not.toBeNull()
    expect(masked).toContainElement(screen.getByText('자소서 본문'))
  })

  /**
   * 🔴 **페이지 컴포넌트에 붙이지 않고 라우트에서 감싸는 이유가 이것이다.**
   * 로딩·에러·빈 상태 같은 다른 렌더 분기에서만 민감 정보가 보이면, 페이지에 붙인 마스킹은
   * 그 분기를 놓친다. 라우트를 감싸면 **무엇이 그려지든** 마스킹 안이다.
   */
  it('어떤 렌더 분기가 나와도 마스킹 안에 있다', () => {
    const { container } = renderAt('/secret', <div>로딩 중 스켈레톤</div>)
    const masked = container.querySelector('[data-clarity-mask="true"]')
    expect(masked).toContainElement(screen.getByText('로딩 중 스켈레톤'))
  })

  /**
   * study-note-media PR-A — 공부 노트 본문에 **사용자가 올린 이미지**가 들어온다.
   * 마스킹 경계가 라우트 단위라 본문에 무엇이 그려지든(글이든 그림이든) 같은 경계 안이다 —
   * 이미지만 따로 마스킹 클래스를 붙일 필요가 없다는 근거를 여기 잠가 둔다.
   */
  it('본문 이미지도 같은 경계 안이다 (공부 노트 첨부)', () => {
    const { container } = renderAt(
      '/secret',
      <img src="https://cdn.example/note.png" alt="필기 사진" />,
    )
    const masked = container.querySelector('[data-clarity-mask="true"]')
    expect(masked).toContainElement(screen.getByAltText('필기 사진'))
  })

  /** 값이 boolean 으로 바뀌면 React 가 속성을 지워 마스킹이 조용히 사라진다 */
  it("속성값이 문자열 'true' 로 렌더된다", () => {
    const { container } = renderAt('/secret', <p>x</p>)
    expect(
      container.querySelector('div')?.getAttribute('data-clarity-mask'),
    ).toBe('true')
  })
})
