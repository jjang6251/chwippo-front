/**
 * 준비 노트 **다중 시트 컨테이너** — 승격·전환 flush·시트 수명 (2026-08-11).
 *
 * 시나리오 (먼저 나열하고 코드를 짰다):
 *   A. 폴백 (시트 0장)
 *     A1. 기존 notes 가 첫 탭 「준비 노트」의 내용이 된다 (가상 시트)
 *     A2. notes 도 없으면 빈 첫 탭 (탭은 여전히 1장 보인다)
 *     A3. 🔴 마지막 1장이라 × 가 없다
 *   B. 🔴 승격 (기존 노트 → 첫 시트)
 *     B1. **첫 저장에서만** POST { ifEmpty:true, name:'준비 노트', content:편집본 }
 *     B2. 그 다음 저장부터는 PATCH — POST 는 딱 1번 (멱등)
 *     B3. 🔴 원본 notes 저장 API(updateStep) 는 한 번도 안 나간다
 *     B4. 200(이미 있던 첫 시트) 을 받아도 탭이 복제되지 않는다
 *   C. 🔴 전환 flush
 *     C1. 미저장분이 있는 채로 다른 탭 → **직전 시트 id 로** PATCH 후 전환
 *     C2. 미저장분이 없으면 전환해도 PATCH 가 안 나간다
 *     C3. flush 실패 → 토스트 + 전환은 그대로 진행
 *     C4. 언마운트에도 flush (페이지를 떠나며 마지막 문장을 잃지 않는다)
 *   D. 시트 수명
 *     D1. [+] → 새 시트 POST + 그 탭으로 전환 + 이름 편집 진입
 *     D2. 🔴 미승격 상태의 [+] → 승격(ifEmpty) 먼저, 그 다음 새 시트
 *     D3. 이름 바꾸기 → PATCH { name }
 *     D4. 내용 있는 시트 × → 확인 모달 → 확인해야 DELETE
 *     D5. 빈 시트 × → 확인 없이 바로 DELETE (잃을 게 없다)
 *   E. 다리 텍스트 (활성 시트만)
 *     E1. 마운트 시 활성 시트 본문이 흐른다
 *     E2. 전환하면 새 시트 본문으로 갈아 끼운다
 *   F. 🔴 자동 저장 400 문구 (2026-09-02)
 *     F1. 서버 문구가 실린 400 → 그 문구 그대로 토스트 (「저장 실패」 라벨로 뭉개지 않는다)
 *     F2. 같은 문구는 재시도해도 한 번만 (자동 저장이 1.5초마다 돈다)
 *     F3. 서버가 말이 없는 실패(네트워크)는 토스트하지 않는다
 *     F4. 🔴 승격(POST) 실패는 훅이 이미 띄운다 — 컨테이너가 겹쳐 띄우지 않는다
 */
import ReactForMock from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { StepNoteSheet } from '@/api/stepDetail'

const NOTES = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"기존 노트"}]}]}'
/** 목 에디터가 "입력" 했을 때 만들어지는 저장 형태 */
const typed = (text: string) =>
  JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })

const h = vi.hoisted(() => ({
  sheets: [] as unknown[],
  getNoteSheets: vi.fn(),
  createNoteSheet: vi.fn(),
  updateNoteSheet: vi.fn(),
  deleteNoteSheet: vi.fn(),
  updateStep: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/api/stepDetail', () => ({
  getNoteSheets: (...a: unknown[]) => h.getNoteSheets(...a),
  createNoteSheet: (...a: unknown[]) => h.createNoteSheet(...a),
  updateNoteSheet: (...a: unknown[]) => h.updateNoteSheet(...a),
  deleteNoteSheet: (...a: unknown[]) => h.deleteNoteSheet(...a),
  updateStep: (...a: unknown[]) => h.updateStep(...a),
  getChecklist: vi.fn(),
  createChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
}))
vi.mock('@/stores/toastStore', () => ({
  toast: { error: (...a: unknown[]) => h.toastError(...a), success: vi.fn(), show: vi.fn() },
}))

