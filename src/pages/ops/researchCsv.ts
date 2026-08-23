import type { ResearchExportRow } from '@/api/adminResearch'

/**
 * ops 「회사 조사 현황」 전체 내보내기 — CSV 생성.
 * (페이지 컴포넌트에서 분리한 이유는 react-refresh 제약 + 단위 테스트 용이성)
 */

/**
 * CSV 필드 이스케이프.
 * ① 쉼표·따옴표·줄바꿈이 든 회사명(「CJ, 대한통운」)은 큰따옴표로 감싸고 내부 " 를 이중화 —
 *    안 하면 열이 통째로 밀려 지원자 수가 엉뚱한 회사에 붙는다.
 * ② `=` `+` `-` `@` 로 시작하면 앞에 `'` 를 붙인다 — 회사명은 사용자 자유 입력이고
 *    이 파일은 엑셀에서 열린다 (수식 주입, CWE-1236).
 */
function csvField(value: string | number): string {
  const raw = String(value)
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/**
 * 내보내기 CSV 본문. 첫 줄에 **범위**를 적는다 — 상한에 걸려 잘렸는데 파일만 보면
 * 알 수 없는 상태가 최악이다 (조사 대상을 놓치고도 모른다).
 * 앞의 BOM 이 없으면 엑셀이 UTF-8 로 안 읽어 한글이 전부 깨진다.
 */
export function buildResearchCsv(
  rows: ResearchExportRow[],
  scopeNote: string,
): string {
  const lines = [
    csvField(scopeNote),
    ['회사명', '지원자', '카드'].join(','),
    ...rows.map((r) =>
      [csvField(r.companyName), r.applicants, r.cards].join(','),
    ),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
