/**
 * 게이지 — 「지원서 기본 세트 N/7」.
 *
 * 옛 spec 은 「N/8 **섹션** 작성」을 지켰다. 그 문구가 「확장을 쓰려면 이걸 다 채워야 하나」로
 * 읽힌 게 이번 변경의 이유라, 지키는 문장 자체가 바뀌었다 (계산은 `computeCoreSet` spec).
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  1. isLoading → 스켈레톤, 게이지 없음
 *  2. 「지원서 기본 세트 5/7」 + 원형 퍼센트
 *  3. 미완료 항목이 칩으로 나열된다 (완료 항목은 안 나온다)
 *  4. 칩을 누르면 그 항목의 섹션으로 이동한다 — 지시(`jump`)도 같이 간다
 *  4-a. 🔴 「편집 열기 + 칸 포커스」 지시가 onJump 로 그대로 간다 (칩이 데려간 자리가 바로 쓸 수 있는 칸)
 *  5. 🔴 병역처럼 힌트가 있으면 칩 글자가 힌트로 바뀐다 (「성별을 고르면…」)
 *  6. 🔴 7/7 → 완성 문구 · 칩 없음
 *  7. 단계 색 — 0% 빨강 · 30% 주황 · 70% 인디고 · 100% 초록
 *  8. 「있으면 자동으로 채워져요 (N/11)」 — 기본은 접혀 있다 (추가 정보가 빠져 12 → 11)
 *  9. 펼치면 11개가 ✓/○ 로 나오고, 동의 없는 장애는 「선택」
 * 10. 접이식 항목도 눌러서 이동한다
 * 11. ARIA progressbar 속성
 * 12. 「지금 쓰이는 곳」 — 약속이 아니라 지금 동작하는 것만 적는다
 *  ── 상태를 글자로 (아이콘·툴팁은 읽히지 않거나 겹친다)
 * 13. 🔴 ✓/○ 는 `role="img"` + 이름(「채움」·「비어 있음」) — 글자 모양만으로는 안 읽힌다
 * 14. 🔴 칩에 `title` 이 없다 — 보이는 글자와 툴팁이 같은 말을 두 번 하던 자리
 * 15. 「N/7」 은 `aria-live="polite"` — 칸을 채우면 오르는 숫자가 들려야 한다
 * 16. 🔴 접혀 있어도 `aria-controls` 대상이 DOM 에 있다 (없는 id 를 가리키지 않는다)
 * 17. 칩·접이식 항목에 `touch-manipulation` (300ms 탭 지연 제거)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import type { CoreItemId, CoreSet, JumpOptions, OptionalItemId, SectionId } from '@/utils/myinfoProgress'

vi.mock('@/hooks/useMyinfoProgress', () => ({
  useMyinfoProgress: vi.fn(),
}))

import { MyinfoProgressGauge } from './MyinfoProgressGauge'
import { useMyinfoProgress } from '@/hooks/useMyinfoProgress'

const mockedUse = useMyinfoProgress as unknown as ReturnType<typeof vi.fn>

const CORE: [CoreItemId, string][] = [
  ['name', '이름'], ['phone', '연락처'], ['birthdate', '생년월일'], ['address', '주소'],
  ['education', '최종 학력'], ['military', '병역'], ['patriot', '보훈 여부'],
]
const CORE_LABELS = CORE.map(([, label]) => label)
const OPTIONAL: [OptionalItemId, string][] = [
  ['name-en', '영문 이름'], ['email', '이메일'], ['nationality', '국적'], ['emergency', '비상 연락처'],
  ['language-certs', '어학'], ['certs', '자격증'], ['awards', '수상'],
  ['career', '경력'], ['experiences', '경험'],
  ['documents', '지원 서류'], ['disability', '장애 정보'],
]

/** 앞에서부터 `doneCount` 개를 채운 기본 세트 */
function coreSet(doneCount: number, over: Partial<CoreSet> = {}): CoreSet {
  const items = CORE.map(([id, label], i) => ({
    id,
    label,
    done: i < doneCount,
    sectionId: 'profile' as SectionId,
  }))
  const optional = OPTIONAL.map(([id, label]) => ({
    id,
    label,
    done: false,
    sectionId: 'profile' as SectionId,
  }))
  return {
    items,
    done: doneCount,
    total: 7,
    percent: Math.round((doneCount / 7) * 100),
    firstEmptyId: doneCount < 7 ? 'profile' : null,
    optional,
    optionalDone: 0,
    optionalTotal: 11,
    ...over,
  }
}

