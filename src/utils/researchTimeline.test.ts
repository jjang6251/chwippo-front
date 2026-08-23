/**
 * 회사 조사 서식 파서 4종 — 타임라인 · 번호 목록 · 가치 목록 · 인용 선언문.
 *
 * 🔴 픽스처는 **실제 시드 원문**(`data-seeds/company-research-seed-2026-08.1.json`)에서 잘라 왔다.
 * 내가 지어낸 서식으로는 내 전제를 검증할 수 없다 — 실측 분포(352개사)는
 * `recentTrends` 기준 `1)` 290 · 날짜로 시작 44 · `①` 15 · 패턴 없음 2,
 * `coreValues` 기준 괄호 나열 65 · **번호형 2**, `visionMission` 기준 인용부호 169.
 *
 * 시나리오:
 *  1. 서식 3종 — `1)` · `①` · `① (날짜 발표)` 괄호형 · 슬래시 구분
 *  2. 날짜 없는 산문 → null (원문 문단으로 떨어뜨리기 위해)
 *  3. 빈 값 4종 (undefined · null · '' · 공백)
 *  4. 오탐 방어 — 도입 문장 있음 · 번호가 1부터가 아님 · 마커 1개 · 날짜 소수
 *  5. 날짜 추출 경계 — `2026년 하반기` 에서 연도만 떼가지 않는다 · `(KST)` 꼬리 · `2025년 이후`
 *  6. 🔴 **본문 유실 0** — 항목 텍스트는 전부 원문 안에 있어야 한다
 *  7. `parseNumberedList` — 날짜 없는 번호형(`differentiators`)은 목록으로만
 *  8. `parseValueList` — 괄호 나열 · 머리말 분리 · 꼬리 주석 · `·` 구분 · 번호형(네이버·더존)
 *  9. `parseValueList` 오탐 방어 — 산문 · 항목 2개 · 긴 이름 · 두 그룹 혼재 → 원문 문단
 * 10. `parseQuotedStatements` — 라벨+인용 · 인용 선두 · 꼬리 rest · `그룹` 라벨 보존
 * 11. `parseQuotedStatements` 오탐 방어 — 인용부호 없음 · 문장 속 인용(조사 연결) · 라벨만
 * 12. 🔴 두 파서 모두 **본문 유실 0**
 */
import { describe, it, expect } from 'vitest'
import {
  parseNumberedList,
  parseQuotedStatements,
  parseTimeline,
  parseValueList,
} from './researchTimeline'

// 실측 원문 (네이버 · 삼성전자 · 셀트리온 · CJ제일제당 · 하이브 · 크래프톤) — 길이만 줄였다
const PAREN_NUM = `1) 2026-04-28 발표: AI 검색 서비스 'AI탭' 베타 출시(네이버플러스 멤버십 대상). 2) 2026-04-30 1분기 실적발표: 매출 3조2,411억원(전년 동기 대비 +16.3%). 3) 2025-02-20 발표: 저비용·고성능 하이퍼클로바X 신모델 공개.`
const PAREN_NUM_KST = `1) 2026-02-26(KST) '갤럭시 언팩 2026' 개최. 2) 2026-04-30 발표, 1분기 연결 매출 133.9조원. 3) 2026-06-29 발표, 호남권에 425조원 규모 투자 계획 공표.`
const CIRCLED = `① 2026-07-01: 트룩시마가 FDA 상호교환성 지위를 획득. ② 2026-01-02: 일라이릴리의 미국 생산시설 인수를 완료. ③ 2026-03-18: 짐펜트라 처방량이 213% 증가.`
const CIRCLED_PAREN = `① (2026-07-01 발표) 기존 '식품·바이오' 이원 구조를 3대 부문으로 전면 재편. ② (2026-02-09 실적발표) 2025년 해외식품 매출이 5조9,247억원으로 역대 최고치. ③ (2026-06-12 발표) 인터브랜드 국내 22위.`
const SLASHED = `2026-05: 하이브가 새 미션·비전과 브랜드 아이덴티티를 전면 개편. / 2026-02: 2025년 연결 매출 2조 6,499억 원으로 역대 최대 달성 발표. / 2025년 이후: 미국·일본·인도 지사를 신설하는 등 멀티 레이블 전략을 해외로 확대.`
const PROSE = `2025년 연간 매출 3조 3,266억 원(+22.8%)으로 창사 최대 실적을 냈고, 2026년 1분기에도 역대 최대 분기를 경신했습니다(2026-05 발표). 장기수명주기 IP 확장과 AI 기반 제작 혁신을 2026년 방향으로 공표했습니다.`
const NO_DATE_NUMBERED = `1) 메모리반도체와 파운드리를 모두 보유한 종합반도체회사(IDM)로 수직계열화된 사업구조를 갖춤. 2) 반도체와 세트 사업을 동시에 운영해 사업 포트폴리오 다각화로 상대적 안정성을 확보. 3) 국내 대규모 신규 생산거점 투자를 지속.`

