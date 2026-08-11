/**
 * 준비 노트 **시트 탭 줄** — 엑셀 탭 문법 (2026-08-11).
 *
 * 시나리오 (먼저 나열하고 코드를 짰다):
 *   A. 렌더·선택
 *     A1. 시트 이름이 순서대로 탭이 된다
 *     A2. 활성 탭만 aria-selected=true · tabIndex=0 (roving)
 *     A3. 탭을 누르면 onSelect
 *     A4. role=tablist / role=tab / aria-controls 가 에디터 패널을 가리킨다
 *   B. 추가 [+]
 *     B1. 누르면 onAdd
 *     B2. 🔴 캡(10장) 도달 → disabled + 숫자를 말하는 title
 *     B3. 추가 진행 중(adding) → disabled (연타로 두 장 생기지 않게)
 *   C. 이름 바꾸기
 *     C1. 활성 탭에만 연필이 있다 (모바일엔 hover 가 없어 **상시** 노출)
 *     C2. 연필 → onRenamingChange(id)
 *     C3. 활성 탭 더블클릭도 같은 자리로 (데스크탑 보너스)
 *     C4. renamingId 인 탭은 입력칸이 된다 (초기값 = 현재 이름 · maxLength 50)
 *     C5. Enter → onRename(trim 값) + 편집 종료
 *     C6. 🔴 ESC → 되돌린다 (onRename 미호출) — blur 가 뒤따라와도 확정되지 않는다
 *     C7. 값이 그대로면 onRename 미호출 (헛 PATCH 방지)
 *     C8. 🔴 공백만 남기면 되돌린다 (서버 400 을 미리 막는다)
 *     C9. 🔴 한글 조합 중 Enter 는 글자 확정이지 이름 확정이 아니다
 *     C10. 모바일 확대 방지 — 입력이 16px(text-base)
 *   D. 삭제 ×
 *     D1. 활성 탭에 × 가 있다 → onDelete(id)
 *     D2. 🔴 canDelete=false 면 × 자체가 없다 (마지막 1장)
 *     D3. 비활성 탭엔 연필도 × 도 없다
 *   E. 키보드
 *     E1. → 다음 시트로 (마지막에서 첫 장으로 순환)
 *     E2. ← 이전 시트로
 *     E3. 🔴 이름 편집 중엔 화살표가 탭을 옮기지 않는다 (입력 커서용이다)
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NoteSheetTabs } from './NoteSheetTabs'

const SHEETS = [
  { id: 's1', name: '예상 질문' },
  { id: 's2', name: '기업 분석' },
  { id: 's3', name: '역질문' },
]

const fn = {
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onRenamingChange: vi.fn(),
}

function draw(over: Partial<Parameters<typeof NoteSheetTabs>[0]> = {}) {
  return render(
    <NoteSheetTabs
      sheets={SHEETS}
      activeId="s1"
      renamingId={null}
      atCap={false}
      canDelete
      panelId="panel-1"
      {...fn}
      {...over}
    />,
  )
}

const tabs = () => screen.getAllByRole('tab')
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(name) })
const addBtn = () => screen.getByRole('button', { name: '시트 추가' })
const nameInput = () => screen.getByRole('textbox', { name: '시트 이름' })

beforeEach(() => {
  Object.values(fn).forEach((f) => f.mockReset())
})

describe('A. 렌더 · 선택', () => {
  it('A1. 시트 이름이 순서대로 탭이 된다', () => {
    draw()
    expect(tabs().map((t) => t.textContent)).toEqual([
      expect.stringContaining('예상 질문'),
      expect.stringContaining('기업 분석'),
      expect.stringContaining('역질문'),
    ])
  })

  it('A2. 활성 탭만 aria-selected · tabIndex=0', () => {
    draw()
    const [t1, t2] = tabs()
    expect(t1.getAttribute('aria-selected')).toBe('true')
    expect(t1.getAttribute('tabindex')).toBe('0')
    expect(t2.getAttribute('aria-selected')).toBe('false')
    expect(t2.getAttribute('tabindex')).toBe('-1')
  })

  it('A3. 탭을 누르면 onSelect', () => {
    draw()
    fireEvent.click(tab('기업 분석'))
    expect(fn.onSelect).toHaveBeenCalledWith('s2')
  })

  it('A4. tablist · aria-controls 가 에디터 패널을 가리킨다', () => {
    draw()
    expect(screen.getByRole('tablist', { name: '준비 노트 시트' })).toBeTruthy()
    expect(tabs()[0].getAttribute('aria-controls')).toBe('panel-1')
  })

  /**
   * 🔴 **이음새 방향** — 탭 줄은 에디터 **위**에 있으므로(CEO 2026-08-11) 활성 탭은
   * 아랫변을 지우고 아래 카드에 붙어야 한다. 하단 배치 시절의 `border-t-0`·`rounded-b-lg`
   * 가 남으면 탭이 카드에서 **떨어져 뜬 조각**으로 보인다 — 클래스가 조용히 되돌아가는
   * 회귀라 눈으로만 잡기 어렵다.
   */
  it('A5. 🔴 활성 탭이 아래 카드에 붙는 모양이다 (border-b-0 · rounded-t-lg)', () => {
    draw()
    const on = tabs()[0].className
    expect(on).toContain('border-b-0')
    expect(on).toContain('rounded-t-lg')
    expect(on).toContain('-mb-px')
    // 하단 배치 시절의 잔재가 없어야 한다
    expect(on).not.toContain('border-t-0')
    expect(on).not.toContain('rounded-b-lg')
  })

  /** [+]·이름 입력도 같은 방향이어야 탭 줄 밑변이 한 줄로 이어진다 */
  it('A6. [+] 와 이름 입력도 같은 이음새 방향', () => {
    draw({ renamingId: 's2' })
    expect(addBtn().className).toContain('rounded-t-lg')
    expect(addBtn().className).toContain('border-b-0')
    expect(nameInput().className).toContain('rounded-t-lg')
    expect(nameInput().className).toContain('border-b-0')
  })

  /**
   * 🔴 **상단 sticky 헤더(48px) 회피.** 상단 배치로 옮긴 직후 실측에서, 탭 줄이 화면 위로
   * 스크롤되면 `elementFromPoint` 가 헤더를 집었다 — 보이지도 눌리지도 않는 상태였다
   * (2026-08-11). 스크롤 대상은 탭·[+]·이름 입력 **각각**이라 셋 다 걸려 있어야 한다.
   */
  it('A7. 🔴 스크롤 대상 전부에 헤더 회피 여백(scroll-mt)이 있다', () => {
    draw({ renamingId: 's2' })
    expect(tabs()[0].className).toContain('scroll-mt-16')
    expect(addBtn().className).toContain('scroll-mt-16')
    expect(nameInput().className).toContain('scroll-mt-16')
  })
})