/**
 * tiptap 은 jsdom 에 안 올라간다. 목이 흉내 내야 할 것 두 가지:
 *   ① `initialContent` 를 **초기화 때만** 읽는다 (init-only — remount 돼야 새 값이 잡힌다)
 *   ② 입력 시 `editorRef` 에 doc 손잡이를 꽂고 `onTextChange` 를 부른다
 *      — 컨테이너가 저장 형태를 **미리 떠 두는** 경로가 여기서 산다 (flush 의 전부다)
 */
vi.mock('@/components/editor/StepNoteEditor', () => ({
  StepNoteEditor: ({
    initialContent,
    onSave,
    onTextChange,
    editorRef,
  }: {
    initialContent: string | null
    onSave: (v: string) => Promise<void>
    onTextChange?: (t: string) => void
    editorRef?: { current: unknown }
  }) => {
    const [frozen] = ReactForMock.useState(initialContent)
    const type = (text: string) => {
      if (editorRef) {
        editorRef.current = {
          isEmpty: false,
          getJSON: () => JSON.parse(typed(text)),
        }
      }
      onTextChange?.(text)
    }
    return (
      <div>
        <div data-testid="note-init">{frozen ?? 'NULL'}</div>
        <button onClick={() => type('새 문장')}>입력</button>
        <button onClick={() => void onSave(typed('새 문장')).catch(() => {})}>
          자동저장
        </button>
      </div>
    )
  },
}))

import { SheetedNoteEditor } from './SheetedNoteEditor'

function sheet(over: Partial<StepNoteSheet> & { id: string; name: string }): StepNoteSheet {
  return {
    stepId: 'st-1',
    content: null,
    orderIndex: 0,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  }
}

function draw({ fallback = NOTES as string | null } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <SheetedNoteEditor
        appId="app-1"
        stepId="st-1"
        stepName="1차 면접"
        fallbackContent={fallback}
        onActiveTextChange={onText}
      />
    </QueryClientProvider>,
  )
}

const onText = vi.fn()
const tabs = () => screen.getAllByRole('tab')
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(name) })
const init = () => screen.getByTestId('note-init').textContent
const typeBtn = () => screen.getByText('입력')
const saveBtn = () => screen.getByText('자동저장')
/** 시트 목록이 도착해 에디터가 뜰 때까지 (로딩 중엔 스켈레톤이다) */
const ready = () => waitFor(() => expect(screen.getByTestId('note-init')).toBeTruthy())

beforeEach(() => {
  vi.clearAllMocks()
  h.getNoteSheets.mockResolvedValue([])
  h.createNoteSheet.mockImplementation((_a, _s, body: { name: string; content?: string }) =>
    Promise.resolve(sheet({ id: 'new-1', name: body.name, content: body.content || null })),
  )
  h.updateNoteSheet.mockImplementation((_a, _s, id: string, body: Record<string, unknown>) =>
    Promise.resolve(sheet({ id, name: String(body.name ?? '준비 노트'), content: (body.content as string) ?? null })),
  )
  h.deleteNoteSheet.mockResolvedValue(undefined)
})

