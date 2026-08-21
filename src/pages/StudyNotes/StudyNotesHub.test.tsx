/**
 * 공부 노트 허브 화면 spec (plan §5 「허브」·「UI」 축).
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *   로딩  1  🔴 로딩 중에는 스켈레톤만 (빈 상태 문구가 번쩍이면 안 된다 — false-empty 금지)
 *   목록  2  폴더 · 폴더 안 노트 · 미분류 · 회사 준비가 각자 자리에 뜬다
 *         3  빈 제목 노트는 「제목 없음」
 *         4  회사 준비 행은 스텝 페이지 **앵커 딥링크**를 가리킨다
 *         5  최근 칩 3개 (공부·준비 통합)
 *   백링크 5a 참조가 있는 노트에만 수가 붙는다
 *         5b 0 은 표시하지 않는다 (0 뱃지는 소음)
 *         5c 🔴 서버가 필드를 안 보내면(undefined) 0 취급 — 화면이 깨지지 않는다
 *   필터  6  「공부 노트」 = 준비 행이 사라진다 / 「회사 준비」 = 폴더가 사라진다
 *   검색  7  노트 제목 · 폴더명 · 회사명으로 각각 걸린다
 *         8  무결과 빈 상태 문구
 *         9  🔴 검색 중에는 접힌 폴더도 펴진다 (안 그러면 결과가 거짓말이 된다)
 *   폴더 10  「새 폴더」 → 인라인 입력 → Enter 확정 (생성 호출)
 *        11  ESC 는 취소 — 생성 호출 없음
 *        12  ⋯ → 이름 바꾸기 = 그 자리가 입력칸
 *        13  ⋯ → 삭제 = ConfirmModal + 「노트는 미분류로 남아요」 문구
 *        14  접기 상태가 localStorage 에 남는다
 *   노트 15  ⋯ → 폴더 이동 (folderId PATCH)
 *        16  ⋯ → 삭제 = ConfirmModal (영구 삭제 명시) → 삭제 호출
 *   생성 17  「새 노트」 → 즉시 생성 후 문서로 이동
 *   키보드 20~22 ⋯ 메뉴 ↓↑ 순환·Home/End·ESC 후 트리거 복귀 (세 메뉴 **공용 계약**)
 *              🔴 항목 수가 가변(폴더 2 · 노트 2+N)이라 두 크기로 잰다
 *   빈   18  노트·폴더 0 → 템플릿 카드 **7종** + 「빈 문서로 시작」 (2026-08-18 확장)
 *        19  템플릿 카드 = 그 템플릿 본문으로 생성
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import * as api from '@/api/studyNotes'
import type { StorageUsage } from '@/api/myinfo'
import { STUDY_NOTE_TEMPLATES } from '@/data/studyNoteTemplates'
import { useStorageUsage } from '@/hooks/useStorageUsage'
import { assertMenuKeyboardContract } from '@/test/menuKeyboardContract'
import { StudyNotesHub } from './StudyNotesHub'

/** 템플릿 제목에 정규식 메타문자(`·` 는 아니지만 `.` 등)가 섞여도 안전하게 */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

/** 허브 하단 저장 용량 바 — 네트워크를 태우지 않고 상태만 갈아 끼운다 */
vi.mock('@/hooks/useStorageUsage', () => ({
  useStorageUsage: vi.fn(),
  useInvalidateStorageUsage: () => vi.fn(),
  storageUsageKey: ['myinfo', 'storage-usage'],
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigateMock,
}))

const mocked = vi.mocked(api)
const mockedStorage = vi.mocked(useStorageUsage)

const MB = 1024 * 1024
const STORAGE: StorageUsage = {
  usedBytes: 9 * MB,
  limitBytes: 100 * MB,
  usedMB: 9,
  limitMB: 100,
  percentage: 9,
  breakdown: { myinfoBytes: 5 * MB, noteImageBytes: 4 * MB },
}