describe('parseTimeline — 서식 3종 + 슬래시', () => {
  it('1-a) `1)` 번호형 — 날짜를 배지로 뽑고 본문만 남긴다', () => {
    const entries = parseTimeline(PAREN_NUM)!
    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.date)).toEqual(['2026-04-28', '2026-04-30', '2025-02-20'])
    expect(entries[0].text).toBe(
      "발표: AI 검색 서비스 'AI탭' 베타 출시(네이버플러스 멤버십 대상).",
    )
    // 번호 마커는 본문에 남지 않는다
    expect(entries.some((e) => /^\d\)/.test(e.text))).toBe(false)
  })

  it('1-b) `(KST)` 꼬리는 날짜 뒤에서 걷어낸다', () => {
    const entries = parseTimeline(PAREN_NUM_KST)!
    expect(entries[0].date).toBe('2026-02-26')
    expect(entries[0].text).toBe("'갤럭시 언팩 2026' 개최.")
  })

  it('1-c) `①` 번호형', () => {
    const entries = parseTimeline(CIRCLED)!
    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.date)).toEqual(['2026-07-01', '2026-01-02', '2026-03-18'])
    expect(entries[0].text).toBe('트룩시마가 FDA 상호교환성 지위를 획득.')
  })

  it('1-d) `① (2026-07-01 발표)` 괄호형 — 괄호 머리를 통째로 걷어낸다', () => {
    const entries = parseTimeline(CIRCLED_PAREN)!
    expect(entries.map((e) => e.date)).toEqual(['2026-07-01', '2026-02-09', '2026-06-12'])
    expect(entries[0].text).toBe("기존 '식품·바이오' 이원 구조를 3대 부문으로 전면 재편.")
    expect(entries[0].text).not.toContain('발표)')
  })

  it('1-e) 번호 없이 ` / ` 로 나뉜 날짜형 — `2025년 이후` 같은 느슨한 날짜도 받는다', () => {
    const entries = parseTimeline(SLASHED)!
    expect(entries).toHaveLength(3)
    expect(entries.map((e) => e.date)).toEqual(['2026-05', '2026-02', '2025년 이후'])
    expect(entries[2].text.startsWith('미국')).toBe(true)
  })
})

