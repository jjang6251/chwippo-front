/**
 * clearFileBySource 테스트
 *
 * 시나리오 (r2-storage-cap.md 10-A UX-5):
 * - 보관함 X → "파일만" 제거 (항목 row는 남음)
 * - 빈 문자열 file_url + null file_size_bytes로 PATCH
 * - source에 따라 적절한 update mutation 호출 (delete 아님)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearFileBySource } from './myinfoFileActions'
import type { FileClearUpdaters, FileSourceKind } from './myinfoFileActions'

type UpdateFn = FileClearUpdaters['updateEducation']

function makeUpdaters(): FileClearUpdaters & Record<keyof FileClearUpdaters, ReturnType<typeof vi.fn>> {
  return {
    updateEducation: vi.fn<UpdateFn>(),
    updateLangCert: vi.fn<UpdateFn>(),
    updateCert: vi.fn<UpdateFn>(),
    updateAward: vi.fn<UpdateFn>(),
  }
}

describe('clearFileBySource (UX-5: 보관함 X = 파일만 제거)', () => {
  let updaters: ReturnType<typeof makeUpdaters>

  beforeEach(() => {
    updaters = makeUpdaters()
  })

  it.each<[FileSourceKind, keyof FileClearUpdaters]>([
    ['학력', 'updateEducation'],
    ['어학 자격증', 'updateLangCert'],
    ['자격증', 'updateCert'],
    ['수상 내역', 'updateAward'],
  ])(
    'source="%s" → %s만 호출되고 다른 도메인 mutation은 호출 안 됨',
    (source, expectedFn) => {
      clearFileBySource(source, 'item-id-1', updaters)
      expect(updaters[expectedFn]).toHaveBeenCalledTimes(1)
      const otherFns: (keyof FileClearUpdaters)[] = [
        'updateEducation',
        'updateLangCert',
        'updateCert',
        'updateAward',
      ]
      for (const fn of otherFns) {
        if (fn !== expectedFn) {
          expect(updaters[fn]).not.toHaveBeenCalled()
        }
      }
    },
  )

  it('dto는 { file_url: "", file_size_bytes: null } 형태 — 백엔드 EmptyToNull 변환 가능', () => {
    clearFileBySource('자격증', 'cert-1', updaters)
    expect(updaters.updateCert).toHaveBeenCalledWith({
      id: 'cert-1',
      dto: { file_url: '', file_size_bytes: null },
    })
  })

  /**
   * 🔴 학력만 파일 칸이 셋이다 (성적증명서 · 졸업(예정)증명서 · 옛 「기타 증빙」).
   * 칸을 안 고르면 옛 칸을 비운다 — 새 칸을 비우려던 호출이 엉뚱한 파일을 지우면 안 된다.
   */
  it.each<['transcript' | 'graduation' | 'legacy', Record<string, string | null>]>([
    ['transcript', { transcript_file_url: '', transcript_file_size_bytes: null }],
    ['graduation', { graduation_file_url: '', graduation_file_size_bytes: null }],
    ['legacy', { file_url: '', file_size_bytes: null }],
  ])('학력 %s → 그 칸만 비운다', (field, dto) => {
    clearFileBySource('학력', 'edu-1', updaters, field)
    expect(updaters.updateEducation).toHaveBeenCalledWith({ id: 'edu-1', dto })
  })

  it('학력 — 칸을 안 고르면 옛 「기타 증빙」을 비운다', () => {
    clearFileBySource('학력', 'edu-1', updaters)
    expect(updaters.updateEducation).toHaveBeenCalledWith({
      id: 'edu-1',
      dto: { file_url: '', file_size_bytes: null },
    })
  })

  it('각 source는 동일한 dto 패턴 사용 — 일관성 보장', () => {
    clearFileBySource('학력', 'edu-1', updaters)
    clearFileBySource('어학 자격증', 'lang-1', updaters)
    clearFileBySource('자격증', 'cert-1', updaters)
    clearFileBySource('수상 내역', 'award-1', updaters)

    const expectedDto = { file_url: '', file_size_bytes: null }
    expect(updaters.updateEducation).toHaveBeenCalledWith({
      id: 'edu-1',
      dto: expectedDto,
    })
    expect(updaters.updateLangCert).toHaveBeenCalledWith({
      id: 'lang-1',
      dto: expectedDto,
    })
    expect(updaters.updateCert).toHaveBeenCalledWith({
      id: 'cert-1',
      dto: expectedDto,
    })
    expect(updaters.updateAward).toHaveBeenCalledWith({
      id: 'award-1',
      dto: expectedDto,
    })
  })
})