const FOLDERS: api.StudyNoteFolder[] = [
  {
    id: 'f-cs',
    name: 'CS 기초',
    parentId: null,
    sortOrder: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'f-algo',
    name: '알고리즘',
    parentId: null,
    sortOrder: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
]

/**
 * `backlinkCount` 는 세 상태를 다 태운다 — 값 있음(2) · 0 · **필드 자체 없음**(n3·n4).
 * 서버 배포 순서상 세 번째가 실제로 온다.
 */
const NOTES: api.StudyNoteListItem[] = [
  {
    id: 'n1',
    title: '운영체제 정리',
    folderId: 'f-cs',
    updatedAt: '2026-08-18T02:00:00.000Z',
    backlinkCount: 2,
  },
  {
    id: 'n2',
    title: '네트워크 정리',
    folderId: 'f-cs',
    updatedAt: '2026-08-17T02:00:00.000Z',
    backlinkCount: 0,
  },
  { id: 'n3', title: 'DP 유형 정리', folderId: 'f-algo', updatedAt: '2026-08-16T02:00:00.000Z' },
  { id: 'n4', title: '', folderId: null, updatedAt: '2026-08-15T02:00:00.000Z' },
]

const PREPS: api.PrepHubGroup[] = [
  {
    applicationId: 'app-1',
    companyName: '삼성전자',
    stepId: 'step-1',
    stepName: '1차 면접',
    sheetCount: 3,
    lastUpdatedAt: '2026-08-18T01:00:00.000Z',
  },
]

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function renderHub() {
  return render(<StudyNotesHub />, { wrapper })
}

/**
 * 목록이 도착할 때까지 기다린다 — 스켈레톤이 걷힌 뒤에만 의미 있는 단언이 가능하다.
 *
 * 🔴 **제목만으로 찾으면 안 된다.** 같은 글자가 「최근」 칩에도 있어서 매칭이 둘이 된다.
 * 노트 행은 링크, 최근 칩은 버튼이라 **역할로 갈라** 본다 (화면에서 둘은 다른 물건이다).
 */
const noteRow = (title: string) => screen.queryByRole('link', { name: new RegExp(title) })
const recentChip = (title: string) =>
  screen.queryByRole('button', { name: new RegExp(`^${title}`) })

async function renderLoaded() {
  const utils = renderHub()
  await screen.findByRole('link', { name: /운영체제 정리/ })
  return utils
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocked.getStudyNotes.mockResolvedValue(NOTES)
  mocked.getStudyNoteFolders.mockResolvedValue(FOLDERS)
  mocked.getPrepHubGroups.mockResolvedValue(PREPS)
  mockedStorage.mockReturnValue({
    data: STORAGE,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useStorageUsage>)
})

describe('허브 — 로딩·목록', () => {
  it('1 🔴 로딩 중에는 빈 상태 문구가 뜨지 않는다 (false-empty 금지)', () => {
    mocked.getStudyNotes.mockReturnValue(new Promise(() => {}))
    mocked.getStudyNoteFolders.mockReturnValue(new Promise(() => {}))
    const { container } = renderHub()
    expect(screen.queryByText('첫 공부 노트를 만들어 볼까요?')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('2 폴더·노트·미분류·회사 준비가 각자 자리에 뜬다', async () => {
    await renderLoaded()
    expect(screen.getByRole('button', { name: /^CS 기초/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^알고리즘/ })).toBeInTheDocument()
    expect(noteRow('네트워크 정리')).not.toBeNull()
    expect(noteRow('DP 유형 정리')).not.toBeNull()
    expect(screen.getByText('미분류')).toBeInTheDocument()
    expect(screen.getByText('회사 준비 노트')).toBeInTheDocument()
  })

  it('3 빈 제목 노트는 「제목 없음」', async () => {
    await renderLoaded()
    expect(noteRow('제목 없음')).not.toBeNull()
  })

  it('4 회사 준비 행 = 스텝 페이지 앵커 딥링크', async () => {
    await renderLoaded()
    expect(
      screen.getByRole('link', { name: /삼성전자 1차 면접 준비 노트로 이동/ }),
    ).toHaveAttribute('href', '/board/app-1/steps/step-1#prep-notes')
  })

  it('5 최근 칩 3개 — 공부·준비 통합', async () => {
    await renderLoaded()
    expect(screen.getByText('최근')).toBeInTheDocument()
    // 최근 = 수정순 상위 3 (n1 · 준비 s1 · n2). n3 는 4번째라 칩에 없다
    expect(recentChip('운영체제 정리')).not.toBeNull()
    expect(recentChip('삼성전자 — 1차 면접')).not.toBeNull()
    expect(recentChip('네트워크 정리')).not.toBeNull()
    expect(recentChip('DP 유형 정리')).toBeNull()
  })

  it('5a 참조가 있는 노트에만 백링크 수가 붙는다', async () => {
    await renderLoaded()
    const row = screen.getByRole('link', { name: /운영체제 정리/ })
    const count = within(row).getByTestId('hub-backlink-count')
    expect(count).toHaveTextContent('2')
    // 숫자만 두면 옆의 수정 시각과 구분이 안 간다 — 이름은 aria-label 이 진다
    expect(count).toHaveAttribute('aria-label', '이 노트를 참조한 노트 2개')
  })

  it('5b 0 은 표시하지 않는다', async () => {
    await renderLoaded()
    const row = screen.getByRole('link', { name: /네트워크 정리/ })
    expect(within(row).queryByTestId('hub-backlink-count')).toBeNull()
  })

  it('5c 🔴 서버가 필드를 안 보내면 0 취급 — 화면이 깨지지 않는다', async () => {
    await renderLoaded()
    const row = screen.getByRole('link', { name: /DP 유형 정리/ })
    expect(within(row).queryByTestId('hub-backlink-count')).toBeNull()
    // 목록 전체에서 뱃지는 n1 하나뿐이다 (0·미전송이 NaN·빈 칸으로 새지 않는다)
    expect(screen.getAllByTestId('hub-backlink-count')).toHaveLength(1)
  })
})

describe('허브 — 필터·검색', () => {
  it('6 필터 세그먼트가 목록을 가른다', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('tab', { name: '공부 노트' }))
    expect(screen.queryByRole('link', { name: /삼성전자 1차 면접 준비 노트로 이동/ })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: '회사 준비' }))
    expect(screen.queryByRole('button', { name: /^CS 기초/ })).toBeNull()
    expect(
      screen.getByRole('link', { name: /삼성전자 1차 면접 준비 노트로 이동/ }),
    ).toBeInTheDocument()
  })

  it('7 노트 제목·폴더명·회사명이 한 칸에서 걸린다', async () => {
    await renderLoaded()
    const box = screen.getByLabelText('노트 · 폴더 · 회사 검색')

    fireEvent.change(box, { target: { value: 'DP' } })
    expect(noteRow('DP 유형 정리')).not.toBeNull()
    expect(noteRow('운영체제 정리')).toBeNull()

    // 폴더 이름이 걸리면 안의 노트가 전부 나온다
    fireEvent.change(box, { target: { value: 'CS' } })
    expect(noteRow('운영체제 정리')).not.toBeNull()
    expect(noteRow('네트워크 정리')).not.toBeNull()

    fireEvent.change(box, { target: { value: '삼성' } })
    expect(
      screen.getByRole('link', { name: /삼성전자 1차 면접 준비 노트로 이동/ }),
    ).toBeInTheDocument()
    expect(noteRow('운영체제 정리')).toBeNull()
  })

  it('8 무결과 빈 상태', async () => {
    await renderLoaded()
    fireEvent.change(screen.getByLabelText('노트 · 폴더 · 회사 검색'), {
      target: { value: '없는단어' },
    })
    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
  })

  it('9 🔴 검색 중에는 접힌 폴더도 펴진다', async () => {
    localStorage.setItem('study-notes:collapsed-folders:v1', JSON.stringify(['f-cs']))
    renderHub()
    await screen.findByRole('button', { name: /^CS 기초/ })
    expect(noteRow('운영체제 정리')).toBeNull()

    fireEvent.change(screen.getByLabelText('노트 · 폴더 · 회사 검색'), {
      target: { value: '운영체제' },
    })
    expect(noteRow('운영체제 정리')).not.toBeNull()
  })
})

