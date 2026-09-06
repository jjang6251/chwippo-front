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
import appSource from '../../App.tsx?raw'
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

  /**
   * 「연결된 확장」(`/settings/extension`) — 화면에 **60초짜리 페어링 코드**(자격증명)와
   * 기기 지문이 뜬다. 세션 리플레이에 남으면 녹화를 보는 사람이 그 창 안에서 남의 계정에
   * 확장을 붙일 수 있다. 다른 설정 하위 페이지와 달리 이 화면만 마스킹 경계 안이어야 한다.
   */
  it('연결된 확장 화면의 코드·지문이 마스킹 안에 들어간다', () => {
    const { container } = renderAt(
      '/secret',
      <>
        <span>638836</span>
        <span>ff73cf77 3b60405a</span>
      </>,
    )
    const masked = container.querySelector('[data-clarity-mask="true"]')
    expect(masked).toContainElement(screen.getByText('638836'))
    expect(masked).toContainElement(screen.getByText('ff73cf77 3b60405a'))
  })

  /**
   * 🔴 위 렌더 단언은 **감싸면 어떻게 되는지**만 보증한다. 정작 회귀는 App.tsx 에서 라우트
   * 한 줄이 그룹 **밖으로** 옮겨질 때 생기고, 그건 렌더 테스트로 안 잡힌다 (App 은
   * `BrowserRouter` + 전체 가드라 테스트에서 마운트할 수 없다). 그래서 라우트 트리 원문에서
   * `<Route element={<ClarityMask />}>` 블록의 경계를 찾아 그 안에 있는지 직접 확인한다.
   */
  it('App.tsx 라우트 트리에서 /settings/extension 이 ClarityMask 그룹 안에 있다', () => {
    const open = appSource.indexOf('<Route element={<ClarityMask />}>')
    expect(open).toBeGreaterThan(-1)

    // 그룹의 닫는 태그 = 여는 태그와 같은 들여쓰기의 첫 `</Route>`
    const indent = appSource.slice(0, open).split('\n').pop()!.length
    const close = appSource.indexOf(`\n${' '.repeat(indent)}</Route>`, open)
    expect(close).toBeGreaterThan(open)

    const group = appSource.slice(open, close)
    // 경계 검출이 맞는지부터 — 마스킹 안(내 정보)은 들어오고 밖(도움말)은 안 들어와야 한다.
    // 이 두 줄이 없으면 `close` 를 잘못 잡아 그룹이 통째로 커져도 아래 단언이 통과한다.
    expect(group).toContain('path="/myinfo"')
    expect(group).not.toContain('path="/settings/help"')

    expect(group).toContain('path="/settings/extension"')
    // 그룹 밖에 같은 경로가 또 있으면 어느 쪽이 이기는지 알 수 없다
    const outside = appSource.slice(0, open) + appSource.slice(close)
    expect(outside).not.toContain('path="/settings/extension"')
  })

  /** 값이 boolean 으로 바뀌면 React 가 속성을 지워 마스킹이 조용히 사라진다 */
  it("속성값이 문자열 'true' 로 렌더된다", () => {
    const { container } = renderAt('/secret', <p>x</p>)
    expect(
      container.querySelector('div')?.getAttribute('data-clarity-mask'),
    ).toBe('true')
  })
})