describe('B. 추가 [+]', () => {
  it('B1. 누르면 onAdd', () => {
    draw()
    fireEvent.click(addBtn())
    expect(fn.onAdd).toHaveBeenCalled()
  })

  /** 🔴 서버 캡을 화면이 먼저 말한다 — 눌러서 400 을 받는 건 사용자 몫이 아니다 */
  it('B2. 캡 도달 → disabled + 숫자를 말하는 title', () => {
    draw({ atCap: true })
    expect(addBtn()).toBeDisabled()
    expect(addBtn().getAttribute('title')).toBe('시트는 10장까지예요')
  })

  it('B3. 추가 진행 중이면 disabled (연타 이중 생성 방지)', () => {
    draw({ adding: true })
    expect(addBtn()).toBeDisabled()
  })
})

describe('C. 이름 바꾸기', () => {
  /** 🔴 hover 로만 나타나면 터치 기기에서는 이름을 바꿀 길이 **아예 없다** */
  it('C1. 활성 탭에만 연필이 있다 (상시 노출)', () => {
    draw()
    expect(
      within(tab('예상 질문')).getByRole('button', { name: /이름 바꾸기/ }),
    ).toBeTruthy()
    expect(
      within(tab('기업 분석')).queryByRole('button', { name: /이름 바꾸기/ }),
    ).toBeNull()
  })

  it('C2. 연필 → onRenamingChange(id)', () => {
    draw()
    fireEvent.click(within(tab('예상 질문')).getByRole('button', { name: /이름 바꾸기/ }))
    expect(fn.onRenamingChange).toHaveBeenCalledWith('s1')
  })

  it('C3. 활성 탭 더블클릭도 같은 자리로', () => {
    draw()
    fireEvent.doubleClick(tab('예상 질문'))
    expect(fn.onRenamingChange).toHaveBeenCalledWith('s1')
  })

  it('C4. renamingId 인 탭은 입력칸이 된다 (초기값 = 현재 이름)', () => {
    draw({ renamingId: 's1' })
    const input = nameInput() as HTMLInputElement
    expect(input.value).toBe('예상 질문')
    expect(input.maxLength).toBe(50)
    // 그 탭은 더 이상 탭이 아니다 (두 개만 남는다)
    expect(tabs()).toHaveLength(2)
  })

  it('C5. Enter → onRename + 편집 종료', () => {
    draw({ renamingId: 's1' })
    fireEvent.change(nameInput(), { target: { value: '  1차 기출  ' } })
    fireEvent.keyDown(nameInput(), { key: 'Enter' })
    expect(fn.onRename).toHaveBeenCalledWith('s1', '1차 기출')
    expect(fn.onRenamingChange).toHaveBeenCalledWith(null)
  })

  /** 🔴 ESC 뒤에 blur 가 따라온다 — 그 blur 가 확정하면 취소가 취소되지 않는다 */
  it('C6. ESC → 되돌린다 (onRename 미호출)', () => {
    draw({ renamingId: 's1' })
    fireEvent.change(nameInput(), { target: { value: '버릴 이름' } })
    fireEvent.keyDown(nameInput(), { key: 'Escape' })
    expect(fn.onRename).not.toHaveBeenCalled()
    expect(fn.onRenamingChange).toHaveBeenCalledWith(null)
  })

  it('C7. 값이 그대로면 onRename 미호출 (헛 PATCH 방지)', () => {
    draw({ renamingId: 's1' })
    fireEvent.blur(nameInput())
    expect(fn.onRename).not.toHaveBeenCalled()
    expect(fn.onRenamingChange).toHaveBeenCalledWith(null)
  })

  /** 🔴 서버는 trim 후 1~50자만 받는다 — 공백 탭이 생기느니 되돌리는 게 기대에 맞다 */
  it('C8. 공백만 남기면 되돌린다', () => {
    draw({ renamingId: 's1' })
    fireEvent.change(nameInput(), { target: { value: '   ' } })
    fireEvent.blur(nameInput())
    expect(fn.onRename).not.toHaveBeenCalled()
  })

  /** 🔴 「기출」 을 치는 중의 Enter 는 조합 확정이다 — 여기서 이름을 닫으면 글자가 잘린다 */
  it('C9. 한글 조합 중 Enter 는 확정하지 않는다', () => {
    draw({ renamingId: 's1' })
    fireEvent.change(nameInput(), { target: { value: '기출' } })
    fireEvent.keyDown(nameInput(), { key: 'Enter', isComposing: true })
    expect(fn.onRename).not.toHaveBeenCalled()
    expect(fn.onRenamingChange).not.toHaveBeenCalled()
  })

  it('C10. 모바일 확대 방지 — 입력이 16px(text-base)', () => {
    draw({ renamingId: 's1' })
    expect(nameInput().className).toContain('text-base')
  })
})