describe('허브 — 폴더 관리', () => {
  it('10 「새 폴더」 → 인라인 입력 → Enter 확정', async () => {
    mocked.createStudyNoteFolder.mockResolvedValue({ ...FOLDERS[0], id: 'f-new', name: '코딩테스트' })
    await renderLoaded()
    // 데스크탑 헤더 버튼과 모바일 아이콘 버튼이 둘 다 DOM 에 있다 (보임은 CSS 가 가른다)
    fireEvent.click(screen.getAllByRole('button', { name: '새 폴더' })[0])

    const input = screen.getByLabelText('새 폴더 이름')
    expect(input).toHaveAttribute('maxLength', '50')
    fireEvent.change(input, { target: { value: '코딩테스트' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    await waitFor(() => expect(mocked.createStudyNoteFolder).toHaveBeenCalledWith('코딩테스트'))
  })

  it('11 ESC 는 취소 — 생성 호출 없음', async () => {
    await renderLoaded()
    fireEvent.click(screen.getAllByRole('button', { name: '새 폴더' })[0])
    const input = screen.getByLabelText('새 폴더 이름')
    fireEvent.change(input, { target: { value: '버릴이름' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)

    expect(mocked.createStudyNoteFolder).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('새 폴더 이름')).toBeNull()
  })

  it('12 ⋯ → 이름 바꾸기 = 그 자리가 입력칸 (시트 탭 규약)', async () => {
    mocked.renameStudyNoteFolder.mockResolvedValue({ ...FOLDERS[0], name: 'CS 심화' })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: "'CS 기초' 폴더 메뉴" }))
    fireEvent.click(screen.getByRole('menuitem', { name: '이름 바꾸기' }))

    const input = screen.getByLabelText('폴더 이름')
    expect(input).toHaveValue('CS 기초')
    fireEvent.change(input, { target: { value: 'CS 심화' } })
    fireEvent.blur(input)

    await waitFor(() =>
      expect(mocked.renameStudyNoteFolder).toHaveBeenCalledWith('f-cs', 'CS 심화'),
    )
  })

  it('13 ⋯ → 삭제 = ConfirmModal + 「노트는 미분류로 남아요」', async () => {
    mocked.deleteStudyNoteFolder.mockResolvedValue(undefined as never)
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: "'CS 기초' 폴더 메뉴" }))
    // 메뉴 안 각주도 같은 약속을 말한다
    expect(screen.getAllByText('삭제해도 노트는 미분류로 남아요').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }))

    const dialog = screen.getByRole('dialog', { name: '폴더 삭제' })
    expect(within(dialog).getByText(/노트는 미분류로 남아요/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mocked.deleteStudyNoteFolder).toHaveBeenCalledWith('f-cs'))
  })

  it('14 접기 상태가 localStorage 에 남는다', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /^CS 기초/ }))
    expect(noteRow('운영체제 정리')).toBeNull()
    expect(localStorage.getItem('study-notes:collapsed-folders:v1')).toBe('["f-cs"]')

    fireEvent.click(screen.getByRole('button', { name: /^CS 기초/ }))
    expect(localStorage.getItem('study-notes:collapsed-folders:v1')).toBe('[]')
  })
})

