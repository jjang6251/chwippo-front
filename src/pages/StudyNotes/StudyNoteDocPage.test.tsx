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
 *        13c 🔴 400 이면 **서버 문구를 그대로** 토스트 (SaveChip 라벨로 뭉개지 않는다)
 *        13d 🔴 같은 문구는 재시도해도 한 번만 (자동 저장이 1.5초마다 돈다)
 *        13e 서버가 말이 없는 실패(네트워크)는 토스트하지 않는다 (SaveChip 만)
 *   정리  14  🔴 제목·본문이 **둘 다 빈 채로** 떠나면 지운다 (오터치 쓰레기 방지)
 *        14b 🔴 이미지만 있고 제목이 빈 노트는 **안 지운다** (글자 0자 ≠ 빈 노트)
 *         15  내용이 있으면 떠나도 안 지운다
 *         16  🔴 StrictMode 재마운트는 그 삭제를 **취소**한다
 *   삭제  17  ⋯ → 삭제 = ConfirmModal(영구 삭제 명시) → DELETE + 허브로 이동
 *   멘션 18  살아 있는 노트 칩 = 라벨 렌더 + 클릭 시 SPA 이동 (`onNavigate` 배선)
 *        19  🔴 목록에 없는 id = 「삭제된 노트」 칩 (`isDeadNote` 배선)
 *        20  🔴 목록을 **못 받은 동안**에는 죽은 것으로 보지 않는다 (전부 끊긴 것처럼 보이면 안 된다)
 *   모달 21  「취소」·ESC 는 아무 것도 지우지 않는다
 *   인쇄 26~37 「PDF로 저장」 — 아래 describe 머리말에 따로 나열
 *   툴바 38~40 「내보내기」 형식 선택 — 아래 describe 머리말에 따로 나열
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StrictMode, type ReactNode } from 'react'
import * as api from '@/api/studyNotes'
import { uploadNoteImage } from '@/components/editor/noteImageUpload'
import { storageUsageKey } from '@/hooks/useStorageUsage'
import { studyNotesKey } from '@/hooks/useStudyNotes'
import { assertMenuKeyboardContract } from '@/test/menuKeyboardContract'
import { toast } from '@/stores/toastStore'
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

/** 업로드 파이프라인은 자기 spec 이 따로 있다 — 여기선 **호출부 배선**만 본다 */
vi.mock('@/components/editor/noteImageUpload', () => ({
  uploadNoteImage: vi.fn(),
  STUDY_NOTE_IMAGE_SCOPE: 'study-note/image',
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigateMock,
}))

