/**
 * 노트 AI 패널 — 화면 계약 spec.
 *
 * 시나리오 (plan §3 프론트 중 패널이 책임지는 것):
 *   패널      액션 칩 5종 · 요청 버튼 · 비저장 안내 (코인은 토큰 환산 — 정액 표기 없음)
 *             닫았다 열어도 히스토리 유지 (D6 — 라우트 안에서만 산다)
 *   상태 3분기 running 스켈레톤 · error 서버 문구+[다시 시도] · done 결과 프리뷰
 *   게이트    동의 게이트에서 멈추면(cancelled) 히스토리에 남기지 않는다
 *   교체      요청 뒤 본문이 바뀌면 [교체] 비활성 + 사유 툴팁 / 안 바뀌었으면 정상 적용
 *   되돌리기  적용 직후엔 본문 복원 · **다음 편집이 시작되면 손대지 않는다**
 *   생성 모드 선택이 없으면 「AI 생성 내용」 라벨 + [커서에 삽입]
 *
 * 에디터 기반부(`editorBridge`)와 결과 프리뷰는 갈아 끼운다 — 여기서 증명할 것은
 * **패널의 판단**이지 직렬화·마크다운 렌더가 아니다. 반대로 tiptap 인스턴스는 진짜를
 * 쓴다: 「본문이 바뀌었나」 판정이 실제 transaction 을 타야 의미가 있다.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/react'
import { buildEditorExtensions } from '@/components/editor/editorExtensions'
import { useToastStore } from '@/stores/toastStore'
import type { NoteAiResource } from '@/api/noteAiAction'
import type { NoteAiOutcome } from '@/hooks/useNoteAiAction'

vi.mock('./editorBridge', () => ({
  expandSelection: vi.fn(),
  serializeSelection: vi.fn(),
  applyReplace: vi.fn(),
  applyInsertAt: vi.fn(),
  applyNodesAt: vi.fn(),
  setAiTarget: vi.fn(),
  clearAiTarget: vi.fn(),
  useEditorSelection: vi.fn(),
}))
vi.mock('./AiResultPreview', () => ({
  AiResultPreview: ({ markdown }: { markdown: string }) => (
    <div data-testid="ai-preview">{markdown}</div>
  ),
}))
vi.mock('@/hooks/useMyAiQuotas', () => ({
  useAiQuotaBlocked: () => ({ blocked: false, reason: null }),
  useMyAiQuota: () => undefined,
}))
vi.mock('@/hooks/useNoteAiAction', () => ({ useNoteAiAction: vi.fn() }))

import * as bridgeModule from './editorBridge'
import { useNoteAiAction } from '@/hooks/useNoteAiAction'
import { AiNotePanel } from './AiNotePanel'

const bridge = vi.mocked(bridgeModule)
const useNoteAiActionMock = vi.mocked(useNoteAiAction)

const RESOURCE: NoteAiResource = { type: 'study_note', noteId: 'note-1' }
const SELECTION = { from: 1, to: 6 }
const SELECTION_MD = '원문 문단입니다'

let run: ReturnType<typeof vi.fn>
let editor: Editor

/** jsdom 에는 matchMedia 가 없다 — 데스크탑(우측 슬라이드) 으로 고정 */
function stubMatchMedia(desktop: boolean) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

function makeEditor(): Editor {
  return new Editor({
    extensions: buildEditorExtensions({ placeholder: '' }),
    content: '<p>원문 문단입니다</p>',
  })
}

function renderPanel(open = true, opts?: { interact?: boolean }) {
  const onClose = vi.fn()
  const utils = render(
    <AiNotePanel editor={editor} resource={RESOURCE} open={open} onClose={onClose} />,
  )
  // 🔴 기존 케이스들은 "에디터를 만진 사용자" 전제 — 마운트 **후** 상호작용을 부여해야
  //    useEditorInteracted 가 듣는다 (실사용에선 패널이 상시 마운트라 항상 듣는 순서).
  //    안 만진 상태는 「상호작용 전」 describe 가 interact:false 로 검증.
  if (opts?.interact !== false) {
    act(() => {
      editor.commands.setTextSelection(2)
    })
  }
  const rerenderOpen = (next: boolean) =>
    utils.rerender(
      <AiNotePanel editor={editor} resource={RESOURCE} open={next} onClose={onClose} />,
    )
  return { ...utils, onClose, rerenderOpen }
}

/** 프리셋 액션 칩 클릭 후 요청이 한 바퀴 돌 때까지 */
async function clickChip(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }))
  })
}

