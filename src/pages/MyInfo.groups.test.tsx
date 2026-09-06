/**
 * 내 정보 창고 — **두 묶음** (지원서 정보 / 준비 도구).
 *
 * 왜 여기를 spec 으로 묶나: 「지원서에 옮겨 적는 정보」와 「취업 준비 도구」가 한 줄로
 * 섞여 있어 사용자가 「확장을 쓰려면 이걸 다 채워야 하나」로 읽었다. 순서·헤더가 그 답인데,
 * 순서는 배열 하나를 고치면 조용히 뒤집힌다 — 그래서 순서 자체를 못 박는다.
 *
 * 케이스 목록 (먼저 나열하고 짠다)
 *  0. 상단 한 줄 — 「무엇을 하는 곳」과 「어떻게 저장되나」를 한 문장으로
 *  1. 그룹 헤더 2개 + 각 한 줄 설명 (확장 문장은 뺐다 — 아직 없는 것을 설명하지 않는다)
 *  2. 🔴 섹션 순서 — 지원서 정보 10 → 준비 도구 3 (경력·경험이 나란히)
 *  3. 「파일 보관함」이 아니라 「지원 서류」
 *  4. 🔴 딥링크 유지 — 13개 섹션 id 가 전부 DOM 에 살아 있다
 *  ── 「논문」은 석·박사에게만 (대장 44 후속)
 *  4-a. 🔴 학사면 섹션도 칩도 사이드바 항목도 없다
 *  4-b. 🔴 석사면 학력 **바로 다음**에 섹션이 생기고 칩·사이드바도 같이 는다
 *  4-c. 박사도 같다
 *  4-d. 🔴 사전이 4키를 안 주면(옛 배포·장애) 칩만 남지 않는다 — 둘 다 없다
 *  ── 제목 뼈대 (스크린리더가 제목 목록으로 훑을 수 있나)
 *  5. 🔴 제목이 버튼을 감싼다 — `h3 > button` (버튼 안 `h2` 는 heading 이 사라진다)
 *  6. 단계 — 페이지 h1 · 그룹 h2 · 섹션 h3 13개
 *  7. 접힘 토글 — `aria-expanded` 가 바뀌고, 펼쳤을 때만 `aria-controls` 대상이 있다
 *  ── 섹션 점프 칩
 *  8. 🔴 전부 `type="button"`
 *  9. 🔴 지금 보는 섹션만 `aria-current`
 * 10. 모바일 터치 타겟 44px
 * 11. 🔴 데스크탑 사이드바 네비도 같다 — 칩의 짝인데 한쪽만 말하면 폭에 따라 답이 달라진다
 */
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FieldDictionary, HighestDegree, UserProfile } from '@/api/myinfo'
import { MyInfo } from './MyInfo'

const h = vi.hoisted(() => ({
  emptyQuery: <T,>(data: T) => () => ({ data, isLoading: false, isError: false }),
  /** 논문 섹션의 두 조건(최종 학력 · 사전)을 케이스마다 갈아 끼운다 */
  profile: undefined as UserProfile | undefined,
  dictionary: undefined as FieldDictionary | undefined,
  dictError: true,
}))

vi.mock('@/hooks/useMyinfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMyinfo')>()),
  useProfile: () => ({ data: h.profile, isLoading: false, isError: false }),
  useEducations: h.emptyQuery([]),
  useLangCerts: h.emptyQuery([]),
  useCerts: h.emptyQuery([]),
  useAwards: h.emptyQuery([]),
  useCoverletter: h.emptyQuery(undefined),
  useDocuments: h.emptyQuery([]),
  useFieldDictionary: () => ({ data: h.dictionary, isError: h.dictError }),
}))
vi.mock('@/hooks/useExamSchedules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useExamSchedules')>()),
  useExamSchedules: h.emptyQuery([]),
}))
vi.mock('@/hooks/useActivities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useActivities')>()),
  useActivities: h.emptyQuery([]),
}))
vi.mock('@/hooks/useStorageUsage', () => ({
  useStorageUsage: () => ({ data: undefined, isLoading: false }),
}))

/** 지원서 정보 10 → 준비 도구 3 (SECTIONS 배열 순서와 같아야 한다) */
const APPLICATION_SECTIONS = [
  'profile', 'education', 'military', 'extras', 'career', 'experiences',
  'language-certs', 'certs', 'awards', 'files',
]
const TOOL_SECTIONS = ['coverletter', 'goals', 'exam-schedules']

const APPLICATION_LABELS = [
  '기본 인적사항', '학력', '병역사항', '우대·기타', '경력', '경험',
  '어학 자격증', '자격증', '수상 내역', '지원 서류',
]
const TOOL_LABELS = ['자소서 소재', '스펙 목표', '시험 일정']

/**
 * 섹션 제목 — 제목은 `h3` 다 (그룹 헤더 「지원서 정보」·「준비 도구」가 `h2`).
 * `h3` 는 헤더 버튼 전체를 감싸므로 `textContent` 에는 아이콘·「저장됨」까지 섞인다 —
 * 왼쪽 묶음의 마지막 span 이 제목 글자다.
 */