describe('D. 삭제 ×', () => {
  it('D1. 활성 탭의 × → onDelete', () => {
    draw()
    fireEvent.click(within(tab('예상 질문')).getByRole('button', { name: /시트 삭제/ }))
    expect(fn.onDelete).toHaveBeenCalledWith('s1')
  })

  /** 🔴 서버가 막는 버튼을 보여주는 건 거짓말이다 (마지막 1장은 못 지운다) */
  it('D2. canDelete=false 면 × 자체가 없다', () => {
    draw({ canDelete: false })
    expect(
      within(tab('예상 질문')).queryByRole('button', { name: /시트 삭제/ }),
    ).toBeNull()
    // 이름 바꾸기는 여전히 가능해야 한다
    expect(
      within(tab('예상 질문')).getByRole('button', { name: /이름 바꾸기/ }),
    ).toBeTruthy()
  })

  it('D3. 비활성 탭엔 연필도 × 도 없다', () => {
    draw()
    expect(within(tab('역질문')).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('E. 키보드', () => {
  it('E1. → 다음 시트', () => {
    draw()
    fireEvent.keyDown(tab('예상 질문'), { key: 'ArrowRight' })
    expect(fn.onSelect).toHaveBeenCalledWith('s2')
  })

  it('E1b. 마지막 시트에서 → 는 첫 장으로 순환한다', () => {
    draw({ activeId: 's3' })
    fireEvent.keyDown(tab('역질문'), { key: 'ArrowRight' })
    expect(fn.onSelect).toHaveBeenCalledWith('s1')
  })

  it('E2. ← 이전 시트', () => {
    draw({ activeId: 's2' })
    fireEvent.keyDown(tab('기업 분석'), { key: 'ArrowLeft' })
    expect(fn.onSelect).toHaveBeenCalledWith('s1')
  })

  /** 🔴 이름을 고치는 중의 ←/→ 는 커서 이동이다 — 탭이 넘어가면 입력이 사라진다 */
  it('E3. 이름 편집 중엔 화살표가 탭을 옮기지 않는다', () => {
    draw({ renamingId: 's1' })
    fireEvent.keyDown(nameInput(), { key: 'ArrowRight' })
    expect(fn.onSelect).not.toHaveBeenCalled()
  })
})
