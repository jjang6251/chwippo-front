/**
 * 계정 삭제 안내 — **Google Play 데이터 보안 의무 요건이라 조용히 어긋나면 안 된다.**
 *
 * 🔴 이 spec 의 목적은 "렌더되는가" 가 아니라 **안내와 실제가 일치하는가** 다.
 *  ① 삭제 경로가 **두 개 다** 있는가 (앱 내 즉시 삭제 + 로그인 불가 시 이메일).
 *     Play 는 앱 내 경로만 있고 웹 경로가 없으면 반려한다.
 *  ② 앱 안 실제 문구(`pages/settings/ProfileSettings.tsx` 의 "계정 탈퇴" 안내)와 같은 문장인가.
 *  ③ 보유·파기 기준을 **여기서 새로 주장하지 않고** 방침으로 위임하는가 —
 *     두 군데에 적으면 한쪽만 갱신되는 날이 온다.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AccountDeletion } from './AccountDeletion'

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountDeletion />
    </MemoryRouter>,
  )
}

describe('계정 삭제 안내', () => {
  it('제목이 표시된다', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '계정 삭제 안내' })).toBeInTheDocument()
  })

  describe('삭제 경로 — 두 개 다 있어야 한다', () => {
    it('방법 1 (앱·웹에서 직접 삭제) 과 경로 안내가 있다', () => {
      renderPage()
      expect(screen.getByText(/방법 1 — 앱·웹에서 직접 삭제/)).toBeInTheDocument()
      expect(screen.getByText(/설정 → 프로필 설정/)).toBeInTheDocument()
      expect(screen.getByText(/계정 탈퇴에서 탈퇴하기/)).toBeInTheDocument()
    })

    /**
     * 🔴 문구의 원천은 이 페이지가 아니라 **실제 UI** 다.
     * `ProfileSettings.tsx` 의 "계정 탈퇴" 섹션 안내문과 같은 문장이어야 한다 —
     * 여기서 표현을 바꾸면 안내와 실제가 갈라진다.
     */
    it('탈퇴 결과를 앱 안 실제 문구 그대로 알린다', () => {
      renderPage()
      expect(
        screen.getByText(
          /탈퇴 시 지원 카드, 내 정보, 업로드한 파일 등 모든 데이터가 즉시 삭제되며\s+복구할 수 없습니다/,
        ),
      ).toBeInTheDocument()
    })

    it('방법 2 (로그인 불가 시) 로 support 이메일을 안내한다', () => {
      renderPage()
      expect(screen.getByText(/방법 2 — 로그인이 어려운 경우/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'support@chwippo.com' })).toHaveAttribute(
        'href',
        'mailto:support@chwippo.com?subject=계정 삭제 요청',
      )
    })
  })

  describe('삭제되는 데이터', () => {
    it('삭제 범위를 항목으로 밝힌다', () => {
      renderPage()
      expect(screen.getByText('삭제되는 데이터')).toBeInTheDocument()
      for (const item of [
        /계정 정보 \(이메일·닉네임\)/,
        /지원 카드 및 전형 일정/,
        /자기소개서·준비 노트/,
        /내 정보 창고 항목/,
        /업로드한 파일 전부/,
      ]) {
        expect(screen.getByText(item)).toBeInTheDocument()
      }
    })

    /** 보유 기간을 여기서 새로 만들지 않고 방침 하나로 위임한다 */
    it('세부 기준은 개인정보처리방침으로 링크 위임한다', () => {
      renderPage()
      expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
        'href',
        '/privacy',
      )
    })

    /**
     * Play 데이터 보안 요건 ③ — 보관 데이터 유형·기간을 이 페이지 자체에 명시.
     * 문구는 방침 §3·§6 미러링 — 방침이 바뀌면 이 spec 이 드리프트를 잡는다.
     */
    it('보관되는 데이터 및 기간 섹션을 명시한다 (방침 §3·§6 미러)', () => {
      renderPage()
      expect(screen.getByText('보관되는 데이터 및 기간')).toBeInTheDocument()
      expect(
        screen.getByText(/추가로 보관하는 개인정보는 없습니다/),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/법령에 의해 보존 의무가 있는 정보는 해당 법정 기간/),
      ).toBeInTheDocument()
    })
  })
})
