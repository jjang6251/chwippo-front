/**
 * 공부 노트 문서 화면 spec (plan §5 「읽기모드 왕복」·「UI」 축).
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *   로딩  1  🔴 로딩 중에는 스켈레톤 (「찾을 수 없어요」가 번쩍이면 안 된다)
 *         2  404 → 「노트를 찾을 수 없어요」 + 돌아가는 길
 *   렌더  3  제목 · 브레드크럼(폴더명 → 그 폴더로 돌아가는 링크) · 본문
 *         4  글자수 카운터가 서버 상한(100,000)을 그대로 말한다
 *   모드  5  읽기 전환 = 제목이 입력칸에서 글로 · 본문은 그대로 (왕복 보존)
 *         6  🔴 마지막 모드를 기기 단위로 기억한다 (localStorage 가 read 면 읽기로 진입)
 *         7  모드 전환이 localStorage 에 남는다
 *   토글  8  「모두 접기/펼치기」는 **읽기 모드에서만** 뜬다
 *         9  누르면 토글이 전부 접히고 라벨이 「모두 펼치기」로 바뀐다
 *   TOC  10  h2·h3 가 목차에 뜬다
 *   백링크 11 공부·준비 두 출처가 각자 뱃지·링크를 갖는다 (준비는 스텝 앵커 딥링크)
 *         12  백링크 0 이면 패널 자체가 없다
 *   저장  13  제목을 고치면 debounce 뒤 PATCH (title 만)
 *        13b 🔴 그 저장이 허브 캐시의 백링크 수를 지우지 않는다 (단건 응답엔 집계가 없다)
 *   정리  14  🔴 제목·본문이 **둘 다 빈 채로** 떠나면 지운다 (오터치 쓰레기 방지)
 *         15  내용이 있으면 떠나도 안 지운다
 *         16  🔴 StrictMode 재마운트는 그 삭제를 **취소**한다
 *   삭제  17  ⋯ → 삭제 = ConfirmModal(영구 삭제 명시) → DELETE + 허브로 이동
 *   멘션 18  살아 있는 노트 칩 = 라벨 렌더 + 클릭 시 SPA 이동 (`onNavigate` 배선)
 *        19  🔴 목록에 없는 id = 「삭제된 노트」 칩 (`isDeadNote` 배선)
 *        20  🔴 목록을 **못 받은 동안**에는 죽은 것으로 보지 않는다 (전부 끊긴 것처럼 보이면 안 된다)
 *   모달 21  「취소」·ESC 는 아무 것도 지우지 않는다
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StrictMode, type ReactNode } from 'react'
import * as api from '@/api/studyNotes'
import { studyNotesKey } from '@/hooks/useStudyNotes'
import { StudyNoteDocPage } from './StudyNoteDocPage'

vi.mock('@/api/studyNotes', () => ({
  getStudyNotes: vi.fn(),
  getStudyNoteFolders: vi.fn(),
  getPrepHubGroups: vi.fn(),
  getStudyNote: vi.fn(),
  createStudyNote: vi.fn(),
  updateStudyNote: vi.fn(),
  deleteStudyNote: vi.fn(),
  getStudyNoteBacklinks: vi.fn(),
  createStudyNoteFolder: vi.fn(),
  renameStudyNoteFolder: vi.fn(),
  deleteStudyNoteFolder: vi.fn(),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigateMock,
}))

const mocked = vi.mocked(api)

const FOLDER: api.StudyNoteFolder = {
  id: 'f-cs',
  name: 'CS 기초',
  parentId: null,
  sortOrder: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

/** h2 두 개 + 토글 하나(열림) — 목차·일괄 접기를 한 문서에서 같이 본다 */
const DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '프로세스와 스레드' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '스레드는 스택만 따로 가진다.' }] },
    {
      type: 'details',
      attrs: { open: true },
      content: [
        { type: 'detailsSummary', content: [{ type: 'text', text: 'Q. 차이는?' }] },
        {
          type: 'detailsContent',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '주소 공간' }] }],
        },
      ],
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'CPU 스케줄링' }] },
  ],
}