function lastToastAction() {
  const toasts = useToastStore.getState().toasts
  return toasts[toasts.length - 1]?.action
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  stubMatchMedia(true)
  editor = makeEditor()
  run = vi.fn()
  useNoteAiActionMock.mockReturnValue({
    run: run as unknown as ReturnType<typeof useNoteAiAction>['run'],
    pending: false,
  })
  bridge.expandSelection.mockReturnValue(SELECTION)
  bridge.serializeSelection.mockReturnValue(SELECTION_MD)
  bridge.useEditorSelection.mockReturnValue({
    empty: true,
    from: 0,
    to: 0,
    charCount: 0,
    hasImage: false,
  })
  bridge.applyReplace.mockImplementation((ed, range, markdown) => {
    ed.chain().deleteRange(range).insertContent(markdown).run()
    return { ok: true, truncated: false }
  })
  bridge.applyInsertAt.mockImplementation((ed, position, markdown) => {
    ed.chain().insertContentAt(position, markdown).run()
    return { ok: true, truncated: false }
  })
})

afterEach(() => {
  cleanup()
  editor.destroy()
})

// ── 패널 ─────────────────────────────────────────────────────

describe('AiNotePanel — 패널', () => {
  it('액션 칩 5종과 요청 버튼, 비저장 안내를 보여준다', () => {
    renderPanel()

    for (const label of ['쉽게 풀어쓰기', '간결히', '표로 정리', '토글 문답', '자유 지시']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByTestId('ai-request')).toHaveTextContent('요청')
    expect(screen.getByText(/대화는 저장되지 않아요/)).toBeInTheDocument()
  })

  it('선택 미리보기 칩에 글자수를 상한과 함께 보여준다', () => {
    renderPanel()

    expect(screen.getByText(SELECTION_MD)).toBeInTheDocument()
    expect(
      screen.getByText(`${SELECTION_MD.length} / ${(6000).toLocaleString('en-US')}`),
    ).toBeInTheDocument()
  })

  it('자유 지시가 공백뿐이면 요청 버튼이 잠긴다 (trim)', () => {
    renderPanel()
    const request = screen.getByTestId('ai-request')

    expect(request).toBeDisabled()

    fireEvent.change(screen.getByLabelText('자유 지시'), { target: { value: '   ' } })
    expect(request).toBeDisabled()

    fireEvent.change(screen.getByLabelText('자유 지시'), { target: { value: '3줄로' } })
    expect(request).toBeEnabled()
  })

  it('닫았다 다시 열어도 히스토리가 남는다', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '쉬운 문장', cached: false, truncated: false })
    const { rerenderOpen } = renderPanel()

    await clickChip('쉽게 풀어쓰기')
    expect(await screen.findByTestId('ai-preview')).toHaveTextContent('쉬운 문장')

    rerenderOpen(false)
    rerenderOpen(true)

    expect(screen.getByTestId('ai-preview')).toHaveTextContent('쉬운 문장')
  })
})

// ── 상태 3분기 ───────────────────────────────────────────────

describe('AiNotePanel — 상태 3분기', () => {
  it('요청 중에는 스켈레톤, 도착하면 결과 프리뷰와 적용 버튼', async () => {
    let settle: (outcome: NoteAiOutcome) => void = () => {}
    run.mockImplementation(
      () =>
        new Promise<NoteAiOutcome>((resolve) => {
          settle = resolve
        }),
    )
    renderPanel()

    await clickChip('표로 정리')
    expect(screen.getByTestId('ai-turn-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-preview')).not.toBeInTheDocument()

    await act(async () => {
      settle({ kind: 'ok', markdown: '| 항목 | 내용 |', cached: false, truncated: false })
    })

    expect(screen.queryByTestId('ai-turn-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('ai-preview')).toHaveTextContent('| 항목 | 내용 |')
    expect(screen.getByRole('button', { name: '교체' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '아래 삽입' })).toBeInTheDocument()
  })

  it('실패하면 서버 문구와 [다시 시도] — 누르면 같은 요청을 다시 보낸다', async () => {
    run.mockResolvedValue({ kind: 'error', message: '오늘 한도를 다 썼어요' })
    renderPanel()

    await clickChip('간결히')
    expect(screen.getByText('⚠ 오늘 한도를 다 썼어요')).toBeInTheDocument()

    run.mockResolvedValue({ kind: 'ok', markdown: '짧아진 문장', cached: false, truncated: false })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    })

    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls[1][0]).toMatchObject({
      action: 'concise',
      selectionMd: SELECTION_MD,
    })
    expect(screen.getByTestId('ai-preview')).toHaveTextContent('짧아진 문장')
  })

  it('출력 한도로 잘린 결과에는 경고 배지가 붙는다 (적용은 막지 않는다)', async () => {
    run.mockResolvedValue({
      kind: 'ok',
      markdown: '| 항목 | 내용 |',
      cached: false,
      truncated: true,
    })
    renderPanel()

    await clickChip('표로 정리')

    expect(screen.getByTestId('ai-truncated-badge')).toHaveTextContent(
      '출력 한도로 뒷부분이 잘렸어요',
    )
    expect(screen.getByRole('button', { name: '교체' })).toBeEnabled()
  })

  it('잘리지 않은 결과에는 경고 배지가 없다', async () => {
    run.mockResolvedValue({
      kind: 'ok',
      markdown: '| 항목 | 내용 |',
      cached: false,
      truncated: false,
    })
    renderPanel()

    await clickChip('표로 정리')

    expect(screen.queryByTestId('ai-truncated-badge')).not.toBeInTheDocument()
  })

  it('동의 게이트에서 멈추면(cancelled) 히스토리에 남기지 않는다', async () => {
    run.mockResolvedValue({ kind: 'cancelled' })
    renderPanel()

    await clickChip('쉽게 풀어쓰기')

    expect(screen.queryByTestId('ai-turn-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ai-preview')).not.toBeInTheDocument()
    expect(screen.queryByText('쉽게 풀어쓰기', { selector: 'p' })).not.toBeInTheDocument()
  })
})