describe('허브 — 노트 관리·생성', () => {
  it('15 ⋯ → 폴더 이동', async () => {
    mocked.updateStudyNote.mockResolvedValue({
      ...NOTES[0],
      folderId: 'f-algo',
      content: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: "'운영체제 정리' 노트 메뉴" }))
    fireEvent.click(screen.getByRole('menuitem', { name: '📁 알고리즘' }))

    await waitFor(() =>
      expect(mocked.updateStudyNote).toHaveBeenCalledWith('n1', { folderId: 'f-algo' }),
    )
  })

  it('16 ⋯ → 삭제 = 영구 삭제 명시 후 삭제', async () => {
    mocked.deleteStudyNote.mockResolvedValue(undefined as never)
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: "'운영체제 정리' 노트 메뉴" }))
    fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }))

    const dialog = screen.getByRole('dialog', { name: '노트 삭제' })
    expect(within(dialog).getByText(/되돌릴 수 없어요/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mocked.deleteStudyNote).toHaveBeenCalledWith('n1'))
  })

  it('17 「새 노트」 = 즉시 생성 후 문서로 이동', async () => {
    mocked.createStudyNote.mockResolvedValue({
      id: 'new-1',
      title: '',
      folderId: null,
      content: null,
      createdAt: '2026-08-18T03:00:00.000Z',
      updatedAt: '2026-08-18T03:00:00.000Z',
    })
    await renderLoaded()
    fireEvent.click(screen.getAllByRole('button', { name: '새 노트' })[0])

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/study-notes/new-1'))
    expect(mocked.createStudyNote).toHaveBeenCalledWith({})
  })
})