const NOTE: api.StudyNote = {
  id: 'n1',
  title: '운영체제 정리',
  folderId: 'f-cs',
  content: JSON.stringify(DOC),
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-18T02:00:00.000Z',
}

/** 캐시를 직접 들여다보는 케이스가 있어 렌더마다 만든 클라이언트를 붙잡아 둔다 */
let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/study-notes/n1']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function page() {
  return (
    <Routes>
      <Route path="/study-notes/:id" element={<StudyNoteDocPage />} />
    </Routes>
  )
}

function renderDoc() {
  return render(page(), { wrapper })
}

/** 본문이 붙을 때까지 기다린다 — tiptap 마운트는 한 틱 뒤다 */
async function renderLoaded() {
  const utils = renderDoc()
  await screen.findByText('스레드는 스택만 따로 가진다.')
  return utils
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocked.getStudyNote.mockResolvedValue(NOTE)
  mocked.getStudyNotes.mockResolvedValue([
    { id: 'n1', title: '운영체제 정리', folderId: 'f-cs', updatedAt: NOTE.updatedAt },
  ])
  mocked.getStudyNoteFolders.mockResolvedValue([FOLDER])
  mocked.getStudyNoteBacklinks.mockResolvedValue([])
  mocked.updateStudyNote.mockResolvedValue(NOTE)
  mocked.deleteStudyNote.mockResolvedValue(undefined as never)
})

describe('문서 — 로딩·렌더', () => {
  it('1 🔴 로딩 중에는 스켈레톤 (「찾을 수 없어요」 미노출)', () => {
    mocked.getStudyNote.mockReturnValue(new Promise(() => {}))
    const { container } = renderDoc()
    expect(screen.queryByText('노트를 찾을 수 없어요.')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('2 404 → 안내 + 돌아가는 길', async () => {
    mocked.getStudyNote.mockRejectedValue(new Error('404'))
    renderDoc()
    expect(await screen.findByText('노트를 찾을 수 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '공부 노트로 돌아가기' })).toHaveAttribute(
      'href',
      '/study-notes',
    )
  })

  it('3 제목 · 브레드크럼 · 본문', async () => {
    await renderLoaded()
    expect(screen.getByLabelText('노트 제목')).toHaveValue('운영체제 정리')
    expect(screen.getByRole('link', { name: '공부 노트' })).toHaveAttribute('href', '/study-notes')
    // 폴더명 클릭 = 허브의 **그 폴더로** 돌아간다
    expect(screen.getByRole('link', { name: /CS 기초/ })).toHaveAttribute(
      'href',
      '/study-notes?folder=f-cs',
    )
  })

  it('4 글자수 카운터가 서버 상한을 천 단위로 끊어 말한다', async () => {
    await renderLoaded()
    expect(screen.getByText(/\/ 100,000/)).toBeInTheDocument()
  })
})

describe('문서 — 읽기 모드', () => {
  it('5 읽기 전환 = 제목이 글이 되고 본문은 그대로', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('tab', { name: '읽기' }))

    expect(screen.queryByLabelText('노트 제목')).toBeNull()
    expect(screen.getByRole('heading', { name: '운영체제 정리', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('스레드는 스택만 따로 가진다.')).toBeInTheDocument()

    // 다시 편집으로 돌아와도 내용이 그대로다 (왕복 보존)
    fireEvent.click(screen.getByRole('tab', { name: '편집' }))
    expect(screen.getByLabelText('노트 제목')).toHaveValue('운영체제 정리')
    expect(screen.getByText('스레드는 스택만 따로 가진다.')).toBeInTheDocument()
  })

  it('6 🔴 마지막 모드를 기억한다 — 저장값이 read 면 읽기로 진입', async () => {
    localStorage.setItem('study-notes:mode:v1', 'read')
    await renderLoaded()
    expect(screen.getByRole('tab', { name: '읽기' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByLabelText('노트 제목')).toBeNull()
  })

  it('7 모드 전환이 localStorage 에 남는다', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('tab', { name: '읽기' }))
    expect(localStorage.getItem('study-notes:mode:v1')).toBe('read')
    fireEvent.click(screen.getByRole('tab', { name: '편집' }))
    expect(localStorage.getItem('study-notes:mode:v1')).toBe('edit')
  })
})

describe('문서 — 토글 일괄 · 목차', () => {
  it('8 「모두 접기」는 읽기 모드에서만 뜬다', async () => {
    await renderLoaded()
    expect(screen.queryByRole('button', { name: /모두 접기|모두 펼치기/ })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: '읽기' }))
    expect(await screen.findByRole('button', { name: /모두 접기/ })).toBeInTheDocument()
  })

  it('9 누르면 전부 접히고 라벨이 뒤집힌다', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('tab', { name: '읽기' }))
    fireEvent.click(await screen.findByRole('button', { name: /모두 접기/ }))
    expect(await screen.findByRole('button', { name: /모두 펼치기/ })).toBeInTheDocument()
  })

  it('10 목차에 h2 가 뜬다', async () => {
    await renderLoaded()
    const toc = await screen.findByRole('navigation', { name: '목차' })
    expect(within(toc).getByRole('button', { name: '프로세스와 스레드' })).toBeInTheDocument()
    expect(within(toc).getByRole('button', { name: 'CPU 스케줄링' })).toBeInTheDocument()
  })
})