describe('parseTimeline — 타임라인이 아니면 null (원문 문단으로 떨어진다)', () => {
  it('2) 날짜가 문장 끝 괄호에만 있는 산문', () => {
    expect(parseTimeline(PROSE)).toBeNull()
  })

  it('3) 빈 값 4종', () => {
    expect(parseTimeline(undefined)).toBeNull()
    expect(parseTimeline(null)).toBeNull()
    expect(parseTimeline('')).toBeNull()
    expect(parseTimeline('   \n ')).toBeNull()
  })

  it('4-a) 번호 목록이어도 날짜가 없으면 타임라인이 아니다', () => {
    expect(parseTimeline(NO_DATE_NUMBERED)).toBeNull()
  })

  it('4-b) 날짜가 절반에 못 미치면 null — 빈 배지가 줄줄이 서느니 문단이 낫다', () => {
    const mixed = '1) 2026-01-02 인수를 완료. 2) 사업 구조를 재편. 3) 국내 투자를 지속.'
    expect(parseTimeline(mixed)).toBeNull()
  })

  it('4-c) 도입 문장이 앞에 있으면 손대지 않는다 (그 문장을 잃는다)', () => {
    const withLead = `최근 행보는 다음과 같다. 1) 2026-04-28 발표: AI탭 출시. 2) 2026-04-30 실적 발표.`
    expect(parseTimeline(withLead)).toBeNull()
  })

  it('4-d) 번호가 1부터 순서대로가 아니면 본문 속 우연한 `2)` 다', () => {
    const notList = '2) 2026-04-28 첫 항목. 3) 2026-05-01 둘째 항목.'
    expect(parseTimeline(notList)).toBeNull()
  })

  it('4-e) 마커가 하나뿐이면 목록이 아니다', () => {
    expect(parseTimeline('1) 2026-04-28 발표: 단일 항목뿐이다.')).toBeNull()
  })

  it('4-f) 슬래시가 2토막이면 문장 속 슬래시일 수 있어 받지 않는다', () => {
    expect(parseTimeline('2026-05: 앞 문장이다. / 2026-02: 뒤 문장이다.')).toBeNull()
  })
})

describe('parseTimeline — 날짜 추출 경계', () => {
  it('5-a) `2026년 하반기` 에서 연도만 떼어내 본문을 「년 하반기」로 시작시키지 않는다', () => {
    const raw =
      '1) 2026년 하반기 차세대 본더 출시 계획. 2) 2027년 하이브리드 본더 출시 계획.'
    const entries = parseTimeline(raw)!
    expect(entries[0].date).toBe('2026년')
    expect(entries[0].text).toBe('하반기 차세대 본더 출시 계획.')
  })

  it('5-b) `2026.02.26` 점 표기도 하이픈으로 정규화', () => {
    const raw = '1) 2026.02.26 언팩 개최. 2) 2026.04.30 실적 발표.'
    expect(parseTimeline(raw)!.map((e) => e.date)).toEqual(['2026-02-26', '2026-04-30'])
  })

  it('5-c) 날짜 말고 본문이 남지 않으면 날짜로 보지 않는다', () => {
    const raw = '1) 2026-01-02. 2) 2026-03-18 짐펜트라 처방량 증가.'
    // 첫 항목은 본문이 비어 date=null → 날짜 있는 항목이 1개뿐이라 타임라인 성립 안 함
    expect(parseTimeline(raw)).toBeNull()
  })
})

describe('parseTimeline — 본문 유실 0', () => {
  it('6) 모든 서식에서 항목 텍스트가 원문 안에 그대로 있다', () => {
    for (const raw of [PAREN_NUM, PAREN_NUM_KST, CIRCLED, CIRCLED_PAREN, SLASHED]) {
      for (const e of parseTimeline(raw)!) {
        expect(raw).toContain(e.text)
        expect(e.text.length).toBeGreaterThan(5)
      }
    }
  })
})

describe('parseNumberedList — 날짜 없는 번호형(differentiators)', () => {
  it('7-a) 번호 마커를 떼고 항목 배열로', () => {
    const items = parseNumberedList(NO_DATE_NUMBERED)!
    expect(items).toHaveLength(3)
    expect(items[0].startsWith('메모리반도체와')).toBe(true)
    expect(items.some((t) => /^\d\)/.test(t))).toBe(false)
  })

  it('7-b) `①` 형도 같은 결과', () => {
    const items = parseNumberedList('① 첫 번째 차별점이다. ② 두 번째 차별점이다.')!
    expect(items).toEqual(['첫 번째 차별점이다.', '두 번째 차별점이다.'])
  })

  it('7-c) 번호가 없는 산문·빈 값은 null (원문 문단으로 떨어진다)', () => {
    expect(parseNumberedList(PROSE)).toBeNull()
    expect(parseNumberedList('')).toBeNull()
    expect(parseNumberedList(null)).toBeNull()
  })
})

