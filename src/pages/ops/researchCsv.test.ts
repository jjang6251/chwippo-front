import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { buildResearchCsv, downloadCsv } from './researchCsv'
import type { ResearchExportRow } from '@/api/adminResearch'

/**
 * 내보내기 CSV — 이 파일이 깨지면 **조용히 잘못된 목록으로 조사를 돌린다.**
 * 화면은 멀쩡하고 파일만 틀리므로 회귀로 고정한다:
 *  ① BOM 없으면 엑셀에서 한글이 전부 깨진다
 *  ② 쉼표 포함 회사명(「CJ, 대한통운」)이 열을 밀어 지원자 수가 딴 회사에 붙는다
 *  ③ 첫 줄 범위 표기가 없으면 상한에 걸려 잘린 걸 파일만 봐선 알 수 없다
 */
const row = (over: Partial<ResearchExportRow> = {}): ResearchExportRow => ({
  companyName: '카카오',
  applicants: 3,
  cards: 5,
  ...over,
})

describe('buildResearchCsv', () => {
  // 🔴 ①
  it('BOM 으로 시작한다 (엑셀 한글 깨짐 방지)', () => {
    expect(buildResearchCsv([row()], '1개 전체').startsWith('﻿')).toBe(true)
  })

  // 🔴 ③
  it('첫 줄에 범위, 둘째 줄에 헤더', () => {
    const lines = buildResearchCsv([row()], '전체 1200개 중 상위 500개').split(
      '\r\n',
    )
    expect(lines[0]).toBe('﻿전체 1200개 중 상위 500개')
    expect(lines[1]).toBe('회사명,지원자,카드')
  })

  it('행은 회사명·지원자·카드 3열', () => {
    const lines = buildResearchCsv(
      [row({ companyName: '네이버', applicants: 2, cards: 4 })],
      'n',
    ).split('\r\n')
    expect(lines[2]).toBe('네이버,2,4')
  })

  /**
   * 🔴 **수식 주입 (CWE-1236) 의 선행문자 우회.** 아래 「수식으로 시작하는 회사명」 케이스가
   * `=` `+` `-` `@` 를 덮고 있는데, 가드 정규식에는 `\t` `\r` 도 들어 있다 — 엑셀이 선행
   * 공백류를 무시하고 뒤의 `=` 를 수식으로 읽기 때문이다. 그 두 글자만 검증이 비어 있었다.
   * 문자 클래스에서 조용히 빠져도 아무 테스트가 안 깨지는 상태였다 (2026-08-23 분기 실측).
   */
  it.each([
    ['탭', '\t=1+1'],
    ['캐리지리턴', '\r=1+1'],
  ])('🔴 %s 으로 시작해도 무력화한다 (선행문자 우회 차단)', (_, name) => {
    expect(buildResearchCsv([row({ companyName: name })], 'n')).toContain(
      `'${name}`,
    )
  })

  // 🔴 ②
  it('쉼표 포함 회사명은 큰따옴표로 감싼다 — 안 하면 열이 밀린다', () => {
    const csv = buildResearchCsv([row({ companyName: 'CJ, 대한통운' })], 'n')
    expect(csv).toContain('"CJ, 대한통운",3,5')
  })

  it('따옴표 포함 회사명은 이중화한다', () => {
    const csv = buildResearchCsv([row({ companyName: '주식회사 "가"' })], 'n')
    expect(csv).toContain('"주식회사 ""가""",3,5')
  })

  it('줄바꿈 포함 회사명도 한 셀에 가둔다', () => {
    const csv = buildResearchCsv([row({ companyName: '가\n나' })], 'n')
    expect(csv).toContain('"가\n나",3,5')
  })

  // 회사명은 사용자 자유 입력이고 이 파일은 엑셀에서 열린다 (CWE-1236)
  it.each(['=1+1', '+cmd', '-2', '@SUM(A1)'])(
    '수식으로 시작하는 회사명 %p 은 실행되지 않게 앞에 작은따옴표를 붙인다',
    (name) => {
      const csv = buildResearchCsv([row({ companyName: name })], 'n')
      expect(csv).toContain(`'${name},3,5`)
    },
  )

  it('평범한 회사명은 따옴표로 감싸지 않는다 (불필요한 인용 없음)', () => {
    expect(buildResearchCsv([row()], 'n')).toContain('\r\n카카오,3,5\r\n')
  })

  it('0건이어도 범위·헤더는 남는다 (빈 파일로 오해하지 않게)', () => {
    const lines = buildResearchCsv([], '0개').split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(2)
  })
})

describe('downloadCsv', () => {
  const createObjectURL = vi.fn(() => 'blob:mock')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('앵커로 내려받고 blob URL 을 되돌린다 (누수 방지)', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    click.mockImplementation(() => {})

    downloadCsv('a,b', '회사조사-미조사-2026-08-22.csv')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    // 앵커가 DOM 에 남으면 화면에 빈 링크가 쌓인다
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })
})
