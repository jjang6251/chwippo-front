/**
 * fileSlot 유틸 테스트 — 지연 업로드 패턴 핵심 로직 검증.
 *
 * 시나리오 (r2-storage-cap.md 10-B):
 * T-DU-4: pending → uploadFile 호출 후 fileUrl/fileSize 반환
 * T-DU-5: existing → 그대로 반환, uploadFile 미호출
 * T-DU-6: empty → null·null 반환
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EMPTY_SLOT, resolveFileForSubmit, slotFromExisting } from './fileSlot'

vi.mock('@/api/files', () => ({
  uploadFile: vi.fn(),
}))

import { uploadFile } from '@/api/files'

const mockedUploadFile = vi.mocked(uploadFile)

describe('fileSlot utils', () => {
  beforeEach(() => {
    mockedUploadFile.mockReset()
  })

  describe('slotFromExisting', () => {
    it('url=null → empty slot', () => {
      expect(slotFromExisting(null, 100)).toEqual(EMPTY_SLOT)
    })

    it('url=undefined → empty slot', () => {
      expect(slotFromExisting(undefined, undefined)).toEqual(EMPTY_SLOT)
    })

    it('url=빈 문자열 → empty slot', () => {
      expect(slotFromExisting('', null)).toEqual(EMPTY_SLOT)
    })

    it('url 있고 size 있음 → existing slot', () => {
      expect(slotFromExisting('https://r2/file.pdf', 1024)).toEqual({
        kind: 'existing',
        url: 'https://r2/file.pdf',
        size: 1024,
      })
    })

    it('url 있고 size null → existing slot, size=null', () => {
      expect(slotFromExisting('https://r2/file.pdf', null)).toEqual({
        kind: 'existing',
        url: 'https://r2/file.pdf',
        size: null,
      })
    })
  })

  describe('resolveFileForSubmit', () => {
    it('empty → { null, null }, uploadFile 미호출 (T-DU-6)', async () => {
      const result = await resolveFileForSubmit({ kind: 'empty' }, 'myinfo/cert')
      expect(result).toEqual({ file_url: null, file_size_bytes: null })
      expect(mockedUploadFile).not.toHaveBeenCalled()
    })

    it('existing → 그대로 반환, uploadFile 미호출 (T-DU-5)', async () => {
      const slot = {
        kind: 'existing' as const,
        url: 'https://r2/cert.pdf',
        size: 2048,
      }
      const result = await resolveFileForSubmit(slot, 'myinfo/cert')
      expect(result).toEqual({
        file_url: 'https://r2/cert.pdf',
        file_size_bytes: 2048,
      })
      expect(mockedUploadFile).not.toHaveBeenCalled()
    })

    it('pending → uploadFile 호출 후 결과 반환 (T-DU-4)', async () => {
      const file = new File(['x'], 'test.pdf', { type: 'application/pdf' })
      mockedUploadFile.mockResolvedValue({
        fileUrl: 'https://r2/new.pdf',
        fileSize: 1024,
      })

      const result = await resolveFileForSubmit(
        { kind: 'pending', file },
        'myinfo/cert',
      )

      expect(mockedUploadFile).toHaveBeenCalledWith('myinfo/cert', file)
      expect(result).toEqual({
        file_url: 'https://r2/new.pdf',
        file_size_bytes: 1024,
      })
    })

    it('pending + uploadFile 실패 → 예외 전파 (호출자가 catch)', async () => {
      const file = new File(['x'], 'fail.pdf', { type: 'application/pdf' })
      mockedUploadFile.mockRejectedValue(new Error('R2 down'))

      await expect(
        resolveFileForSubmit({ kind: 'pending', file }, 'myinfo/cert'),
      ).rejects.toThrow('R2 down')
    })
  })
})