// ── coreValues — 실측 원문 (삼성전자·현대차·토스·카카오·하이브·네이버·더존비즈온 등) ──
const CV_PAREN = `인재제일(기업은 사람이라는 신념으로 인재를 소중히 여기고 능력 발휘 기회 제공), 최고지향(끊임없는 열정과 도전정신으로 세계 최고를 추구), 변화선도(신속·주도적으로 변화와 혁신을 실행), 정도경영(곧은 마음과 바른 행동으로 정도를 추구), 상생추구(지역사회·국가·인류의 공동 번영을 위해 노력) — 삼성전자 공식 5대 핵심가치`
const CV_LEAD = `5대 핵심가치 — 고객 최우선(최고 품질·서비스로 고객감동 문화 조성), 도전적 실행(현실에 안주하지 않고 새로운 가능성에 도전), 소통과 협력(부문·협력사 간 소통으로 시너지 창출), 인재 존중(구성원 역량 개발과 인재존중 문화), 글로벌 지향(다양성 존중, 글로벌 최고 지향)`
const CV_TOSS = `고객중심(Customer Centric), 탁월함(Excellence), 책임감(Integrity), 상호존중(Respect), 사명감(Mission driven Mindset) — 비바리퍼블리카 공식 5대 핵심가치`
const CV_SHORT = `주도성, 협업, 문제해결, 사용자 이해 (카카오 채용 공식 페이지 기준)`
const CV_LABEL = `인재상: 유저중심, 라이브서비스 감각, 실행력, 데이터 기반 개선 (넥슨 채용 공식 페이지 기준)`
const CV_DOTS = `열정(Passion)·자율(Autonomy)·신뢰(Trust) — 이른바 '하이브 DNA' 3대 핵심가치.`
const CV_DOT_IN_ITEM = `고객가치 최우선, 인사이트, 민첩, 치밀·철저, 열린 협업 (LG디스플레이 행동방식)`
const CV_CIRCLED = `네이버 채용 공식 페이지 기준 4가지 핵심가치 — ① 기술로 연결합니다(세상의 무한한 가능성을 연결) ② 다양성을 이끌어 냅니다(누구나 쉽게 창작하고 더 많은 사람과 연결되는 생태계) ③ 비즈니스를 꽃피우게 합니다(기술과 데이터로 사업 성장을 지원) ④ 시대를 기록합니다(방대한 데이터를 안전하게 보존해 미래에 전달). 슬로건은 '모든 이의 더 나은 가능성을 만듭니다'.`
const CV_NUMBERED = `3대 경영이념 — 1) 도전과 열정: 현재에 안주하지 않고 두려움 없이 더 큰 목표를 추진 2) 소통과 화합: 활발한 소통으로 공감대를 형성하고 부서간 협력으로 시너지 극대화 3) 책임과 신뢰: 책임감을 갖고 정직하고 공정하게 경쟁`
// 오탐 후보 — 전부 원문 문단으로 떨어져야 한다
const CV_PROSE_KOLMAR = `윤리경영과 환경경영을 기반으로 한 건강한 기업문화. 슬로건은 '인류의 건강과 아름다움을 위하여, Let's Kolmar!'`
const CV_PROSE_KRAFTON = `게임 제작의 명가를 지향하며 도전과 몰입, 제작자 중심 문화를 강조합니다.`
const CV_PROSE_NH = `농협 3대 핵심가치 '농심', '현장', '공감'을 기반으로 정직과 신뢰, 고객 중심의 사고와 행동을 추구`
const CV_PROSE_SAMSUNGLIFE = `'고객을 위한 변화와 도전' 모토 아래 상생의 길(고객), 소통의 길(현장), 가치의 길(장기성장), 도전의 길, 정도의 길(준법)을 핵심가치로 제시`
const CV_TWO_GROUPS = `CJ그룹 공통 행동원칙: 정직, 열정, 창의, 존중 / 핵심가치: 온리원(ONLYONE, 최초·최고·차별화)`

