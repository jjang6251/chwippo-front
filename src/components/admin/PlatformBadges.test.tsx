/**
 * 사용 환경 뱃지 — 목록·상세가 공유하는 표시 규칙.
 *
 * 시나리오:
 * - 웹만 / 앱만 / 둘 다 (뱃지 2개) / 없음(—)
 * - 🔴 `platform` 자체가 `undefined` — **백엔드가 늦게 뜨는 배포 창**에서 실제로 일어난다
 *   (2026-07-31 실사고: 새 필드를 필수로 읽어 페이지 전체가 죽었다)
 * - 알림 미허용 앱 사용자 구분 (푸시를 보내도 안 닿음)
 * - compact: 아이콘만 남기되 **접근성 라벨은 유지**
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlatformBadges } from './PlatformBadges'

describe('PlatformBadges', () => {
  it('웹만 쓰면 웹 뱃지만', () => {
    render(<PlatformBadges platform={{ app: false, web: true }} />)
    expect(screen.getByText('웹')).toBeInTheDocument()
    expect(screen.queryByText('앱')).toBeNull()
  })

  it('앱만 쓰면 앱 뱃지만', () => {
    render(<PlatformBadges platform={{ app: true, web: false }} />)
    expect(screen.getByText('앱')).toBeInTheDocument()
    expect(screen.queryByText('웹')).toBeNull()
  })

  /** 🔴 이 케이스가 이 컴포넌트의 존재 이유 — 합친 아이콘 대신 뱃지 2개 */
  it('둘 다 쓰면 뱃지가 2개 나란히 뜬다', () => {
    render(<PlatformBadges platform={{ app: true, web: true }} />)
    expect(screen.getByText('웹')).toBeInTheDocument()
    expect(screen.getByText('앱')).toBeInTheDocument()
  })

  it('로그인 이력이 없으면 — 로 표시', () => {
    render(<PlatformBadges platform={{ app: false, web: false }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  /**
   * 🔴 **배포 창 방어.** 백엔드가 아직 옛 버전이면 이 필드가 통째로 없다.
   * 타입이 optional 이어도 **런타임에서 안 죽는지**는 별개 문제라 여기서 고정한다.
   */
  it('platform 이 undefined 여도 죽지 않고 — 로 표시', () => {
    render(<PlatformBadges platform={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  describe('푸시 도달 가능 여부', () => {
    it('알림 미허용 앱 사용자는 안내 문구가 다르다', () => {
      render(<PlatformBadges platform={{ app: true, web: false, pushCapable: false }} />)
      expect(screen.getByTitle(/알림 미허용/)).toBeInTheDocument()
    })

    /**
     * 🔴 **색·모양만으로 정보를 전달하면 안 된다.**
     * `title` 은 키보드·터치에서 안 뜨고 텍스트가 있는 요소에선 무시되기도 해 보조 수단이 못 된다.
     */
    it('미허용 표시가 점 하나가 아니라 텍스트로도 전달된다', () => {
      render(<PlatformBadges platform={{ app: true, web: false, pushCapable: false }} />)
      expect(screen.getByText('알림 미허용')).toHaveClass('sr-only')
    })

    it('알림 허용 앱 사용자는 미허용 표시가 없다', () => {
      render(<PlatformBadges platform={{ app: true, web: false, pushCapable: true }} />)
      expect(screen.queryByTitle(/알림 미허용/)).toBeNull()
    })
  })

  describe('compact', () => {
    /** 좁은 화면에서 글자를 지우되 **스크린리더는 계속 읽어야** 한다 */
    it('아이콘만 남겨도 접근성 라벨은 유지된다', () => {
      const { container } = render(
        <PlatformBadges platform={{ app: true, web: true }} compact />,
      )
      expect(container.querySelectorAll('.sr-only')).toHaveLength(2)
      expect(screen.getByText('웹')).toHaveClass('sr-only')
    })
  })
})