function mount(set: CoreSet, onJump?: (id: SectionId, opts?: JumpOptions) => void) {
  mockedUse.mockReturnValue({ isLoading: false, coreSet: set, sections: [] })
  return render(<MyinfoProgressGauge onJump={onJump} />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('로딩', () => {
  it('isLoading → 스켈레톤, 게이지 없음', () => {
    mockedUse.mockReturnValue({ isLoading: true, coreSet: coreSet(0), sections: [] })
    const { container } = render(<MyinfoProgressGauge />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})

describe('기본 세트 N/7', () => {
  it('제목에 N/7 이 그대로 나온다', () => {
    mount(coreSet(5))
    const title = screen.getByText(/지원서 기본 세트/)
    expect(title.textContent?.replace(/\s/g, '')).toBe('지원서기본세트5/7')
    expect(screen.getByText('71')).toBeInTheDocument()  // 원 안 퍼센트
  })

  it('미완료 항목만 칩으로 나열된다', () => {
    mount(coreSet(5))
    expect(screen.getByRole('button', { name: '병역' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '보훈 여부' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이름' })).toBeNull()
  })

  it('칩을 누르면 그 항목의 섹션으로 이동한다 — 지시도 같이 간다', () => {
    const onJump = vi.fn()
    const set = coreSet(6)
    set.items[6] = { ...set.items[6], sectionId: 'extras', jump: { focus: 'patriot' } }
    mount(set, onJump)
    fireEvent.click(screen.getByRole('button', { name: '보훈 여부' }))
    expect(onJump).toHaveBeenCalledWith('extras', { focus: 'patriot' })
  })

  it('🔴 「편집 열기 + 칸 포커스」 지시가 onJump 로 그대로 간다', () => {
    const onJump = vi.fn()
    const set = coreSet(0)
    set.items[0] = { ...set.items[0], jump: { edit: true, focus: 'name' } }
    mount(set, onJump)
    fireEvent.click(screen.getByRole('button', { name: '이름' }))
    expect(onJump).toHaveBeenCalledWith('profile', { edit: true, focus: 'name' })
  })

  it('🔴 힌트가 있으면 칩 글자가 힌트로 바뀐다 (성별 미저장 병역)', () => {
    const set = coreSet(5)
    set.items[5] = { ...set.items[5], hint: '성별을 고르면 병역 칸은 알아서 처리해요' }
    mount(set)
    expect(screen.getByRole('button', { name: '성별을 고르면 병역 칸은 알아서 처리해요' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '병역' })).toBeNull()
  })

  it('🔴 7/7 → 완성 문구 · 칩 없음', () => {
    mount(coreSet(7))
    expect(screen.getByText('기본 세트 완성. 이제 지원서마다 다시 적을 일이 없어요')).toBeInTheDocument()
    for (const label of CORE_LABELS) {
      expect(screen.queryByRole('button', { name: label }), label).toBeNull()
    }
  })

  it('단계 색 — 0 빨강 · 43 주황 · 71 인디고 · 100 초록', () => {
    const color = (doneCount: number) => {
      cleanup()
      mount(coreSet(doneCount))
      return screen.getByRole('progressbar').getAttribute('class') ?? ''
    }
    expect(color(0)).toContain('text-danger')
    expect(color(3)).toContain('text-warning')
    expect(color(5)).toContain('text-brand')
    expect(color(7)).toContain('text-success')
  })

  it('ARIA progressbar 속성', () => {
    mount(coreSet(5))
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('71')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(bar.getAttribute('aria-label')).toBe('지원서 기본 세트 5/7')
  })

  it('「지금 쓰이는 곳」 — 지금 동작하는 것만 적는다', () => {
    mount(coreSet(5))
    const note = screen.getByText('지금 쓰이는 곳: 자소서 AI 초안 · 면접 준비 · 복사 버튼')
    expect(note.className).toContain('text-xs')
    expect(note.className).toContain('text-text-tertiary')
  })
})

describe('「있으면 자동으로 채워져요」', () => {
  it('기본은 접혀 있고 (N/11) 만 보인다', () => {
    mount(coreSet(7))
    const toggle = screen.getByRole('button', { expanded: false })
    expect(toggle.textContent?.replace(/\s+/g, ' ')).toContain('있으면 자동으로 채워져요 (0/11)')
    expect(screen.queryByRole('button', { name: /영문 이름/ })).toBeNull()
  })

  it('펼치면 11개가 나오고 완료는 ✓ · 미완료는 ○ (경력·경험이 각각 한 줄)', () => {
    const set = coreSet(7)
    set.optional = set.optional.map((o, i) => ({ ...o, done: i < 2 }))
    set.optionalDone = 2
    mount(set)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(11)
    expect(within(list).getAllByLabelText('채움')).toHaveLength(2)
    expect(within(list).getAllByLabelText('비어 있음')).toHaveLength(9)
    expect(within(list).getByRole('button', { name: /경력/ })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /경험/ })).toBeInTheDocument()
  })

  it('🔴 동의가 없는 장애 정보는 「선택」 으로 표시된다', () => {
    const set = coreSet(7)
    set.optional = set.optional.map((o) => o.label === '장애 정보' ? { ...o, consentRequired: true } : o)
    mount(set)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByRole('button', { name: /장애 정보/ }).textContent).toContain('선택')
  })

  it('접이식 항목도 눌러서 이동한다', () => {
    const onJump = vi.fn()
    const set = coreSet(7)
    set.optional = set.optional.map((o) => o.label === '어학' ? { ...o, sectionId: 'language-certs' } : o)
    mount(set, onJump)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    fireEvent.click(screen.getByRole('button', { name: /어학/ }))
    expect(onJump).toHaveBeenCalledWith('language-certs', undefined)
  })

  it('접이식 항목의 지시(영문 이름 → 편집 + 그 칸)도 그대로 간다', () => {
    const onJump = vi.fn()
    const set = coreSet(7)
    set.optional = set.optional.map((o) =>
      o.id === 'name-en' ? { ...o, jump: { edit: true, focus: 'name_en_last' } } : o,
    )
    mount(set, onJump)
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    fireEvent.click(screen.getByRole('button', { name: /영문 이름/ }))
    expect(onJump).toHaveBeenCalledWith('profile', { edit: true, focus: 'name_en_last' })
  })
})

describe('상태를 글자로', () => {
  it('🔴 ✓/○ 는 role=img + 이름 — 글자 모양만으로는 안 읽힌다', () => {
    const set = coreSet(7)
    set.optional = set.optional.map((o, i) => ({ ...o, done: i === 0 }))
    mount(set)
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getAllByRole('img', { name: '채움' })).toHaveLength(1)
    expect(screen.getAllByRole('img', { name: '비어 있음' })).toHaveLength(10)
  })

  it('🔴 칩에 title 이 없다 — 보이는 글자와 툴팁이 같은 말을 두 번 하던 자리', () => {
    const set = coreSet(0)
    set.items = set.items.map((i) => ({ ...i, hint: `${i.label}을 채워 주세요` }))
    mount(set)
    for (const item of set.items) {
      expect(screen.getByRole('button', { name: `${item.label}을 채워 주세요` }))
        .not.toHaveAttribute('title')
    }
  })

  it('「N/7」 은 aria-live="polite" — 칸을 채우면 오르는 숫자가 들려야 한다', () => {
    const { container } = mount(coreSet(5))
    const line = container.querySelector('p[aria-live="polite"]')
    expect(line?.textContent?.replace(/\s+/g, ' ')).toContain('지원서 기본 세트 5/7')
  })

  it('🔴 접혀 있어도 aria-controls 대상이 DOM 에 있다', () => {
    mount(coreSet(7))
    const toggle = screen.getByRole('button', { expanded: false })
    const listId = toggle.getAttribute('aria-controls')!
    const list = document.getElementById(listId)
    expect(list).not.toBeNull()
    // 있되 **보이지는 않는다** — 그래서 접힌 상태의 항목은 role 로 잡히지 않는다
    expect(list).toHaveAttribute('hidden')
    expect(screen.queryByRole('button', { name: /영문 이름/ })).toBeNull()
    /*
      🔴 `hidden` 속성만 믿으면 안 된다 — UA 의 `[hidden]{display:none}` 은 작성자 스타일의
      `.flex{display:flex}` 에 진다. 실제로 숨기는 건 클래스 쪽이라 둘 다 확인한다.
    */
    expect(list?.className).toContain('hidden')
    expect(list?.className).not.toContain('flex ')
  })

  it('펼치면 flex 로 돌아온다 (숨김 클래스가 남지 않는다)', () => {
    mount(coreSet(7))
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    const list = document.getElementById('myinfo-optional-list')
    expect(list).not.toHaveAttribute('hidden')
    expect(list?.className).toContain('flex')
  })

  it('칩·접이식 항목에 touch-manipulation (300ms 탭 지연 제거)', () => {
    mount(coreSet(0))
    for (const b of screen.getAllByRole('button')) {
      expect(b.className, b.textContent ?? '').toContain('touch-manipulation')
    }
  })
})