describe('A. 폴백 — 시트 0장', () => {
  it('A1. 기존 notes 가 첫 탭 「준비 노트」의 내용이 된다', async () => {
    draw()
    await ready()
    expect(tabs()).toHaveLength(1)
    expect(tab('준비 노트')).toBeTruthy()
    expect(init()).toBe(NOTES)
  })

  it('A2. notes 도 없으면 빈 첫 탭', async () => {
    draw({ fallback: null })
    await ready()
    expect(tab('준비 노트')).toBeTruthy()
    expect(init()).toBe('NULL')
  })

  it('A3. 마지막 1장이라 × 가 없다', async () => {
    draw()
    await ready()
    expect(within(tab('준비 노트')).queryByRole('button', { name: /시트 삭제/ })).toBeNull()
  })

  /**
   * 🔴 **탭 줄이 에디터보다 위다** (CEO 실기 판단 2026-08-11 — 하단에서 옮겼다).
   * 노트는 세로로 긴 문서라 아래에 두면 쓰는 동안 탭이 화면 밖으로 밀려나, 시트를
   * 바꾸려고 끝까지 스크롤해 내려가야 했다. DOM 순서로 잠근다 — 낭독 순서도 이게 맞다
   * (무엇을 보고 있는지 먼저, 내용은 그 다음).
   */
  it('A4. 🔴 탭 줄이 에디터 패널보다 앞에 온다 (DOM 순서 = 화면 위)', async () => {
    draw()
    await ready()
    const tablist = screen.getByRole('tablist', { name: '준비 노트 시트' })
    const panel = document.getElementById('note-panel-st-1')!
    // DOCUMENT_POSITION_FOLLOWING(4) = tablist 다음에 panel 이 온다
    expect(tablist.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('B. 🔴 승격 — 기존 노트 → 첫 시트', () => {
  it('B1. 첫 저장에서만 POST { ifEmpty, name:준비 노트, content:편집본 }', async () => {
    draw()
    await ready()
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.createNoteSheet).toHaveBeenCalledTimes(1))
    expect(h.createNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', {
      name: '준비 노트',
      content: typed('새 문장'),
      ifEmpty: true,
    })
  })

  /** 🔴 두 번째 저장까지 POST 가 나가면 시트가 두 장이 된다 (서버 가드가 아니라 화면이 먼저 옳아야 한다) */
  it('B2. 그 다음 저장부터는 PATCH — POST 는 딱 1번', async () => {
    draw()
    await ready()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.createNoteSheet).toHaveBeenCalledTimes(1))

    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.updateNoteSheet).toHaveBeenCalledTimes(1))
    expect(h.createNoteSheet).toHaveBeenCalledTimes(1)
    expect(h.updateNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', 'new-1', {
      content: typed('새 문장'),
    })
  })

  /** 🔴 승격은 **복사**다. 원본이 남아 있어야 되돌릴 자리가 있다 */
  it('B3. 원본 노트 저장 API(updateStep)는 한 번도 안 나간다', async () => {
    draw()
    await ready()
    fireEvent.click(typeBtn())
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.createNoteSheet).toHaveBeenCalled())
    expect(h.updateStep).not.toHaveBeenCalled()
  })

  /** 멀티탭·더블 세이브 — 서버가 200 으로 **기존** 첫 시트를 돌려줘도 탭은 한 장이다 */
  it('B4. 200(기존 첫 시트) 을 받아도 탭이 복제되지 않는다', async () => {
    h.createNoteSheet.mockResolvedValue(
      sheet({ id: 'existing', name: '준비 노트', content: NOTES }),
    )
    draw()
    await ready()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.createNoteSheet).toHaveBeenCalled())
    await waitFor(() => expect(tabs()).toHaveLength(1))
  })
})

describe('C. 🔴 전환 flush — 미저장분을 흘리지 않는다', () => {
  beforeEach(() => {
    h.getNoteSheets.mockResolvedValue([
      sheet({ id: 's1', name: '예상 질문', content: '{"type":"doc","content":[]}', orderIndex: 0 }),
      sheet({ id: 's2', name: '기업 분석', content: null, orderIndex: 1 }),
    ])
  })

  /**
   * 🔴 자동 저장은 1.5s debounce 이고 그 타이머는 언마운트에서 그냥 버려진다.
   * 탭 전환이 주 동선이 되면 "탭 눌렀더니 마지막 문장이 없다" 가 된다.
   */
  it('C1. 미저장분이 있는 채로 전환 → 직전 시트 id 로 PATCH 후 전환', async () => {
    draw()
    await ready()
    fireEvent.click(typeBtn())
    fireEvent.click(tab('기업 분석'))

    await waitFor(() => expect(h.updateNoteSheet).toHaveBeenCalledTimes(1))
    expect(h.updateNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', 's1', {
      content: typed('새 문장'),
    })
    // 전환은 이뤄졌다 — 새 탭이 활성이고 그 시트의 내용이 떴다
    expect(tab('기업 분석').getAttribute('aria-selected')).toBe('true')
    expect(init()).toBe('NULL')
  })

  it('C2. 미저장분이 없으면 전환해도 PATCH 가 안 나간다', async () => {
    draw()
    await ready()
    fireEvent.click(tab('기업 분석'))
    await waitFor(() => expect(tab('기업 분석').getAttribute('aria-selected')).toBe('true'))
    expect(h.updateNoteSheet).not.toHaveBeenCalled()
  })

  /** 실패해도 전환은 막지 않는다 — 정직하게 알리되 화면을 붙잡지 않는다 */
  it('C3. flush 실패 → 토스트 + 전환은 진행', async () => {
    h.updateNoteSheet.mockRejectedValue(new Error('boom'))
    draw()
    await ready()
    fireEvent.click(typeBtn())
    fireEvent.click(tab('기업 분석'))

    await waitFor(() => expect(h.toastError).toHaveBeenCalled())
    expect(String(h.toastError.mock.calls[0][0])).toContain('저장에 실패')
    expect(tab('기업 분석').getAttribute('aria-selected')).toBe('true')
  })

  it('C4. 언마운트에도 flush', async () => {
    const { unmount } = draw()
    await ready()
    fireEvent.click(typeBtn())
    unmount()

    await waitFor(() => expect(h.updateNoteSheet).toHaveBeenCalledTimes(1))
    expect(h.updateNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', 's1', {
      content: typed('새 문장'),
    })
  })
})