const titleOf = (h3: Element) =>
  h3.querySelector(':scope > button > div:first-of-type > span:last-of-type')?.textContent

function draw() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MyInfo />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  h.profile = undefined
  h.dictionary = undefined
  h.dictError = true
  localStorage.clear()
  // jsdom 에는 스크롤이 없다 — 칩 바 자동 정렬(`scrollIntoView`)이 마운트 직후 부른다
  Element.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn()
})
afterEach(cleanup)

describe('두 묶음', () => {
  it('상단 한 줄 — 무엇을 하는 곳 · 어떻게 저장되나', () => {
    draw()
    expect(
      screen.getByText('지원서·자소서에 쓰는 정보를 한 번만 적어 두는 곳이에요. 칸을 벗어나면 저장돼요.'),
    ).toBeInTheDocument()
  })

  it('그룹 헤더 2개 + 각 한 줄 설명 (확장 문장 없음)', () => {
    draw()
    expect(screen.getAllByText('지원서 정보').length).toBeGreaterThan(0)
    expect(screen.getAllByText('준비 도구').length).toBeGreaterThan(0)
    expect(screen.getByText('채용 폼에 옮겨 적는 정보예요')).toBeInTheDocument()
    expect(screen.queryByText(/확장이 이걸로 칸을 채워요/)).toBeNull()
    expect(screen.getByText('지원서와 별개로 취업 준비를 돕는 것')).toBeInTheDocument()
  })

  it('🔴 섹션 순서 — 지원서 정보 10 → 준비 도구 3', () => {
    const { container } = draw()
    const ids = [...container.querySelectorAll('section[id]')].map((el) => el.id)
    expect(ids).toEqual([...APPLICATION_SECTIONS, ...TOOL_SECTIONS])
  })

  it('섹션 제목도 같은 순서로 나온다', () => {
    const { container } = draw()
    const titles = [...container.querySelectorAll('section[id] h3')].map(titleOf)
    expect(titles).toEqual([...APPLICATION_LABELS, ...TOOL_LABELS])
  })

  it('「파일 보관함」이 아니라 「지원 서류」', () => {
    const { container } = draw()
    expect(titleOf(container.querySelector('section#files h3')!)).toBe('지원 서류')
    expect(screen.queryByText('파일 보관함')).toBeNull()
  })

  it('🔴 딥링크 유지 — 13개 섹션 id 가 전부 살아 있다', () => {
    const { container } = draw()
    for (const id of [...APPLICATION_SECTIONS, ...TOOL_SECTIONS]) {
      expect(container.querySelector(`section#${CSS.escape(id)}`), id).not.toBeNull()
    }
  })
})

/**
 * 「논문」(지도교수 · 연구 분야 · 논문 제목 · 논문 요약)은 **석·박사 지원서에만** 있는 칸이다.
 *
 * 🔴 조건이 둘이고, **칩과 본문이 같은 조건을 봐야 한다** — 한쪽만 걸면 눌러도 아무 데도
 * 안 가는 칩이 남는다. 그래서 섹션·모바일 칩·데스크탑 사이드바를 한 케이스에서 같이 본다.
 */
describe('「논문」은 석·박사에게만', () => {
  const GRAD_DICT: FieldDictionary = {
    version: '2026-09.2',
    fields: [
      { key: 'academic_advisor', label: '지도교수', type: 'text', maxLength: 40, storage: 'extra' },
      { key: 'research_field', label: '연구 분야', type: 'text', maxLength: 100, storage: 'extra' },
      { key: 'paper_title', label: '논문 제목', type: 'text', maxLength: 200, storage: 'extra' },
      { key: 'paper_content', label: '논문 요약', type: 'text', maxLength: 1000, storage: 'extra' },
    ],
  }
  const setUp = (degree?: HighestDegree, dict: FieldDictionary | undefined = GRAD_DICT) => {
    h.profile = { user_id: 'u1', ...(degree ? { highest_degree: degree } : {}) }
    h.dictionary = dict
    h.dictError = false
  }
  const chipLabels = () =>
    within(screen.getByRole('navigation', { name: '섹션 바로가기' }))
      .getAllByRole('button').map((b) => b.textContent)
  const sidebarCount = (container: HTMLElement) =>
    container.querySelectorAll('aside nav button').length

  it.each<HighestDegree | undefined>([undefined, 'high', 'associate', 'bachelor'])(
    '4-a) 🔴 최종 학력이 %s 면 섹션도 칩도 사이드바 항목도 없다',
    (degree) => {
      setUp(degree)
      const { container } = draw()
      expect(container.querySelector('section#thesis')).toBeNull()
      expect(chipLabels().some((t) => t?.includes('논문'))).toBe(false)
      expect(sidebarCount(container)).toBe(13)
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(13)
    },
  )

  it.each<HighestDegree>(['master', 'doctor'])('4-b/c) 🔴 %s 면 학력 바로 다음에 온다', (degree) => {
    setUp(degree)
    const { container } = draw()
    const ids = [...container.querySelectorAll('section[id]')].map((el) => el.id)
    expect(ids.indexOf('thesis')).toBe(ids.indexOf('education') + 1)
    expect(ids.indexOf('thesis')).toBe(ids.indexOf('military') - 1)
    expect(chipLabels().some((t) => t?.includes('논문'))).toBe(true)
    expect(sidebarCount(container)).toBe(14)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14)
  })

  it('4-d) 🔴 사전이 4키를 안 주면 섹션도 칩도 없다 (칩만 남지 않는다)', () => {
    setUp('master', { version: 'v', fields: [{ key: 'name', label: '이름', type: 'text', storage: 'column' }] })
    const { container } = draw()
    expect(container.querySelector('section#thesis')).toBeNull()
    expect(chipLabels().some((t) => t?.includes('논문'))).toBe(false)
    expect(sidebarCount(container)).toBe(13)
  })

  it('4-e) 사전 호출이 실패해도 같다 (페이지는 살아 있다)', () => {
    h.profile = { user_id: 'u1', highest_degree: 'doctor' }
    h.dictionary = undefined
    h.dictError = true
    const { container } = draw()
    expect(container.querySelector('section#thesis')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: '내 정보 창고' })).toBeInTheDocument()
  })
})

