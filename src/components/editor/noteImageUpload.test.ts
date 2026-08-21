/**
 * study-note-media PR-A — 업로드 파이프라인 spec (plan §4 「presigned 만료 재발급」·
 * 「placeholder→확정/실패」·「cap 초과 서버 문구」 줄).
 *
 * 시나리오 — 먼저 나열하고 그대로 구현한다:
 *   정상   1  압축 → presigned+PUT → 첨부 등록 → {src, attachmentId}
 *          2  scope 는 서버 화이트리스트 문자열 그대로 · 업로드 타입은 **압축 결과**를 따른다
 *          3  등록에 보내는 fileSizeBytes 는 압축 후 크기 (cap 집계가 이 값을 쓴다)
 *   재시도  4  🔴 presigned·PUT 실패 = **한 번만** 다시 발급 (그 다음 성공하면 정상 흐름)
 *          5  두 번 다 실패 = 안내 + 첨부 등록은 시도하지 않는다 (올라간 게 없다)
 *   보상    6  🔴 등록이 네트워크로 실패 = R2 고아를 우리가 지운다 (인터셉터 사각지대)
 *          7  🔴 인터셉터가 이미 처리한 실패(_toastShown)면 **다시 지우지도 띄우지도** 않는다
 *              — cap 초과 400 이 이 경로다 (서버 문구는 인터셉터가 이미 냈다)
 *   문구    8  서버 message 가 있으면 그대로 (generic 으로 뭉개지 않는다)
 *          9  압축 decode 실패 = 「jpg·png 로 변환」 안내 (HEIC)
 *         10  압축 too-large = 10MB 안내 · 업로드는 시작조차 안 한다
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteOwnFile, uploadFile } from '@/api/files'
import { createNoteAttachment } from '@/api/studyNotes'
import { useToastStore } from '@/stores/toastStore'
import { compressImage } from '@/utils/imageCompress'
import { STUDY_NOTE_IMAGE_SCOPE, uploadNoteImage } from './noteImageUpload'

vi.mock('@/api/files', () => ({
  uploadFile: vi.fn(),
  // 보상 삭제는 `.catch()` 로 삼켜진다 — 프로미스를 안 돌려주면 그 자리에서 터져 안내가 사라진다
  deleteOwnFile: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/api/studyNotes', () => ({
  createNoteAttachment: vi.fn(),
}))
vi.mock('@/utils/imageCompress', () => ({
  compressImage: vi.fn(),
}))

const mockedUpload = vi.mocked(uploadFile)
const mockedDelete = vi.mocked(deleteOwnFile)
const mockedRegister = vi.mocked(createNoteAttachment)
const mockedCompress = vi.mocked(compressImage)

const NOTE_ID = 'note-1'
const FILE_URL = 'https://cdn.example.com/study/abc.jpg'
/** 원본은 png 인데 압축이 jpeg 로 굽는다 — 실려 나가는 타입이 어느 쪽인지 보려고 일부러 다르게 */
const SOURCE = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' })

function compressed(size = 2048) {
  return {
    ok: true as const,
    blob: new Blob([new Uint8Array(size)], { type: 'image/jpeg' }),
    contentType: 'image/jpeg' as const,
  }
}

/** 인터셉터가 손대는 실패(4xx/5xx + fileUrl 추적) — 보상·토스트를 이미 끝낸 모양 */
function interceptedError(message: string) {
  return {
    config: { _toastShown: true },
    response: { status: 400, data: { message } },
  }
}

const toasts = () => useToastStore.getState().toasts.map((t) => t.message)

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  mockedCompress.mockResolvedValue(compressed())
  mockedUpload.mockResolvedValue({ fileUrl: FILE_URL, fileSize: 2048 })
  mockedRegister.mockResolvedValue({ id: 'att-1', fileUrl: FILE_URL })
})

describe('정상 흐름', () => {
  it('1 압축 → 업로드 → 등록 → src·attachmentId', async () => {
    await expect(uploadNoteImage(NOTE_ID, SOURCE)).resolves.toEqual({
      src: FILE_URL,
      attachmentId: 'att-1',
    })
    expect(toasts()).toEqual([])
    expect(mockedDelete).not.toHaveBeenCalled()
  })

  it('2 scope 고정 · 업로드 타입은 압축 결과를 따른다', async () => {
    await uploadNoteImage(NOTE_ID, SOURCE)

    const [scope, payload] = mockedUpload.mock.calls[0]
    expect(scope).toBe(STUDY_NOTE_IMAGE_SCOPE)
    expect(STUDY_NOTE_IMAGE_SCOPE).toBe('study-note/image')
    // 원본은 image/png 였다 — 서명에 실리는 건 압축 결과 타입이어야 한다
    expect(payload.type).toBe('image/jpeg')
  })

  it('3 등록 fileSizeBytes = 압축 후 크기', async () => {
    mockedUpload.mockResolvedValue({ fileUrl: FILE_URL, fileSize: 2048 })
    await uploadNoteImage(NOTE_ID, SOURCE)

    expect(mockedRegister).toHaveBeenCalledWith(NOTE_ID, {
      fileUrl: FILE_URL,
      fileSizeBytes: 2048,
    })
  })
})

