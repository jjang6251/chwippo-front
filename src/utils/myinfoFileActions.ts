/**
 * 파일 보관함에서 X 버튼 → "파일만" 제거 액션.
 * - 항목 row(자격증·상장 등)는 남기고 file_url·file_size_bytes만 null로 정리.
 * - 백엔드의 EmptyToNull 변환으로 빈 문자열이 null로 저장됨 + updateWithFileSwap이 R2 cleanup.
 *
 * 의존성을 인자로 받아 단위 테스트 가능하도록 분리.
 */

export type FileSourceKind = '학력' | '어학 자격증' | '자격증' | '수상 내역'

/**
 * 학력만 파일 칸이 셋이다 — 성적증명서 · 졸업(예정)증명서 · 옛 「기타 증빙」(구분 없이
 * 한 칸이던 시절 데이터). 어느 칸을 비울지 고르지 않으면 옛 칸을 비운다.
 */
export type EducationFileField = 'transcript' | 'graduation' | 'legacy'

/** 비울 칸만 담는다 — `Partial<Education>` 등에 그대로 넣을 수 있는 모양 */
export interface FileClearDto {
  file_url?: string
  file_size_bytes?: null
  transcript_file_url?: string
  transcript_file_size_bytes?: null
  graduation_file_url?: string
  graduation_file_size_bytes?: null
}

export interface FileClearUpdaters {
  updateEducation: (vars: { id: string; dto: FileClearDto }) => void
  updateLangCert: (vars: { id: string; dto: FileClearDto }) => void
  updateCert: (vars: { id: string; dto: FileClearDto }) => void
  updateAward: (vars: { id: string; dto: FileClearDto }) => void
}

function educationDto(field: EducationFileField): FileClearDto {
  if (field === 'transcript') {
    return { transcript_file_url: '', transcript_file_size_bytes: null }
  }
  if (field === 'graduation') {
    return { graduation_file_url: '', graduation_file_size_bytes: null }
  }
  return { file_url: '', file_size_bytes: null }
}

export function clearFileBySource(
  source: FileSourceKind,
  id: string,
  updaters: FileClearUpdaters,
  educationField: EducationFileField = 'legacy',
): void {
  const dto: FileClearDto = { file_url: '', file_size_bytes: null }
  switch (source) {
    case '학력':
      updaters.updateEducation({ id, dto: educationDto(educationField) })
      return
    case '어학 자격증':
      updaters.updateLangCert({ id, dto })
      return
    case '자격증':
      updaters.updateCert({ id, dto })
      return
    case '수상 내역':
      updaters.updateAward({ id, dto })
      return
  }
}