// ── 교체 잠금 ────────────────────────────────────────────────

describe('AiNotePanel — [교체] 잠금', () => {
  it('요청 뒤 본문이 바뀌면 [교체] 가 잠기고 사유가 툴팁에 남는다 ([아래 삽입] 은 열려 있다)', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '다듬은 문장', cached: false, truncated: false })
    renderPanel()

    await clickChip('쉽게 풀어쓰기')
    expect(screen.getByRole('button', { name: '교체' })).toBeEnabled()

    await act(async () => {
      editor.commands.insertContent('사용자가 직접 덧붙인 문장')
    })

    const replace = screen.getByRole('button', { name: '교체' })
    expect(replace).toBeDisabled()
    expect(replace.getAttribute('title')).toContain('본문이 바뀌어서')
    expect(screen.getByRole('button', { name: '아래 삽입' })).toBeEnabled()
  })

  it('본문이 그대로면 [교체] 가 요청 시점 범위에 적용된다', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '다듬은 문장', cached: false, truncated: false })
    renderPanel()

    await clickChip('쉽게 풀어쓰기')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '교체' }))
    })

    expect(bridge.applyReplace).toHaveBeenCalledWith(editor, SELECTION, '다듬은 문장')
    expect(screen.getByText('✓ 본문에 넣었어요')).toBeInTheDocument()
  })
})

// ── 되돌리기 ─────────────────────────────────────────────────

describe('AiNotePanel — [되돌리기] 토스트', () => {
  it('적용 직후에는 본문을 원래대로 되돌린다', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '다듬은 문장', cached: false, truncated: false })
    renderPanel()

    await clickChip('쉽게 풀어쓰기')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '교체' }))
    })
    expect(editor.getText()).toContain('다듬은 문장')

    const undo = lastToastAction()
    expect(undo?.label).toBe('되돌리기')
    await act(async () => {
      undo?.onAction()
    })

    expect(editor.getText()).not.toContain('다듬은 문장')
    expect(editor.getText()).toContain('원문 문단입니다')
  })

  it('적용 뒤 편집을 시작했으면 본문을 건드리지 않는다', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '다듬은 문장', cached: false, truncated: false })
    renderPanel()

    await clickChip('쉽게 풀어쓰기')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '교체' }))
    })
    const undo = lastToastAction()

    await act(async () => {
      editor.commands.insertContent(' 이어서 쓴 문장')
    })
    await act(async () => {
      undo?.onAction()
    })

    expect(editor.getText()).toContain('이어서 쓴 문장')
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((t) => t.message.includes('되돌리지 않았어요')),
      ).toBe(true),
    )
  })
})

// ── 생성 모드 ────────────────────────────────────────────────