describe('presigned 재발급', () => {
  it('4 🔴 실패하면 한 번만 다시 발급하고, 성공하면 정상 흐름', async () => {
    mockedUpload
      .mockRejectedValueOnce(new Error('expired'))
      .mockResolvedValueOnce({ fileUrl: FILE_URL, fileSize: 2048 })

    await expect(uploadNoteImage(NOTE_ID, SOURCE)).resolves.toMatchObject({ src: FILE_URL })
    expect(mockedUpload).toHaveBeenCalledTimes(2)
    expect(toasts()).toEqual([])
  })

  it('5 두 번 다 실패 = 안내 + 등록 시도 없음 (올라간 게 없다)', async () => {
    mockedUpload.mockRejectedValue(new Error('network'))

    await expect(uploadNoteImage(NOTE_ID, SOURCE)).rejects.toThrow()
    expect(mockedUpload).toHaveBeenCalledTimes(2)
    expect(mockedRegister).not.toHaveBeenCalled()
    expect(mockedDelete).not.toHaveBeenCalled()
    expect(toasts()).toEqual(['이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'])
  })
})

describe('등록 실패 — 보상 삭제', () => {
  it('6 🔴 네트워크 실패는 인터셉터 사각지대 — 우리가 고아를 지운다', async () => {
    mockedRegister.mockRejectedValue(new Error('Network Error'))

    await expect(uploadNoteImage(NOTE_ID, SOURCE)).rejects.toThrow()
    expect(mockedDelete).toHaveBeenCalledWith(FILE_URL)
    expect(toasts()).toEqual(['이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.'])
  })

  it('7 🔴 cap 초과 400 — 인터셉터가 끝냈으면 다시 지우지도 띄우지도 않는다', async () => {
    mockedRegister.mockRejectedValue(
      interceptedError('저장 공간이 부족해요. 사용하지 않는 파일을 지우고 다시 시도해 주세요.'),
    )

    await expect(uploadNoteImage(NOTE_ID, SOURCE)).rejects.toBeTruthy()
    // 인터셉터가 이미 DELETE /files 를 불렀다 — 두 번 지우면 없는 객체를 지운다
    expect(mockedDelete).not.toHaveBeenCalled()
    // 서버 문구도 인터셉터가 이미 띄웠다 — 여기서 더하면 같은 말이 두 번
    expect(toasts()).toEqual([])
  })

  it('8 서버 message 가 있으면 그대로 (generic 으로 뭉개지 않는다)', async () => {
    mockedRegister.mockRejectedValue({
      // _toastShown 이 없는 실패 = 인터셉터가 안 띄운 경우 (401 등)
      response: { status: 401, data: { message: '로그인이 만료되었어요.' } },
    })

    await expect(uploadNoteImage(NOTE_ID, SOURCE)).rejects.toBeTruthy()
    expect(toasts()).toEqual(['로그인이 만료되었어요.'])
    expect(mockedDelete).toHaveBeenCalledWith(FILE_URL)
  })
})

describe('압축 실패', () => {
  it('9 decode 실패 = 변환 안내 (HEIC)', async () => {
    mockedCompress.mockResolvedValue({ ok: false, reason: 'decode' })

    await expect(uploadNoteImage(NOTE_ID, SOURCE)).rejects.toThrow()
    expect(toasts()).toEqual(['이 형식은 브라우저가 열지 못했어요. jpg·png 로 변환해서 올려 주세요.'])
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  it('10 too-large = 10MB 안내 · 업로드 시작조차 안 한다', async () => {
    mockedCompress.mockResolvedValue({ ok: false, reason: 'too-large' })

    await expect(uploadNoteImage(NOTE_ID, SOURCE)).rejects.toThrow()
    expect(toasts()).toEqual(['이미지가 너무 커요. 10MB 이하로 줄여서 올려 주세요.'])
    expect(mockedUpload).not.toHaveBeenCalled()
    expect(mockedRegister).not.toHaveBeenCalled()
  })
})