describe('parseValueList — 8) 목록으로 읽힌다', () => {
  it('8-a) 🔴 주 패턴 = 쉼표+괄호형 — 이름과 부연을 나누고 꼬리 주석을 뗀다 (삼성전자)', () => {
    const p = parseValueList(CV_PAREN)!
    expect(p.lead).toBeNull()
    expect(p.items).toHaveLength(5)
    expect(p.items[0]).toEqual({
      name: '인재제일',
      note: '기업은 사람이라는 신념으로 인재를 소중히 여기고 능력 발휘 기회 제공',
    })
    expect(p.items[2].name).toBe('변화선도') // 부연 안의 `·` 로 쪼개지지 않는다
    expect(p.tail).toBe('삼성전자 공식 5대 핵심가치')
  })

  it('8-b) 🔴 `— ` 앞 도입구는 목록 항목이 아니다 (현대자동차)', () => {
    const p = parseValueList(CV_LEAD)!
    expect(p.lead).toBe('5대 핵심가치')
    expect(p.items.map((i) => i.name)).toEqual([
      '고객 최우선',
      '도전적 실행',
      '소통과 협력',
      '인재 존중',
      '글로벌 지향',
    ])
    expect(p.items[4].note).toBe('다양성 존중, 글로벌 최고 지향') // 괄호 안 쉼표는 안 자른다
    expect(p.tail).toBeNull()
  })

  it('8-c) 같은 서식인데 꼬리에 주석 (토스)', () => {
    const p = parseValueList(CV_TOSS)!
    expect(p.items).toHaveLength(5)
    expect(p.items[0]).toEqual({ name: '고객중심', note: 'Customer Centric' })
    expect(p.tail).toBe('비바리퍼블리카 공식 5대 핵심가치')
  })

  it('8-d) 부연 없는 단문 나열 — 이름이 전부 짧으면 목록이다 (카카오)', () => {
    const p = parseValueList(CV_SHORT)!
    expect(p.items.map((i) => i.name)).toEqual(['주도성', '협업', '문제해결', '사용자 이해'])
    expect(p.items.every((i) => i.note === null)).toBe(true)
    // 🔴 괄호 앞 **공백**이 부연과 꼬리 주석을 가른다
    expect(p.tail).toBe('카카오 채용 공식 페이지 기준')
  })

  it('8-e) 머리 라벨(`인재상:`)도 도입구로 뗀다 (넥슨)', () => {
    const p = parseValueList(CV_LABEL)!
    expect(p.lead).toBe('인재상')
    expect(p.items).toHaveLength(4)
    expect(p.tail).toBe('넥슨 채용 공식 페이지 기준')
  })

  it('8-f) `·` 구분 — 최상위 쉼표가 없을 때만 (하이브)', () => {
    const p = parseValueList(CV_DOTS)!
    expect(p.items).toEqual([
      { name: '열정', note: 'Passion' },
      { name: '자율', note: 'Autonomy' },
      { name: '신뢰', note: 'Trust' },
    ])
    expect(p.tail).toContain('하이브 DNA')
  })

  it('8-g) 🔴 `치밀·철저` 는 한 항목이다 — 쉼표가 있으면 `·` 로 자르지 않는다 (LG디스플레이)', () => {
    const p = parseValueList(CV_DOT_IN_ITEM)!
    expect(p.items.map((i) => i.name)).toEqual([
      '고객가치 최우선',
      '인사이트',
      '민첩',
      '치밀·철저',
      '열린 협업',
    ])
  })

  it('8-h) 🔴 번호형 `①` — 352개 중 1건이지만 실데이터로 잠근다 (네이버)', () => {
    const p = parseValueList(CV_CIRCLED)!
    expect(p.lead).toBe('네이버 채용 공식 페이지 기준 4가지 핵심가치')
    expect(p.items).toHaveLength(4)
    expect(p.items[0]).toEqual({ name: '기술로 연결합니다', note: '세상의 무한한 가능성을 연결' })
    // 마지막 항목 뒤에 붙은 별도 문장은 항목이 아니라 꼬리다
    expect(p.items[3]).toEqual({
      name: '시대를 기록합니다',
      note: '방대한 데이터를 안전하게 보존해 미래에 전달',
    })
    expect(p.tail).toBe("슬로건은 '모든 이의 더 나은 가능성을 만듭니다'.")
  })

  it('8-i) 번호형 `1)` + 콜론 부연 (더존비즈온)', () => {
    const p = parseValueList(CV_NUMBERED)!
    expect(p.lead).toBe('3대 경영이념')
    expect(p.items[0]).toEqual({
      name: '도전과 열정',
      note: '현재에 안주하지 않고 두려움 없이 더 큰 목표를 추진',
    })
    expect(p.items).toHaveLength(3)
  })
})