describe('문서 — 백링크', () => {
  it('11 공부·준비 두 출처가 각자 뱃지·링크를 갖는다', async () => {
    mocked.getStudyNoteBacklinks.mockResolvedValue([
      {
        fromType: 'prep_sheet',
        fromId: 'sheet-1',
        label: '삼성전자 — 1차 면접',
        applicationId: 'app-1',
        stepId: 'step-1',
      },
      {
        fromType: 'study',
        fromId: 'n9',
        label: '면접 기출 모음',
        applicationId: null,
        stepId: null,
      },
    ])
    await renderLoaded()
    expect(await screen.findByText(/이 노트를 참조한 노트/)).toBeInTheDocument()

    const prep = screen.getByRole('link', { name: /삼성전자 — 1차 면접/ })
    expect(prep).toHaveAttribute('href', '/board/app-1/steps/step-1#prep-notes')
    expect(within(prep).getByText('준비 노트')).toBeInTheDocument()

    const study = screen.getByRole('link', { name: /면접 기출 모음/ })
    expect(study).toHaveAttribute('href', '/study-notes/n9')
    expect(within(study).getByText('공부 노트')).toBeInTheDocument()
  })

  it('12 백링크 0 이면 패널이 없다', async () => {
    await renderLoaded()
    expect(screen.queryByText(/이 노트를 참조한 노트/)).toBeNull()
  })
})