describe('AiNotePanel — 생성 모드 (선택 없음)', () => {
  beforeEach(() => {
    bridge.expandSelection.mockReturnValue(null)
  })

  it('선택이 없으면 프리셋 칩이 잠기고 안내를 띄운다', () => {
    renderPanel()

    const chip = screen.getByRole('button', { name: '쉽게 풀어쓰기' })
    expect(chip).toBeDisabled()
    expect(chip.getAttribute('title')).toContain('드래그')
    expect(screen.getByText(/새로 만들기 모드/)).toBeInTheDocument()
  })

  /**
   * 🔴 이미지가 낀 선택은 대상이 될 수 없다 (study-note-media). 같은 「생성 모드」라도
   * **드래그를 한 사람**에게는 이유를 줘야 한다 — 안 그러면 드래그가 씹힌 것으로 읽힌다.
   */
  it('이미지가 낀 선택으로 열면 안내 문구가 이유로 바뀐다', () => {
    bridge.useEditorSelection.mockReturnValue({
      empty: true,
      from: 0,
      to: 0,
      charCount: 0,
      hasImage: true,
    })
    renderPanel()

    expect(screen.getByText(/사진이 들어간 선택은 대상이 되지 않아요/)).toBeInTheDocument()
    expect(screen.queryByText(/새로 만들기 모드/)).not.toBeInTheDocument()
  })

  it('자유 지시 결과에는 「AI 생성 내용」 라벨과 [커서에 삽입] 이 붙는다', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '새로 만든 내용', cached: false, truncated: false })
    renderPanel()

    fireEvent.change(screen.getByLabelText('자유 지시'), {
      target: { value: '면접 예상 질문 3개 만들어줘' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-request'))
    })

    expect(screen.getByText(/AI 생성 내용 — 검증 후 사용하세요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '커서에 삽입' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '교체' })).not.toBeInTheDocument()
    expect(run.mock.calls[0][0]).toMatchObject({
      action: 'free',
      instruction: '면접 예상 질문 3개 만들어줘',
    })
    expect(run.mock.calls[0][0].selectionMd).toBeUndefined()
  })

  it('생성 결과의 [문서 끝에 삽입] — 문서 끝 위치로 applyInsertAt 이 불린다 (2026-08-19 CEO: 위치 예측 가능성)', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '새로 만든 내용', cached: false, truncated: false })
    renderPanel()
    fireEvent.change(screen.getByLabelText('자유 지시'), { target: { value: '요약 만들어줘' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-request'))
    })

    const sizeBefore = editor.state.doc.content.size
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '문서 끝에 삽입' }))
    })
    expect(bridge.applyInsertAt).toHaveBeenCalledTimes(1)
    const [, pos] = bridge.applyInsertAt.mock.calls[0]
    expect(pos).toBe(sizeBefore)
  })
})

// ── AI off ───────────────────────────────────────────────────

describe('AiNotePanel — 게이트', () => {
  it('에디터가 아직 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(
      <AiNotePanel editor={null} resource={RESOURCE} open onClose={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('상호작용 전 — 기본 커서(문서 시작)는 대상이 아니다 (2026-08-19 "아래 삽입이 위에 넣네")', () => {
  it('에디터를 만진 적 없으면 생성 모드 — 대상 칩 없음 + 첫 블록 오타깃 방지', () => {
    renderPanel(true, { interact: false })
    expect(screen.queryByText('대상 부분')).not.toBeInTheDocument()
    expect(screen.getByText(/새로 만들기 모드/)).toBeInTheDocument()
  })

  it('상호작용 전 생성 결과엔 [커서에 삽입]이 없고 [문서 끝에 삽입]만 있다', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '생성 결과', cached: false, truncated: false })
    renderPanel(true, { interact: false })
    fireEvent.change(screen.getByLabelText('자유 지시'), { target: { value: '만들어줘' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-request'))
    })
    expect(screen.queryByRole('button', { name: '커서에 삽입' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '문서 끝에 삽입' })).toBeInTheDocument()
  })

  it('만지는 순간 대상이 잡힌다 — 클릭(선택 변경) 후 칩 등장', () => {
    renderPanel(true, { interact: false })
    expect(screen.queryByText('대상 부분')).not.toBeInTheDocument()
    act(() => {
      editor.commands.setTextSelection(2)
    })
    expect(screen.getByText('대상 부분')).toBeInTheDocument()
  })
})

describe('스크린리더 라이브 리전 (2026-08-19 /uiux 개선 반영)', () => {
  it('결과가 도착하면 상주 status 리전이 도착을 알린다', async () => {
    run.mockResolvedValue({ kind: 'ok', markdown: '결과', cached: false, truncated: false })
    renderPanel()
    await clickChip('쉽게 풀어쓰기')
    expect(screen.getByRole('status')).toHaveTextContent('AI 결과가 도착했어요')
  })

  it('실패하면 실패 안내를 알린다', async () => {
    run.mockResolvedValue({ kind: 'error', message: '서버 문구' })
    renderPanel()
    await clickChip('쉽게 풀어쓰기')
    expect(screen.getByRole('status')).toHaveTextContent('요청이 실패했어요')
  })
})