/**
 * ⋯ 메뉴 키보드 탐색 — `role="menu"` 를 선언한 이상 화살표 이동이 표준 기대다.
 *
 * 🔴 허브 ⋯ 는 **항목 수가 고정이 아니다** — 폴더 메뉴는 2개, 노트 메뉴는 「폴더 이동」
 * 목록이 폴더 수만큼 늘어난다(미분류 + 폴더 N + 삭제). 열 때 목록을 담아두면 순환이
 * 어긋나므로 `useMenuKeyboard` 는 매번 다시 질의한다 — 그걸 여기서 두 크기로 잰다.
 *
 * 계약 본문은 `src/test/menuKeyboardContract.ts` 한 벌 — 툴바 「내보내기」·노트 메뉴 spec 도
 * **같은 함수**를 부른다. 세 메뉴가 정말 같은 동작인지의 증거가 그것이다.
 *
 *  20  폴더 ⋯ (항목 2개) 계약 전부
 *  21  노트 ⋯ (항목 4개 = 미분류 + 폴더 2 + 삭제) 계약 전부 — 순환이 항목 수를 따라간다
 *  22  마우스로 열면 첫 항목에 포커스를 주지 않는다
 */
describe('허브 — ⋯ 메뉴 키보드 탐색', () => {
  const harnessFor = (name: string) => {
    const trigger = () => screen.getByRole('button', { name })
    return {
      trigger,
      openByMouse: () => fireEvent.click(trigger(), { detail: 1 }),
      openByKeyboard: () => fireEvent.click(trigger(), { detail: 0 }),
    }
  }

  it('20 폴더 ⋯ — 항목 2개로 계약 전부 통과', async () => {
    await renderLoaded()
    const h = harnessFor("'CS 기초' 폴더 메뉴")
    h.openByMouse()
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
      '이름 바꾸기',
      '삭제',
    ])
    fireEvent.keyDown(document, { key: 'Escape' })

    assertMenuKeyboardContract(h)
  })

  it('21 노트 ⋯ — 항목 4개(폴더 수만큼 늘어난 목록)로도 순환이 맞는다', async () => {
    await renderLoaded()
    const h = harnessFor("'운영체제 정리' 노트 메뉴")
    h.openByMouse()
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
      '미분류',
      '📁 CS 기초',
      '📁 알고리즘',
      '삭제',
    ])
    fireEvent.keyDown(document, { key: 'Escape' })

    assertMenuKeyboardContract(h)
  })

  it('22 마우스로 열면 첫 항목에 포커스를 주지 않는다', async () => {
    await renderLoaded()
    harnessFor("'CS 기초' 폴더 메뉴").openByMouse()
    expect(screen.getAllByRole('menuitem')).not.toContain(document.activeElement)
  })
})

