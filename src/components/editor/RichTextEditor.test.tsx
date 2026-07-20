/**
 * card-detail-remodel — 공용 RichTextEditor 저장 계약 spec.
 * 빈 문서면 '' 전송(껍데기 JSON 저장 방지 회귀), 내용 있으면 tiptap JSON 문자열. 1.5s debounce 자동 저장.
 */
import { render, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Editor } from '@tiptap/react'
import { RichTextEditor } from './RichTextEditor'

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

function setup() {
  const onSave = vi.fn().mockResolvedValue(undefined)
  let editor: Editor | null = null
  render(
    <RichTextEditor
      initialContent={null}
      onSave={onSave}
      placeholder="ph"
      minHeightClass="min-h-[80px]"
      characterLimit={2000}
      header={(e) => { editor = e; return null }}
    />,
  )
  return { onSave, editor: editor as unknown as Editor }
}

describe('RichTextEditor — 자동 저장 계약', () => {
  it('내용 입력 → 1.5s 후 tiptap JSON 저장', async () => {
    const { onSave, editor } = setup()
    act(() => { editor.commands.insertContent('회사 문화 좋음') })
    await wait(1600)
    expect(onSave).toHaveBeenCalledTimes(1)
    const val = onSave.mock.calls[0][0] as string
    expect(val).not.toBe('')
    expect(JSON.parse(val).type).toBe('doc')
  })

  it('내용 비우면 "" 저장 (빈 껍데기 JSON 저장 방지)', async () => {
    const { onSave, editor } = setup()
    act(() => { editor.commands.insertContent('임시') })
    await wait(1600)
    onSave.mockClear()
    act(() => { editor.commands.clearContent(true) }) // emitUpdate=true
    await wait(1600)
    expect(onSave).toHaveBeenCalledWith('')
  })

  it('1.5s 전에는 저장 안 함 (debounce)', async () => {
    const { onSave, editor } = setup()
    act(() => { editor.commands.insertContent('a') })
    await wait(1000)
    expect(onSave).not.toHaveBeenCalled()
    await wait(700)
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