describe('parseValueList — 9) 🔴 오탐 방어 (원문 문단으로 떨어진다)', () => {
  const cases: Array<[string, string]> = [
    ['산문 — 슬로건 한 문장 (한국콜마)', CV_PROSE_KOLMAR],
    ['산문 — 쉼표가 있어도 문장이다 (크래프톤)', CV_PROSE_KRAFTON],
    ['산문 — 이름이 길고 부연이 없다 (NH농협은행)', CV_PROSE_NH],
    ['산문 — 목록이 문장에 싸여 있다 (삼성생명)', CV_PROSE_SAMSUNGLIFE],
    ['두 그룹이 ` / ` 로 섞여 있다 (CJ ENM)', CV_TWO_GROUPS],
  ]
  it.each(cases)('9-a) %s', (_label, raw) => {
    expect(parseValueList(raw)).toBeNull()
  })

  it('9-b) 항목이 2개뿐이면 목록이 아니다', () => {
    expect(parseValueList('자율과 책임, 배려와 존중을 우선시하는 조직 문화')).toBeNull()
  })

  it('9-c) 빈 값 4종', () => {
    expect(parseValueList(undefined)).toBeNull()
    expect(parseValueList(null)).toBeNull()
    expect(parseValueList('')).toBeNull()
    expect(parseValueList('   \n ')).toBeNull()
  })

  it('9-d) 이름 안에 짝 없는 따옴표가 남으면 잘못 끊은 것이다 (케이씨씨)', () => {
    expect(
      parseValueList("인재상은 'Knowledge(전문지식), Challenge(창의·도전), Courage(정직·책임)'"),
    ).toBeNull()
  })
})

