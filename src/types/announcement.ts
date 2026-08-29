/**
 * 공지의 **종류** — 「이게 시스템 알림인가, 새로 생긴 기능인가」를 가른다.
 *
 * 종류가 없던 시절엔 새 기능 소개도 점검 안내와 똑같은 확성기 모달로 떠서
 * 「읽고 닫는」 글이 됐다. 종류 + CTA 가 붙으면서 새 기능은 **눌러서 가 보는** 글이 된다.
 */
export type AnnouncementKind = 'feature' | 'improvement' | 'fix' | 'notice'

export interface Announcement {
  id: string
  title: string
  body: string
  type: 'banner' | 'modal'
  kind: AnnouncementKind
  /** 「지금 해보기」 버튼 글자 — 경로와 **둘 다 있거나 둘 다 없다** */
  cta_label: string | null
  /** 앱 내부 경로만 (`/` 로 시작). 외부 URL 은 서버가 막는다 */
  cta_path: string | null
  active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateAnnouncementDto {
  title: string
  body: string
  type: 'banner' | 'modal'
  kind: AnnouncementKind
  active: boolean
  cta_label?: string | null
  cta_path?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export interface UpdateAnnouncementDto {
  title?: string
  body?: string
  type?: 'banner' | 'modal'
  kind?: AnnouncementKind
  active?: boolean
  cta_label?: string | null
  cta_path?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export type ActiveAnnouncement = Pick<
  Announcement,
  'id' | 'title' | 'body' | 'type' | 'kind' | 'cta_label' | 'cta_path'
>