const mocked = vi.mocked(api)
const mockedUpload = vi.mocked(uploadNoteImage)

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

  /**
   * 🔴 **서버가 이유를 말했으면 그대로 보여준다** (2026-09-02 실사고).
   * 글자수 상한 400 이 SaveChip 의 「저장 실패」 하나로 뭉개져, 사용자는 56,281자 노트가
   * 왜 저장되지 않는지 모른 채 계속 썼다. 한도를 정하는 쪽은 서버다 — 프론트가 자기
   * 문구로 덮으면 「무엇을 줄여야 하는지」가 사라진다.
   */
  it('13c 🔴 저장 400 → 서버 문구를 그대로 토스트', async () => {
    const errorToast = vi.spyOn(toast, 'error')
    mocked.updateStudyNote.mockRejectedValue({
      response: { data: { message: '노트는 100,000자까지 저장할 수 있어요.' } },
    })
    await renderLoaded()
    fireEvent.change(screen.getByLabelText('노트 제목'), { target: { value: 'OS 총정리' } })

    await waitFor(
      () => expect(errorToast).toHaveBeenCalledWith('노트는 100,000자까지 저장할 수 있어요.'),
      { timeout: 3000 },
    )
    errorToast.mockRestore()
  })

  /** 🔴 자동 저장은 1.5초마다 재시도한다 — dedupe 가 없으면 같은 토스트가 화면을 덮는다 */
  it('13d 🔴 같은 문구는 재시도해도 한 번만', async () => {
    const errorToast = vi.spyOn(toast, 'error')
    mocked.updateStudyNote.mockRejectedValue({
      response: { data: { message: ['노트는 100,000자까지 저장할 수 있어요.'] } },
    })
    await renderLoaded()
    const input = screen.getByLabelText('노트 제목')

    fireEvent.change(input, { target: { value: 'OS 총정리' } })
    await waitFor(() => expect(mocked.updateStudyNote).toHaveBeenCalledTimes(1), { timeout: 3000 })
    fireEvent.change(input, { target: { value: 'OS 총정리 2' } })
    await waitFor(() => expect(mocked.updateStudyNote).toHaveBeenCalledTimes(2), { timeout: 3000 })

    // 배열 message 도 첫 항목을 뽑아 쓴다 (Nest ValidationPipe 의 두 형태 모두)
    expect(errorToast).toHaveBeenCalledTimes(1)
    expect(errorToast).toHaveBeenCalledWith('노트는 100,000자까지 저장할 수 있어요.')
    errorToast.mockRestore()
  })

  it('13e 서버 문구가 없는 실패(네트워크)는 토스트하지 않는다', async () => {
    const errorToast = vi.spyOn(toast, 'error')
    mocked.updateStudyNote.mockRejectedValue(new Error('Network Error'))
    await renderLoaded()
    fireEvent.change(screen.getByLabelText('노트 제목'), { target: { value: 'OS 총정리' } })

    await waitFor(() => expect(mocked.updateStudyNote).toHaveBeenCalled(), { timeout: 3000 })
    expect(screen.getByText('저장 실패')).toBeInTheDocument()
    expect(errorToast).not.toHaveBeenCalled()
    errorToast.mockRestore()
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

  /*
    🔴 study-note-media PR-A — 「비었다」는 글자 수가 아니다.
    이미지만 올려 둔 노트는 제목·텍스트가 0자라, 판정이 글자만 보면 떠나는 순간 지워진다.
    (본문 판정은 `editor.isEmpty`, 저장 값은 `isEmptyDoc` — 둘 다 미디어 노드를 내용으로
     센다. 그 단위 계약은 noteImage.test·memoSections.test 가 잠근다.)
  */
  it('14b 🔴 제목이 비어도 이미지가 있으면 안 지운다', async () => {
    mocked.getStudyNote.mockResolvedValue({
      ...NOTE,
      title: '',
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'image', attrs: { src: 'https://cdn.example/x.png' } }],
      }),
    })
    const { unmount } = renderDoc()
    await screen.findByLabelText('노트 제목')
    unmount()

    await new Promise((r) => setTimeout(r, 600))
    expect(mocked.deleteStudyNote).not.toHaveBeenCalled()
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

/**
 * 저장 용량 갱신 (2026-08-21 — 노트 이미지가 내정보 증빙과 같은 100MB 통에 합류).
 *
 * 시나리오:
 *  22 🔴 업로드 성공 → storage-usage 캐시 무효화 (숫자가 즉시 따라온다)
 *  23 🔴 업로드 실패 → 무효화 없음 (쓴 바이트가 없는데 재조회하면 헛 호출이다)
 *  25 🔴 노트 삭제 → 서버가 안의 이미지도 지운다 → 역시 무효화
 *  24 무효화를 **기다리지 않는다** — 노드 확정이 재조회에 발목 잡히지 않는다
 */
describe('문서 — 저장 용량 갱신', () => {
  const pngFile = () => new File(['x'], 'diagram.png', { type: 'image/png' })

  async function pickImage() {
    fireEvent.change(screen.getByTestId('note-image-input'), {
      target: { files: [pngFile()] },
    })
  }

  it('22 🔴 업로드가 성공하면 storage-usage 를 무효화한다', async () => {
    mockedUpload.mockResolvedValue({ src: 'https://r2.example/n.png', attachmentId: 'att-1' })
    await renderLoaded()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    await pickImage()

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: storageUsageKey }),
    )
    expect(mockedUpload.mock.calls[0][0]).toBe('n1')
  })

  it('23 🔴 업로드가 실패하면 무효화하지 않는다', async () => {
    mockedUpload.mockRejectedValue(new Error('cap'))
    await renderLoaded()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    await pickImage()

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1))
    // 실패 경로가 다 돌 시간을 준 뒤에도 없다
    await waitFor(() =>
      expect(
        spy.mock.calls.filter(
          ([arg]) => JSON.stringify(arg) === JSON.stringify({ queryKey: storageUsageKey }),
        ),
      ).toHaveLength(0),
    )
  })

  it('25 🔴 노트를 지우면 그 안의 이미지도 사라진다 → 용량도 다시 받는다', async () => {
    await renderLoaded()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    fireEvent.click(screen.getByRole('button', { name: '노트 메뉴' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '노트 삭제' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '노트 삭제' })).getByRole('button', {
        name: '삭제',
      }),
    )

    await waitFor(() => expect(mocked.deleteStudyNote).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: storageUsageKey }))
  })

  it('24 🔴 무효화를 기다리지 않는다 — 재조회가 안 끝나도 이미지 노드가 먼저 확정된다', async () => {
    mockedUpload.mockResolvedValue({ src: 'https://r2.example/n.png', attachmentId: 'att-1' })
    await renderLoaded()
    // 영원히 안 끝나는 재조회 — await 로 물려 있으면 자리 표시가 영영 이미지가 안 된다
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(new Promise<void>(() => {}))

    await pickImage()

    await waitFor(() =>
      expect(document.querySelector('img[src="https://r2.example/n.png"]')).not.toBeNull(),
    )
  })
})