describe('허브 — 첫 방문 빈 상태', () => {
  beforeEach(() => {
    mocked.getStudyNotes.mockResolvedValue([])
    mocked.getStudyNoteFolders.mockResolvedValue([])
    mocked.getPrepHubGroups.mockResolvedValue([])
  })

  it('18 템플릿 카드 7종 + 「빈 문서로 시작」', async () => {
    renderHub()
    await screen.findByText('첫 공부 노트를 만들어 볼까요?')

    // 목록을 손으로 안 적는다 — 템플릿이 늘거나 줄면 여기가 같이 따라가야 한다
    for (const t of STUDY_NOTE_TEMPLATES) {
      expect(
        screen.getByRole('button', { name: new RegExp(escapeRe(t.title)) }),
        `${t.title} 카드가 없다`,
      ).toBeInTheDocument()
    }
    expect(STUDY_NOTE_TEMPLATES).toHaveLength(7)
    expect(screen.getByRole('button', { name: '빈 문서로 시작' })).toBeInTheDocument()
  })

  /**
   * 🔴 **320px 에서 1열이어야 한다.** 7종이 되면서 3열 고정을 놨는데, 좁은 화면에서 3열이면
   * 카드 하나가 ~90px 라 제목이 접히고 설명은 읽을 수 없다. 열 수는 CSS 가 정하므로
   * jsdom 은 클래스 계약으로만 잡는다 (실제 렌더 폭은 Playwright 몫).
   */
  it('18b 좁은 화면은 1열 — 넓어질수록 열이 는다', async () => {
    const { container } = renderHub()
    await screen.findByText('첫 공부 노트를 만들어 볼까요?')
    const grid = container.querySelector('[class*="grid-cols-1"]')
    expect(grid?.className).toContain('grid-cols-1')
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-3')
  })

  it('19 템플릿 카드 = 그 템플릿 본문으로 생성', async () => {
    mocked.createStudyNote.mockResolvedValue({
      id: 'tpl-1',
      title: 'CS 정리',
      folderId: null,
      content: '{}',
      createdAt: '2026-08-18T03:00:00.000Z',
      updatedAt: '2026-08-18T03:00:00.000Z',
    })
    renderHub()
    await screen.findByText('첫 공부 노트를 만들어 볼까요?')
    fireEvent.click(screen.getByRole('button', { name: /CS 정리/ }))

    await waitFor(() => expect(mocked.createStudyNote).toHaveBeenCalled())
    const body = mocked.createStudyNote.mock.calls[0][0]
    expect(body.title).toBe('CS 정리')
    expect(body.content).toContain('details')
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/study-notes/tpl-1'))
  })
})

describe('폴더에 바로 새 노트 (2026-08-19 실사용 — 만들고 옮기는 동선 제거)', () => {
  it("폴더 헤더의 [+] 가 그 폴더의 folderId 로 노트를 만든다", async () => {
    mocked.createStudyNote.mockResolvedValue({ ...NOTES[0], id: 'n-new', content: '', createdAt: NOTES[0].updatedAt })
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: "'CS 기초' 폴더에 새 노트" }))
    await waitFor(() => expect(mocked.createStudyNote).toHaveBeenCalledTimes(1))
    expect(mocked.createStudyNote.mock.calls[0][0]).toMatchObject({ folderId: FOLDERS[0].id })
  })

  it('목록 끝 ghost 「폴더 만들기」 버튼은 없다 — 새 폴더 진입은 우상단 하나', async () => {
    await renderLoaded()
    expect(screen.queryByRole('button', { name: '폴더 만들기' })).not.toBeInTheDocument()
  })
})

/**
 * 저장 용량 노출 (2026-08-21 — 노트 이미지가 100MB 통에 합류).
 *
 * 자리는 폭에 따라 갈린다 (같은 날 오후 이동):
 *  - 데스크탑(lg+) = **헤더 우측**, CTA 아래 — 목록 끝까지 스크롤해야 보이던 걸 올렸다
 *  - 모바일(<lg)   = 하단 그대로 — 헤더 우측에 220px 를 얹을 자리가 없다
 *
 * 🔴 jsdom 은 미디어 쿼리를 안 푼다 — **두 인스턴스가 다 DOM 에 있다.** 여기서는
 * 「자리·순서·클래스 계약」만 잡고, 실제로 한 번에 하나만 보이는지는 Playwright 몫이다.
 *
 * 시나리오:
 *  20  두 자리에 각각 뜨고 **출처 분해까지** 읽힌다 (업로드가 실패해야 아는 상태 해소)
 *  20b 🔴 `hidden lg:flex` ↔ `lg:hidden` 이 정확히 반대 — 동시에 보이는 폭이 없다
 *  20c 🔴 헤더 분해 줄은 짧은 라벨, 하단은 긴 라벨 (같은 값, 자리에 맞는 이름)
 *  21  🔴 위계 — 헤더에서는 CTA(「새 노트」)가 먼저, 용량이 뒤
 *  21b 🔴 모바일 자리는 여전히 노트 목록 **뒤** (주인공은 목록)
 *  22  목록 로딩과 엮이지 않는다 — 자기 스켈레톤으로 따로 자리를 잡는다
 *  23  용량 조회가 실패해도 목록은 멀쩡하다 (허브가 통째로 죽지 않는다)
 */