// ── visionMission — 실측 원문 ────────────────────────────────────────
const VM_LABELS = `비전: '세상의 무한한 가능성을 연결합니다'. 미션: '네이버는 연결합니다, 현재와 미래를.'`
const VM_SLASH = `미션: "더 많은 환자가, 더 많은 사람들이 치료받을 수 있는 건강한 내일을 만들어갑니다" / 비전: "세계 모든 사람들이 더 많은 치료 기회를 보장받을 수 있는 방법을 모색합니다"`
const VM_ONE = `경영철학: "창의적 사고와 끝없는 도전을 통해 새로운 미래를 창조함으로써 인류 사회의 꿈을 실현한다"`
const VM_QUOTE_LEAD = `'문 앞으로 배달되는 일상의 행복을' — 배민1(빠른 자체배달), B마트(온라인 장보기), 배민스토어를 통해 세상 모든 상품을 문 앞으로 배달하는 것을 지향한다.`
const VM_SOURCE_NOTE = `비전: '단순한 건설을 넘어 인류의 꿈과 지속 가능한 미래를 설계' (공식, hdec.kr)`
const VM_GROUP = `그룹 비전 'Lifetime Value Creator'(고객에게 전 생애주기에 걸쳐 최고의 가치를 제공). 미션: '사랑과 신뢰를 받는 제품과 서비스를 제공하여 인류의 풍요로운 삶에 기여한다'`
const VM_MIXED = `비전: 'Beyond the Best' — 최고의 금융회사로 인정받는 것. 미션: 인재와 기술을 바탕으로 최고의 상품·서비스를 만들어 인류사회에 공헌하는 글로벌 프리미어 기업이 되는 것.`
const VM_REST = `비전: '건강, 즐거움, 편리를 창조하는 글로벌 생활문화기업' / 미션: 'ONLYONE 제품과 서비스로 최고의 가치를 창출하여 국가 사회에 기여한다'. 식품사업부문 미션은 '더 좋은 음식을 공유하고 New Wellness를 만들어간다'`
// 오탐 후보
const VM_NO_QUOTE = `인재와 기술을 바탕으로 최고의 제품과 서비스를 창출하여 인류사회에 공헌한다 (삼성전자 공식 경영이념)`
const VM_NO_QUOTE2 = `금융 경험 혁신을 가장 중요한 목표로 삼아 자율과 책임의 원칙 아래 서비스를 만든다`
const VM_JOSA = `비전 '일등LG', 경영이념 '고객을 위한 가치창조'와 '인간존중의 경영'을 LG WAY로 실천`
const VM_JOSA2 = `'누구나 마음 편히 놀 수 있게'라는 브랜드 미션 아래 사업을 운영`
const VM_JOSA3 = `비전은 'More than Food, Beyond Korea'이며, 창업정신은 '품질제일주의'와 '낙농보국(酪農報國)'이다.`
const VM_NARRATIVE = `2026년 5월 하이브는 브랜드 개편과 함께 새 미션 'DISCOVER A NEW UNIVERSE'와 새 비전 'GLOBAL ENTERTAINMENT'를 발표했다.`
const VM_LABEL_NO_QUOTE = `미션: Great Global Beauty & Health Value Creator로 성장. 큰 꿈을 품고 달성할 때까지 꾸준히 나아가는 '우보천리' 정신을 경영철학으로 삼음`

describe('parseQuotedStatements — 10) 인용 선언문으로 읽힌다', () => {
  it('10-a) 라벨 + 인용 2개 — 라벨을 살린다 (네이버)', () => {
    const p = parseQuotedStatements(VM_LABELS)!
    expect(p.quotes).toEqual([
      { label: '비전', text: '세상의 무한한 가능성을 연결합니다', note: null },
      { label: '미션', text: '네이버는 연결합니다, 현재와 미래를.', note: null },
    ])
    expect(p.rest).toBeNull()
  })

  it('10-b) ` / ` 로 나뉜 라벨형 (셀트리온)', () => {
    const p = parseQuotedStatements(VM_SLASH)!
    expect(p.quotes.map((q) => q.label)).toEqual(['미션', '비전'])
    expect(p.quotes[0].text).toContain('건강한 내일을 만들어갑니다')
  })

  it('10-c) 라벨 하나 (현대자동차)', () => {
    const p = parseQuotedStatements(VM_ONE)!
    expect(p.quotes).toHaveLength(1)
    expect(p.quotes[0].label).toBe('경영철학')
    expect(p.quotes[0].text).toBe(
      '창의적 사고와 끝없는 도전을 통해 새로운 미래를 창조함으로써 인류 사회의 꿈을 실현한다',
    )
  })

  it('10-d) 인용 선두 + `—` 부연 (우아한형제들)', () => {
    const p = parseQuotedStatements(VM_QUOTE_LEAD)!
    expect(p.quotes[0].label).toBeNull()
    expect(p.quotes[0].text).toBe('문 앞으로 배달되는 일상의 행복을')
    expect(p.quotes[0].note).toContain('— 배민1')
  })

  it('10-e) 출처 괄호도 부연으로 받는다 (현대건설)', () => {
    const p = parseQuotedStatements(VM_SOURCE_NOTE)!
    expect(p.quotes[0].note).toBe('(공식, hdec.kr)')
  })

  it('10-f) `그룹 비전` 라벨은 「그룹」까지 살린다 (롯데쇼핑)', () => {
    const p = parseQuotedStatements(VM_GROUP)!
    expect(p.quotes.map((q) => q.label)).toEqual(['그룹 비전', '미션'])
    expect(p.quotes[0].note).toBe('(고객에게 전 생애주기에 걸쳐 최고의 가치를 제공)')
  })

  it('10-g) 인용 없는 라벨 조각도, 같은 값에 진짜 인용이 있으면 살린다 (삼성증권)', () => {
    const p = parseQuotedStatements(VM_MIXED)!
    expect(p.quotes).toHaveLength(2)
    expect(p.quotes[0].text).toBe('Beyond the Best')
    expect(p.quotes[1].label).toBe('미션')
    expect(p.quotes[1].text).toContain('글로벌 프리미어 기업이 되는 것')
  })

  it('10-h) 🔴 뒤가 막히면 거기서 멈추고 나머지는 rest — 앞의 선언문을 잃지 않는다 (CJ제일제당)', () => {
    const p = parseQuotedStatements(VM_REST)!
    expect(p.quotes).toHaveLength(2)
    expect(p.rest).toBe("식품사업부문 미션은 '더 좋은 음식을 공유하고 New Wellness를 만들어간다'")
  })
})