/**
 * 「PDF로 저장」 = 브라우저 인쇄 (study-note-media PR-B).
 *
 * 🔴 이 화면이 인쇄 동안 **빌려 쓰는 전역이 둘**이다 — `document.title`(브라우저가 PDF
 * 파일명으로 가져간다)과 `documentElement[data-theme]`(다크로 보던 사람에게 검은 종이가
 * 나오지 않게 라이트 강제). 빌린 걸 안 돌려주면 탭 제목과 앱 테마가 **영영** 바뀐 채로
 * 남는다. 그래서 「바뀌었나」보다 「돌아왔나」가 더 많다.
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *  26  읽기 모드에서 항목을 누르면 `window.print()` 가 **한 번** 불린다
 *  27  🔴 편집 모드에서 누르면 **읽기로 전환된 뒤** 인쇄한다 (제목이 입력칸인 채로 찍히면 안 된다)
 *  28  항목 자리 — 「마크다운으로 내보내기」 바로 **위**
 *  29  🔴 앱(WebView)에서는 항목 자체가 없다 (WKWebView 는 print 무동작 = 거짓 어포던스)
 *  30  제목이 노트 제목으로 바뀌고 `afterprint` 에 원래 탭 제목으로 돌아온다
 *  31  파일명 정제 — 금지문자는 `_` (마크다운과 같은 규칙) · 확장자는 안 붙는다
 *  32  빈 제목은 「공부 노트」 폴백
 *  33  🔴 `data-theme` 를 light 로 강제하고 `afterprint` 에 **원래 값(dark)** 으로 복원
 *  34  🔴 속성이 **없던** 경우의 복원은 'dark' 넣기가 아니라 **속성 제거**다 (미지정 = 다크 fallback)
 *  35  🔴 예외 경로 — `print()` 가 던져도 제목·테마가 되돌아온다
 *  36  🔴 뒤따라 온 `beforeprint` 가 원본을 덮지 않는다 (복원이 light·노트 제목으로 굳는 사고)
 *  37  🔴 인쇄 중 이탈(언마운트) — 다른 화면에서 탭 제목이 노트 제목인 채로 굳지 않는다
 */
