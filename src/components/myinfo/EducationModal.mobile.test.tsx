/**
 * EducationModal — **모바일(vaul Drawer)** 갈래의 Clarity 마스킹.
 *
 * 개인정보처리방침 §5-2 는 「내 정보 창고 등 민감 화면은 마스킹되어 Clarity 에 전송되지 않는다」고
 * 약속하고, `App.tsx` 가 `/myinfo` 를 `<ClarityMask>` 로 감싸 지킨다. 그런데 **vaul 은
 * `Drawer.Portal` 로 `document.body` 에 붙어 그 래퍼 밖에 렌더**된다 — 학력 시트 안의 학교명·전공·
 * 첨부 파일명이 마스킹 밖으로 새는 구멍이었다 (2026-09-06). 그래서 `Drawer.Content` 자신에
 * `CLARITY_MASK` 를 붙였고, 그게 유지되는지 본다.
 *
 * ## 케이스 목록 (먼저 나열하고 짠다)
 *  1. 🔴 모바일: 포털된 시트 컨테이너(`role="dialog"`)가 `data-clarity-mask="true"` 를 가진다
 *  2. 🔴 모바일: 시트 **안의 텍스트**(학교명 칸)도 같은 마스킹 안이다 (서브트리 전체가 덮인다)
 *
 * 🔴 **vaul 은 mock 하지 않는다** — 증명할 것이 「포털로 빠져나간 노드에 마스킹이 붙어 있나」라서,
 * 포털을 흉내낸 래퍼 div 로는 결함을 못 잡는다. jsdom 에서도 vaul 은 `Drawer.Content` 를 body 에
 * 포털하고 `role="dialog"` 로 잡힌다.
 * 데스크탑 갈래는 라우트 래퍼(`ClarityMask`)가 덮으므로 이 spec 의 대상이 아니다.
 *
 * 자동완성·업로드는 갈아 끼운다 — 여기 관심사는 시트 컨테이너의 속성이지 그 안의 위젯이 아니다
 * (`EducationModal.test.tsx` 와 같은 방식).
 */
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileSlot } from '@/utils/fileSlot'
import { EducationModal } from './EducationModal'

vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => true, useMediaQuery: () => true }))
vi.mock('@/stores/toastStore', () => ({ toast: { error: vi.fn(), show: vi.fn() } }))
vi.mock('./SchoolAutocomplete', () => ({
  SchoolAutocomplete: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="학교명" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('./MajorAutocomplete', () => ({
  MajorAutocomplete: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="전공" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('./FileUpload', () => ({
  FileUpload: ({ slot }: { slot: FileSlot }) => (
    <button type="button">{slot.kind === 'empty' ? '파일 첨부' : '파일 교체'}</button>
  ),
}))

function draw() {
  render(
    <EducationModal
      initial={null}
      onClose={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
    />,
  )
}

afterEach(cleanup)

describe('EducationModal — 모바일 시트 Clarity 마스킹 (방침 §5-2)', () => {
  it('1) 포털된 시트 컨테이너가 마스킹 대상이다', () => {
    draw()
    // 포털이라 render 컨테이너 밖 — document 전체에서 잡아야 의미가 있다
    const sheet = screen.getByRole('dialog', { name: '학력 추가' })
    expect(sheet.closest('[data-clarity-mask="true"]')).not.toBeNull()
  })

  it('2) 시트 안 텍스트(학교명 칸)도 같은 마스킹 안이다', () => {
    draw()
    expect(screen.getByLabelText('학교명').closest('[data-clarity-mask="true"]')).not.toBeNull()
  })
})
