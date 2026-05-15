/**
 * 파일 보관함에서 X 버튼 → "파일만" 제거 액션.
 * - 항목 row(자격증·상장 등)는 남기고 file_url·file_size_bytes만 null로 정리.
 * - 백엔드의 EmptyToNull 변환으로 빈 문자열이 null로 저장됨 + updateWithFileSwap이 R2 cleanup.
 *
 * 의존성을 인자로 받아 단위 테스트 가능하도록 분리.
 */

export type FileSourceKind = '학력' | '어학 자격증' | '자격증' | '수상 내역'

export interface FileClearUpdaters {
  updateEducation: (vars: { id: string; dto: { file_url: string; file_size_bytes: null } }) => void
  updateLangCert: (vars: { id: string; dto: { file_url: string; file_size_bytes: null } }) => void
  updateCert: (vars: { id: string; dto: { file_url: string; file_size_bytes: null } }) => void
  updateAward: (vars: { id: string; dto: { file_url: string; file_size_bytes: null } }) => void
}

export function clearFileBySource(
  source: FileSourceKind,
  id: string,
  updaters: FileClearUpdaters,
): void {
  const dto: { file_url: string; file_size_bytes: null } = {
    file_url: '',
    file_size_bytes: null,
  }
  switch (source) {
    case '학력':
      updaters.updateEducation({ id, dto })
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