describe('D. 시트 수명', () => {
  beforeEach(() => {
    h.getNoteSheets.mockResolvedValue([
      sheet({ id: 's1', name: '예상 질문', content: NOTES, orderIndex: 0 }),
      sheet({ id: 's2', name: '기업 분석', content: null, orderIndex: 1 }),
    ])
  })

  it('D1. [+] → 새 시트 POST + 그 탭으로 전환 + 이름 편집 진입', async () => {
    h.createNoteSheet.mockResolvedValue(sheet({ id: 's3', name: '시트 3' }))
    draw()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '시트 추가' }))

    await waitFor(() => expect(h.createNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', { name: '시트 3' }))
    // 만들자마자 이름 짓기 — 입력칸이 떠 있다 (엑셀 문법)
    await waitFor(() => expect(screen.getByRole('textbox', { name: '시트 이름' })).toBeTruthy())
    expect((screen.getByRole('textbox', { name: '시트 이름' }) as HTMLInputElement).value).toBe('시트 3')
  })

  /**
   * 🔴 폴백은 "시트 0장" 일 때만 뜬다. 승격 없이 새 시트를 만들면 그 순간 기존 노트가
   * 탭 줄에서 통째로 사라진다 — 서버엔 남아 있어도 사용자에겐 소실이다.
   */
  it('D2. 미승격 상태의 [+] → 승격(ifEmpty) 먼저, 그 다음 새 시트', async () => {
    h.getNoteSheets.mockResolvedValue([])
    draw()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '시트 추가' }))

    await waitFor(() => expect(h.createNoteSheet).toHaveBeenCalledTimes(2))
    expect(h.createNoteSheet.mock.calls[0][2]).toEqual({
      name: '준비 노트',
      content: NOTES,
      ifEmpty: true,
    })
    expect(h.createNoteSheet.mock.calls[1][2]).toEqual({ name: '시트 2' })
  })

  it('D3. 이름 바꾸기 → PATCH { name }', async () => {
    draw()
    await ready()
    fireEvent.click(within(tab('예상 질문')).getByRole('button', { name: /이름 바꾸기/ }))
    const input = screen.getByRole('textbox', { name: '시트 이름' })
    fireEvent.change(input, { target: { value: '1차 기출' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(h.updateNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', 's1', { name: '1차 기출' }),
    )
  })

  it('D4. 내용 있는 시트 × → 확인 모달 → 확인해야 DELETE', async () => {
    draw()
    await ready()
    fireEvent.click(within(tab('예상 질문')).getByRole('button', { name: /시트 삭제/ }))

    expect(screen.getByRole('dialog', { name: '시트 삭제' })).toBeTruthy()
    expect(screen.getByText(/안의 내용도 사라져요/)).toBeTruthy()
    expect(h.deleteNoteSheet).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(h.deleteNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', 's1'))
  })

  /** 확인창은 잃을 게 있을 때만 — 매번 묻는 확인창은 결국 안 읽힌다 */
  it('D5. 빈 시트 × → 확인 없이 바로 DELETE', async () => {
    draw()
    await ready()
    fireEvent.click(tab('기업 분석')) // content: null
    await waitFor(() => expect(tab('기업 분석').getAttribute('aria-selected')).toBe('true'))
    fireEvent.click(within(tab('기업 분석')).getByRole('button', { name: /시트 삭제/ }))

    await waitFor(() => expect(h.deleteNoteSheet).toHaveBeenCalledWith('app-1', 'st-1', 's2'))
    expect(screen.queryByRole('dialog', { name: '시트 삭제' })).toBeNull()
  })
})

describe('E. 다리 텍스트 — 활성 시트만', () => {
  beforeEach(() => {
    h.getNoteSheets.mockResolvedValue([
      sheet({
        id: 's1',
        name: '예상 질문',
        content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"1분 자기소개"}]}]}',
        orderIndex: 0,
      }),
      sheet({
        id: 's2',
        name: '기업 분석',
        content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"MSA 경험"}]}]}',
        orderIndex: 1,
      }),
    ])
  })

  it('E1. 마운트 시 활성 시트 본문이 흐른다', async () => {
    draw()
    await ready()
    await waitFor(() => expect(onText).toHaveBeenCalledWith('1분 자기소개'))
  })

  /** 🔴 전환했는데 직전 시트 글이 넘어가면, 눈앞에 없는 내용으로 질문이 만들어진다 */
  it('E2. 전환하면 새 시트 본문으로 갈아 끼운다', async () => {
    draw()
    await ready()
    await waitFor(() => expect(onText).toHaveBeenCalledWith('1분 자기소개'))
    fireEvent.click(tab('기업 분석'))
    await waitFor(() => expect(onText).toHaveBeenLastCalledWith('MSA 경험'))
  })
})