/**
 * 🔴 `<button>` **안**의 `<h2>` 는 제목이 아니다 — 버튼 내용은 한 줄 이름으로 납작해져
 * heading 역할이 사라진다. 그래서 이 페이지에는 섹션 제목이 하나도 없었다(제목 목록으로
 * 훑는 스크린리더 사용자에게는 13개 섹션이 안 보인다).
 */
describe('제목 뼈대', () => {
  it('🔴 제목이 버튼을 감싼다 — h3 > button (그 반대가 아니다)', () => {
    const { container } = draw()
    const h3 = container.querySelector('section#profile h3')
    expect(h3).not.toBeNull()
    expect(h3?.firstElementChild?.tagName).toBe('BUTTON')
    expect(container.querySelector('section#profile button h2')).toBeNull()
  })

  it('단계 — 페이지 h1 · 그룹 h2 · 섹션 h3', () => {
    draw()
    expect(screen.getByRole('heading', { level: 1, name: '내 정보 창고' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent))
      .toEqual(['지원서 정보', '준비 도구'])
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(13)
  })

  it('접힘 토글 — aria-expanded 가 바뀌고, 펼쳤을 때만 aria-controls 대상이 있다', () => {
    const { container } = draw()
    const btn = container.querySelector<HTMLButtonElement>('section#profile h3 > button')!
    /** 펼침이면 aria-controls 대상이 DOM 에 있고, 접힘이면 aria-controls 자체가 없다 */
    const check = () => {
      const open = btn.getAttribute('aria-expanded') === 'true'
      const bodyId = btn.getAttribute('aria-controls')
      if (open) expect(document.getElementById(bodyId!)).not.toBeNull()
      // 없는 id 를 가리키느니 안 가리킨다
      else expect(bodyId).toBeNull()
      return open
    }
    const before = check()
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded') === 'true').toBe(!before)
    check()
  })
})

describe('섹션 점프 칩 (모바일)', () => {
  /** 칩 바는 `nav[aria-label="섹션 바로가기"]` 안에 있다 */
  const chips = () =>
    within(screen.getByRole('navigation', { name: '섹션 바로가기' })).getAllByRole('button')

  it('🔴 전부 type="button" — 폼 안이라면 제출로 새는 자리다', () => {
    draw()
    for (const b of chips()) expect(b).toHaveAttribute('type', 'button')
  })

  it('🔴 지금 보는 섹션만 aria-current — 색만으로는 안 들린다', () => {
    draw()
    // 활성 칩은 하나뿐이고, 색(brand)으로 표시된 그 칩과 같은 것이어야 한다
    const current = chips().filter((b) => b.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0].className).toContain('text-brand')
    for (const b of chips()) {
      if (b !== current[0]) expect(b).not.toHaveAttribute('aria-current')
    }
  })

  it('모바일 터치 타겟 44px', () => {
    draw()
    for (const b of chips()) expect(b.className).toContain('min-h-[44px]')
  })

  /**
   * 데스크탑 사이드바는 같은 목록의 **짝**이다 — 한쪽만 `aria-current` 를 말하면
   * 화면 폭에 따라 「지금 어디」의 답이 달라진다.
   */
  it('🔴 데스크탑 사이드바 네비도 같다 — type=button · 활성 하나만 aria-current', () => {
    const { container } = draw()
    const items = [...container.querySelectorAll<HTMLButtonElement>('aside nav button')]
    expect(items).toHaveLength(13)
    for (const b of items) expect(b).toHaveAttribute('type', 'button')

    const current = items.filter((b) => b.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    // 색(활성 표시)과 같은 항목을 가리킨다
    expect(current[0].className).toContain('border-brand')
    // 모바일 칩과 같은 섹션을 가리킨다 (폭이 달라도 답이 같아야 한다)
    const activeChip = chips().find((b) => b.getAttribute('aria-current') === 'true')!
    expect(current[0].textContent).toBe(activeChip.textContent)
  })
})