describe('허브 — 저장 용량', () => {
  /** compact(헤더) 인스턴스 — 폭 고정 클래스가 유일한 표식이다 */
  const compactShell = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[class*="w-[220px]"]')

  it('20 헤더·하단 두 자리에 용량 + 출처 분해가 뜬다', async () => {
    await renderLoaded()
    // 같은 값을 두 자리가 든다 (보이는 건 폭에 따라 하나뿐)
    expect(screen.getAllByText('9.0 / 100MB')).toHaveLength(2)
    expect(screen.getByText(/증빙 파일 5\.0MB/)).toBeInTheDocument()
    expect(screen.getByText(/공부 노트 이미지 4\.0MB/)).toBeInTheDocument()
  })

  it('20b 🔴 헤더는 lg 이상에서만, 하단은 lg 미만에서만 — 겹치는 폭이 없다', async () => {
    const { container } = await renderLoaded()
    const compact = compactShell(container)
    expect(compact).not.toBeNull()

    // 헤더 인스턴스를 감싼 우측 열
    const headerColumn = compact!.parentElement!
    expect(headerColumn.className).toContain('hidden')
    expect(headerColumn.className).toContain('lg:flex')

    // 하단 인스턴스 (compact 가 아닌 쪽)
    const bars = Array.from(container.querySelectorAll('[role="progressbar"]'))
    expect(bars).toHaveLength(2)
    const bottomBar = bars.find((b) => !compact!.contains(b))!
    const bottomBlock = bottomBar.closest('.border-t') as HTMLElement
    expect(bottomBlock.className).toContain('lg:hidden')
    // 🔴 데스크탑 전용 잔재(lg:max-w)가 남으면 「안 보이는데 자리는 잡는」 블록이 된다
    expect(bottomBlock.className).not.toContain('lg:max-w')
  })

  it('20c 🔴 헤더는 짧은 라벨 · 하단은 긴 라벨 — 값은 같다', async () => {
    const { container } = await renderLoaded()
    const compact = compactShell(container)!
    const line = Array.from(compact.querySelectorAll('p')).find((p) =>
      p.textContent?.includes('증빙'),
    )
    expect(line?.textContent).toContain('증빙 5.0MB')
    expect(line?.textContent).toContain('노트 4.0MB')
    expect(line?.textContent).not.toContain('증빙 파일')
  })

  it('21 🔴 헤더 위계 — 1순위 「새 노트」가 먼저, 용량이 그 아래', async () => {
    const { container } = await renderLoaded()
    const compact = compactShell(container)!
    const newNote = screen.getAllByRole('button', { name: '새 노트' })[0]
    // DOCUMENT_POSITION_FOLLOWING = CTA 가 먼저, 용량이 뒤
    expect(newNote.compareDocumentPosition(compact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('21b 🔴 모바일 자리는 여전히 목록 뒤 — 주인공은 노트 목록', async () => {
    const { container } = await renderLoaded()
    const compact = compactShell(container)!
    const bottomBar = Array.from(container.querySelectorAll('[role="progressbar"]')).find(
      (b) => !compact.contains(b),
    )!
    const firstNote = screen.getByRole('link', { name: /운영체제 정리/ })
    expect(
      firstNote.compareDocumentPosition(bottomBar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('22 목록이 로딩 중이어도 용량은 자기 스켈레톤으로 자리를 잡는다', () => {
    mocked.getStudyNotes.mockReturnValue(new Promise(() => {}))
    mocked.getStudyNoteFolders.mockReturnValue(new Promise(() => {}))
    mockedStorage.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useStorageUsage>)

    const { container } = renderHub()
    // 목록 스켈레톤(1) + 용량 스켈레톤(2: 헤더·하단) 이 각자 aria-busy 를 든다
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBe(3)
  })

  it('23 용량 조회 실패해도 목록은 멀쩡하다', async () => {
    mockedStorage.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('500'),
    } as unknown as ReturnType<typeof useStorageUsage>)

    await renderLoaded()
    expect(screen.getAllByText('사용량 조회 실패')).toHaveLength(2)
    expect(noteRow('네트워크 정리')).not.toBeNull()
  })
})