describe('문서 — 저장·정리', () => {
  it('13 제목을 고치면 debounce 뒤 title 만 PATCH', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByLabelText('노트 제목'), { target: { value: 'OS 총정리' } })

    await waitFor(
      () => expect(mocked.updateStudyNote).toHaveBeenCalledWith('n1', { title: 'OS 총정리' }),
      { timeout: 3000 },
    )
  })

  /**
   * 🔴 **자동 저장이 허브의 백링크 수를 지우면 안 된다.** 단건 PATCH 응답에는 집계가
   * 없어서(목록 전용), 그대로 캐시에 써 넣으면 저장 한 번에 「🔗 2」가 조용히 사라진다.
   * 사용자 눈엔 링크가 끊긴 것처럼 보이는데 실제로는 아무 일도 없었다.
   */
  it('13b 제목 저장이 허브 캐시의 백링크 수를 지우지 않는다', async () => {
    await renderLoaded()
    queryClient.setQueryData(studyNotesKey.list, [
      {
        id: 'n1',
        title: '운영체제 정리',
        folderId: 'f-cs',
        updatedAt: NOTE.updatedAt,
        backlinkCount: 2,
      },
    ])
    // 서버 응답(NOTE)에는 backlinkCount 가 **없다** — 방어가 없으면 여기서 날아간다
    fireEvent.change(screen.getByLabelText('노트 제목'), { target: { value: 'OS 총정리' } })

    await waitFor(() => expect(mocked.updateStudyNote).toHaveBeenCalled(), { timeout: 3000 })
    await waitFor(() => {
      const list = queryClient.getQueryData<api.StudyNoteListItem[]>(studyNotesKey.list)
      expect(list?.[0].title).toBe('운영체제 정리')
      expect(list?.[0].backlinkCount).toBe(2)
    })
  })

  it('14 🔴 제목·본문이 둘 다 빈 채로 떠나면 지운다', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, title: '', content: null })
    const { unmount } = renderDoc()
    await screen.findByLabelText('노트 제목')
    unmount()

    await waitFor(() => expect(mocked.deleteStudyNote).toHaveBeenCalledWith('n1'), {
      timeout: 3000,
    })
  })

  it('15 내용이 있으면 떠나도 안 지운다', async () => {
    const { unmount } = await renderLoaded()
    unmount()
    await new Promise((r) => setTimeout(r, 600))
    expect(mocked.deleteStudyNote).not.toHaveBeenCalled()
  })

  it('16 🔴 StrictMode 재마운트는 빈 노트 삭제를 취소한다', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, title: '', content: null })
    render(<StrictMode>{page()}</StrictMode>, { wrapper })
    await screen.findByLabelText('노트 제목')
    // StrictMode 는 마운트 직후 한 번 떼었다 다시 붙인다 — 그 사이 예약된 삭제가 실행되면 안 된다
    await new Promise((r) => setTimeout(r, 600))
    expect(mocked.deleteStudyNote).not.toHaveBeenCalled()
  })

  it('17 ⋯ → 삭제 = 영구 삭제 명시 후 DELETE + 허브로', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '노트 메뉴' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '노트 삭제' }))

    const dialog = screen.getByRole('dialog', { name: '노트 삭제' })
    expect(within(dialog).getByText(/되돌릴 수 없어요/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mocked.deleteStudyNote).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/study-notes'))
  })
})

/**
 * 🔴 Phase 2a 의 멘션 **부품**은 이미 자기 spec 이 있다 (트리거·키보드·삽입 JSON).
 * 여기서 잠그는 건 **Phase 2b 의 배선** — 어떤 목록이 소스가 되고, 죽은 링크 판정을
 * 누가 하고, 칩을 눌렀을 때 SPA 로 도는지. 그 셋이 이 화면에서만 연결된다.
 */
describe('문서 — 멘션 배선', () => {
  /** 본문 안에 멘션 칩 두 개 — 하나는 살아 있는 노트, 하나는 지워진 노트 */
  const withMentions = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'studyNoteMention', attrs: { noteId: 'n9', label: '네트워크 정리' } },
          { type: 'text', text: ' 와 ' },
          { type: 'studyNoteMention', attrs: { noteId: 'gone', label: '지워진 노트' } },
        ],
      },
    ],
  })

  it('18 살아 있는 칩 = 라벨 + 클릭 시 SPA 이동', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, content: withMentions })
    mocked.getStudyNotes.mockResolvedValue([
      { id: 'n1', title: '운영체제 정리', folderId: 'f-cs', updatedAt: NOTE.updatedAt },
      { id: 'n9', title: '네트워크 정리', folderId: null, updatedAt: NOTE.updatedAt },
    ])
    renderDoc()

    const chip = await screen.findByTestId('study-note-mention')
    expect(chip).toHaveTextContent('네트워크 정리')
    fireEvent.click(chip)
    expect(navigateMock).toHaveBeenCalledWith('/study-notes/n9')
  })

  it('19 🔴 목록에 없는 id = 「삭제된 노트」 칩', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, content: withMentions })
    mocked.getStudyNotes.mockResolvedValue([
      { id: 'n1', title: '운영체제 정리', folderId: 'f-cs', updatedAt: NOTE.updatedAt },
      { id: 'n9', title: '네트워크 정리', folderId: null, updatedAt: NOTE.updatedAt },
    ])
    renderDoc()

    expect(await screen.findByTestId('study-note-mention-dead')).toHaveTextContent('삭제된 노트')
  })

  it('20 🔴 목록을 못 받은 동안에는 죽은 것으로 보지 않는다', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, content: withMentions })
    // 목록 응답이 영영 안 온다 — 그렇다고 칩이 전부 끊긴 것처럼 보이면 안 된다
    mocked.getStudyNotes.mockReturnValue(new Promise(() => {}))
    renderDoc()

    // 판정을 못 하는 동안엔 **둘 다** 살아 있는 것으로 그린다
    expect(await screen.findAllByTestId('study-note-mention')).toHaveLength(2)
    expect(screen.queryByTestId('study-note-mention-dead')).toBeNull()
  })
})