describe('문서 — PDF로 저장(인쇄)', () => {
  const TAB_TITLE = '치뽀'
  const print = vi.fn()

  /** 인쇄 순간의 전역 상태 — 「바뀐 채로 print 가 불렸나」는 호출 시점에만 볼 수 있다 */
  function snapshotOnPrint() {
    const seen: { theme: string | null; title: string; titleInput: boolean }[] = []
    print.mockImplementation(() => {
      seen.push({
        theme: document.documentElement.getAttribute('data-theme'),
        title: document.title,
        titleInput: document.querySelector('[aria-label="노트 제목"]') !== null,
      })
    })
    return seen
  }

  beforeEach(() => {
    print.mockReset()
    vi.stubGlobal('print', print)
    document.title = TAB_TITLE
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-theme')
    document.title = ''
  })

  function readMode() {
    localStorage.setItem('study-notes:mode:v1', 'read')
  }

  async function clickPrint() {
    fireEvent.click(screen.getByRole('button', { name: '노트 메뉴' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF로 저장' }))
    await waitFor(() => expect(print).toHaveBeenCalled())
  }

  /** 브라우저가 인쇄를 마쳤다고 알리는 순간 */
  function afterPrint() {
    fireEvent(window, new Event('afterprint'))
  }

  it('26 읽기 모드에서 누르면 인쇄가 한 번 열린다', async () => {
    readMode()
    await renderLoaded()
    await clickPrint()

    expect(print).toHaveBeenCalledTimes(1)
    // 메뉴는 닫힌다 — 인쇄 다이얼로그 뒤에 떠 있으면 안 된다
    expect(screen.queryByRole('menu', { name: '노트 메뉴' })).toBeNull()
  })

  it('27 🔴 편집 모드에서 누르면 읽기로 전환된 뒤에 인쇄한다', async () => {
    const seen = snapshotOnPrint()
    await renderLoaded()
    // 편집 모드로 들어왔다는 것부터 확인 (제목이 입력칸)
    expect(screen.getByLabelText('노트 제목')).toBeInTheDocument()

    await clickPrint()

    // 인쇄 **그 순간** 제목은 이미 입력칸이 아니었다
    expect(seen).toHaveLength(1)
    expect(seen[0].titleInput).toBe(false)
    expect(screen.getByRole('heading', { name: '운영체제 정리', level: 1 })).toBeInTheDocument()
  })

  it('28 항목은 「마크다운으로 내보내기」 바로 위에 있다', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '노트 메뉴' }))

    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
      'PDF로 저장',
      '마크다운으로 내보내기',
      '노트 삭제',
    ])
  })

  it('29 🔴 앱 웹뷰에서는 항목 자체가 없다', async () => {
    vi.stubGlobal('ReactNativeWebView', { postMessage: vi.fn() })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: '노트 메뉴' }))

    expect(screen.queryByRole('menuitem', { name: 'PDF로 저장' })).toBeNull()
    // 나머지 항목은 그대로다 — 앱에서 메뉴가 통째로 죽으면 안 된다
    expect(screen.getByRole('menuitem', { name: '마크다운으로 내보내기' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '노트 삭제' })).toBeInTheDocument()
  })

  it('30 탭 제목이 노트 제목이 됐다가 afterprint 에 돌아온다', async () => {
    readMode()
    const seen = snapshotOnPrint()
    await renderLoaded()
    await clickPrint()

    expect(seen[0].title).toBe('운영체제 정리')
    afterPrint()
    expect(document.title).toBe(TAB_TITLE)
  })

  it('31 파일명 정제 — 금지문자는 `_` · 확장자는 안 붙는다', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, title: 'OS/메모리: 정리*1' })
    readMode()
    const seen = snapshotOnPrint()
    renderDoc()
    await screen.findByRole('heading', { name: /OS/, level: 1 })
    await clickPrint()

    expect(seen[0].title).toBe('OS_메모리_ 정리_1')
    expect(seen[0].title).not.toMatch(/\.md$/)
  })

  it('32 빈 제목은 「공부 노트」 폴백', async () => {
    mocked.getStudyNote.mockResolvedValue({ ...NOTE, title: '   ' })
    readMode()
    const seen = snapshotOnPrint()
    renderDoc()
    await screen.findByText('스레드는 스택만 따로 가진다.')
    await clickPrint()

    expect(seen[0].title).toBe('공부 노트')
  })

  it('33 🔴 다크였으면 인쇄는 라이트로, 끝나면 다시 다크로', async () => {
    readMode()
    const seen = snapshotOnPrint()
    await renderLoaded()
    await clickPrint()

    expect(seen[0].theme).toBe('light')
    afterPrint()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('34 🔴 속성이 없던 경우의 복원은 「속성 제거」다', async () => {
    // 미지정 = 다크 fallback (tailwind darkMode 배선) — 'dark' 를 넣어 두면 그 상태가 아니다
    document.documentElement.removeAttribute('data-theme')
    readMode()
    const seen = snapshotOnPrint()
    await renderLoaded()
    await clickPrint()

    expect(seen[0].theme).toBe('light')
    afterPrint()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('35 🔴 print() 가 던져도 제목·테마가 되돌아온다', async () => {
    readMode()
    print.mockImplementation(() => {
      throw new Error('인쇄 창을 못 열었다')
    })
    await renderLoaded()
    await clickPrint()

    // afterprint 는 오지 않는다 (다이얼로그가 열린 적이 없다)
    expect(document.title).toBe(TAB_TITLE)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('36 🔴 뒤따라 온 beforeprint 가 원본을 덮지 않는다', async () => {
    readMode()
    print.mockImplementation(() => {
      // 브라우저는 print() 안에서 beforeprint 를 낸다 — 이미 걸어 둔 뒤에 또 오는 경우
      fireEvent(window, new Event('beforeprint'))
    })
    await renderLoaded()
    await clickPrint()

    afterPrint()
    expect(document.title).toBe(TAB_TITLE)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('37 🔴 인쇄 중 이탈해도 탭 제목·테마가 굳지 않는다', async () => {
    readMode()
    // afterprint 가 영영 안 오는 상태에서 페이지를 떠난다
    const { unmount } = await renderLoaded()
    await clickPrint()
    expect(document.title).toBe('운영체제 정리')

    unmount()

    expect(document.title).toBe(TAB_TITLE)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

/**
 * 노트 메뉴(⋯) 키보드 탐색 — `role="menu"` 를 선언한 이상 화살표 이동이 표준 기대다.
 *
 * 계약 본문은 `src/test/menuKeyboardContract.ts` 에 **한 벌만** 있고, 툴바 「내보내기」와
 * 허브 ⋯ 메뉴 spec 도 같은 함수를 부른다 — 세 메뉴가 정말 같은 동작인지의 증거가 그것이다.
 *
 *  41  항목 3개(웹)에서 계약 전부 — ↓↑ 순환·Home/End·ESC 후 트리거 복귀
 *  42  🔴 항목 2개(앱 웹뷰 — PDF 빠짐)에서도 **항목 수에 맞게** 순환한다
 *  43  마우스로 열면 첫 항목에 포커스를 주지 않는다 (안 누른 포커스 링 방지)
 */
describe('문서 — 노트 메뉴 키보드 탐색', () => {
  const trigger = () => screen.getByRole('button', { name: '노트 메뉴' })
  const harness = {
    trigger,
    openByMouse: () => fireEvent.click(trigger(), { detail: 1 }),
    openByKeyboard: () => fireEvent.click(trigger(), { detail: 0 }),
  }

  it('41 항목 3개 — 계약 전부 통과', async () => {
    await renderLoaded()
    assertMenuKeyboardContract(harness)
  })

  it('42 🔴 앱 웹뷰(항목 2개)에서도 항목 수에 맞게 순환한다', async () => {
    vi.stubGlobal('ReactNativeWebView', { postMessage: vi.fn() })
    await renderLoaded()
    expect(screen.queryByRole('menuitem', { name: 'PDF로 저장' })).toBeNull()
    assertMenuKeyboardContract(harness)
    vi.unstubAllGlobals()
  })

  it('43 마우스로 열면 첫 항목에 포커스를 주지 않는다', async () => {
    await renderLoaded()
    harness.openByMouse()
    expect(screen.getAllByRole('menuitem')).not.toContain(document.activeElement)
  })
})

/**
 * 툴바 「내보내기」 = 형식 선택 (2026-08-21).
 *
 * PDF 는 문서 메뉴(⋯)에만, 마크다운은 메뉴 + 툴바 둘 다 있어 비대칭이었다. 툴바 버튼을
 * 형식 선택으로 바꿔 손잡이 하나에 형식 둘을 모은다. 메뉴 자체의 동작(닫힘·접근성·잘림)은
 * `EditorToolbar.test.tsx` 가 잠그고, 여기서는 **배선**만 본다.
 *
 *  38  항목 2개 = 마크다운(.md) · PDF로 저장
 *  39  🔴 PDF 항목이 기존 인쇄 경로를 그대로 탄다 (편집 중이어도 읽기로 전환된 뒤 인쇄)
 *  40  🔴 앱 웹뷰 = PDF 가 빠져 형식이 하나뿐 → 메뉴가 아니라 예전처럼 곧장 마크다운
 *      (문서 메뉴의 `onPrint` 와 같은 근거·같은 조건)
 */
describe('문서 — 툴바 「내보내기」 형식 선택', () => {
  const print = vi.fn()

  beforeEach(() => {
    print.mockReset()
    vi.stubGlobal('print', print)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-theme')
  })

  const trigger = () => screen.getByRole('button', { name: '내보내기' })

  it('38 항목 2개 — 마크다운(.md) · PDF로 저장', async () => {
    await renderLoaded()
    fireEvent.mouseDown(trigger())

    expect(screen.getAllByRole('menuitem').map((el) => el.getAttribute('aria-label'))).toEqual([
      '마크다운(.md)',
      'PDF로 저장',
    ])
  })

  it('39 🔴 PDF 항목 = 읽기 모드로 전환된 뒤 인쇄 (기존 경로 재사용)', async () => {
    await renderLoaded()
    // 편집 모드로 들어왔다 (제목이 입력칸)
    expect(screen.getByLabelText('노트 제목')).toBeInTheDocument()

    fireEvent.mouseDown(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: 'PDF로 저장' }))

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('heading', { name: '운영체제 정리', level: 1 })).toBeInTheDocument()
  })

  it('40 🔴 앱 웹뷰에서는 메뉴가 아니라 마크다운 단일 버튼', async () => {
    vi.stubGlobal('ReactNativeWebView', { postMessage: vi.fn() })
    await renderLoaded()

    // 누르면 곧장 내려받기가 시작되므로 **누르지 않고** 손잡이의 성격만 본다
    const btn = screen.getByRole('button', { name: '마크다운 내보내기' })
    expect(btn.getAttribute('aria-haspopup')).toBeNull()
    expect(screen.queryByRole('button', { name: '내보내기' })).toBeNull()
  })
})