/**
 * 🔴 **서버가 이유를 말했으면 그대로 보여준다** (2026-09-02 실사고).
 * 글자수 상한 400 이 에디터의 「저장 실패」 라벨 하나로 뭉개지면, 사용자는 무엇을 줄여야
 * 하는지 모른 채 계속 쓴다. 한도를 정하는 쪽은 서버다.
 */
describe('F. 🔴 자동 저장 400 문구', () => {
  const OVER = '노트는 100,000자까지 저장할 수 있어요.'

  beforeEach(() => {
    // 이미 승격된 상태 = 저장이 PATCH 로 나간다 (승격 경로는 F4 에서 따로 본다)
    h.getNoteSheets.mockResolvedValue([sheet({ id: 's1', name: '준비 노트' })])
  })

  it('F1. 서버 문구가 실린 400 → 그 문구 그대로 토스트', async () => {
    h.updateNoteSheet.mockRejectedValue({ response: { data: { message: OVER } } })
    draw()
    await ready()
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(OVER))
  })

  it('F2. 같은 문구는 재시도해도 한 번만', async () => {
    // 배열 message 도 첫 항목을 뽑아 쓴다 (Nest ValidationPipe 의 두 형태 모두)
    h.updateNoteSheet.mockRejectedValue({ response: { data: { message: [OVER] } } })
    draw()
    await ready()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.updateNoteSheet).toHaveBeenCalledTimes(1))
    fireEvent.click(saveBtn())
    await waitFor(() => expect(h.updateNoteSheet).toHaveBeenCalledTimes(2))

    expect(h.toastError).toHaveBeenCalledTimes(1)
    expect(h.toastError).toHaveBeenCalledWith(OVER)
  })

  it('F3. 서버 문구가 없는 실패(네트워크)는 토스트하지 않는다', async () => {
    h.updateNoteSheet.mockRejectedValue(new Error('Network Error'))
    draw()
    await ready()
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.updateNoteSheet).toHaveBeenCalledTimes(1))
    expect(h.toastError).not.toHaveBeenCalled()
  })

  /** 🔴 승격(POST)은 `useCreateNoteSheet.onError` 가 같은 문구를 이미 띄운다 — 두 번 알리지 않는다 */
  it('F4. 승격 실패는 토스트가 한 번만 (훅 것)', async () => {
    h.getNoteSheets.mockResolvedValue([])
    h.createNoteSheet.mockRejectedValue({ response: { data: { message: OVER } } })
    draw()
    await ready()
    fireEvent.click(saveBtn())

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(OVER))
    expect(h.toastError).toHaveBeenCalledTimes(1)
  })
})