describe('문서 — 삭제 확인 모달', () => {
  it('21 「취소」·ESC 는 아무 것도 지우지 않는다', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '노트 메뉴' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '노트 삭제' }))

    const dialog = screen.getByRole('dialog', { name: '노트 삭제' })
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog', { name: '노트 삭제' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '노트 메뉴' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '노트 삭제' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '노트 삭제' })).toBeNull()

    expect(mocked.deleteStudyNote).not.toHaveBeenCalled()
  })
})

/**
 * 빈 문서 템플릿 제안 (2026-08-18 확장 · plan §3 템플릿 7종).
 *
 * 🔴 진입점 문제의 해법이다 — 템플릿이 허브 빈 상태에만 있으면 노트가 하나라도
 * 생긴 뒤엔 닿을 길이 없다. 갓 만든 빈 노트(content=null — 백엔드 TEXT NULL)에
 * 칩 7개를 띄우고, 템플릿을 고르면 본문 적용 + 빈 제목 채움 + 즉시 저장까지 간다.
 * 타이핑 소멸은 jsdom 이 PM 입력을 못 흉내내므로 Playwright(study-notes-doc)가 맡는다.
 */
describe('문서 — 빈 문서 템플릿 제안', () => {
  it('22 갓 만든 빈 노트(content=null)에 칩 7개가 뜬다', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, title: '', content: null })
    renderDoc()
    const chips = await screen.findByTestId('template-chips')
    expect(within(chips).getAllByRole('button')).toHaveLength(7)
    expect(within(chips).getByRole('button', { name: /인성 면접 답변 스크립트/ })).toBeInTheDocument()
  })

  it('23 내용 있는 노트에는 처음부터 안 뜬다', async () => {
    await renderLoaded()
    expect(screen.queryByTestId('template-chips')).toBeNull()
  })

  it('24 🔴 칩 클릭 = 본문 적용 + 빈 제목 채움 + 즉시 저장 + 칩 소멸', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, title: '', content: null })
    renderDoc()
    const chips = await screen.findByTestId('template-chips')
    fireEvent.click(within(chips).getByRole('button', { name: /주간 공부 계획/ }))

    // 본문에 템플릿 내용이 실제로 들어갔다 (에디터 렌더 실측)
    await screen.findByText(/예상\/실제를 같이 적는 게 핵심이다/)
    // 본문은 즉시 저장, 제목은 기존 debounce 경로 — 두 PATCH 가 순서 무관하게 다 간다
    await waitFor(
      () => {
        const patches = mocked.updateStudyNote.mock.calls.map(
          (c) => c[1] as { content?: string; title?: string },
        )
        expect(patches.some((p) => typeof p.content === 'string')).toBe(true)
        expect(patches.some((p) => p.title === '주간 공부 계획')).toBe(true)
      },
      { timeout: 3000 },
    )
    const contentPatch = mocked.updateStudyNote.mock.calls
      .map((c) => c[1] as { content?: string })
      .find((p) => typeof p.content === 'string')
    expect(() => JSON.parse(contentPatch?.content ?? '')).not.toThrow()
    // 칩은 사라진다
    expect(screen.queryByTestId('template-chips')).toBeNull()
  })

  it('25 제목이 이미 있으면 제목은 안 덮는다', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, title: '내가 정한 제목', content: null })
    renderDoc()
    const chips = await screen.findByTestId('template-chips')
    fireEvent.click(within(chips).getByRole('button', { name: /CS 정리/ }))

    await waitFor(() => expect(mocked.updateStudyNote).toHaveBeenCalled())
    const patch = mocked.updateStudyNote.mock.calls.at(-1)?.[1] as Record<string, unknown>
    expect(patch).not.toHaveProperty('title')
    expect(screen.getByLabelText('노트 제목')).toHaveValue('내가 정한 제목')
  })
})