describe('parseQuotedStatements — 11) 🔴 오탐 방어 (원문 문단으로 떨어진다)', () => {
  const cases: Array<[string, string]> = [
    ['인용부호가 아예 없다 (삼성전자)', VM_NO_QUOTE],
    ['인용부호가 아예 없다 (토스)', VM_NO_QUOTE2],
    ['인용 뒤가 조사로 이어진다 — 문장 속 인용 (LG전자)', VM_JOSA],
    ['인용 뒤가 조사로 이어진다 (야놀자)', VM_JOSA2],
    ['인용 뒤가 조사로 이어진다 (매일유업)', VM_JOSA3],
    ['서술문으로 시작한다 (하이브)', VM_NARRATIVE],
    ['라벨은 있지만 진짜 인용이 하나도 없다 (한국콜마)', VM_LABEL_NO_QUOTE],
  ]
  it.each(cases)('11-a) %s', (_label, raw) => {
    expect(parseQuotedStatements(raw)).toBeNull()
  })

  it('11-b) 빈 값 4종', () => {
    expect(parseQuotedStatements(undefined)).toBeNull()
    expect(parseQuotedStatements(null)).toBeNull()
    expect(parseQuotedStatements('')).toBeNull()
    expect(parseQuotedStatements('   \n ')).toBeNull()
  })
})

describe('12) 🔴 본문 유실 0 — 산출물의 모든 조각은 원문의 부분 문자열이다', () => {
  it('12-a) parseValueList', () => {
    const raws = [CV_PAREN, CV_LEAD, CV_TOSS, CV_SHORT, CV_LABEL, CV_DOTS, CV_DOT_IN_ITEM, CV_CIRCLED, CV_NUMBERED]
    for (const raw of raws) {
      const p = parseValueList(raw)!
      expect(p).not.toBeNull()
      for (const t of [p.lead, p.tail, ...p.items.flatMap((i) => [i.name, i.note])]) {
        if (t) expect(raw).toContain(t)
      }
      expect(p.items.every((i) => i.name.length > 0)).toBe(true)
    }
  })

  it('12-b) parseQuotedStatements', () => {
    const raws = [VM_LABELS, VM_SLASH, VM_ONE, VM_QUOTE_LEAD, VM_SOURCE_NOTE, VM_GROUP, VM_MIXED, VM_REST]
    for (const raw of raws) {
      const p = parseQuotedStatements(raw)!
      expect(p).not.toBeNull()
      for (const t of [...p.quotes.flatMap((q) => [q.text, q.note]), p.rest]) {
        if (t) expect(raw).toContain(t)
      }
    }
  })
})
