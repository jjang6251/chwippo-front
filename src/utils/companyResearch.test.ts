/**
 * 회사 조사 내용 유무 판정 — 특히 **「확인하지 못함」류 숨김**.
 *
 * 🔴 픽스처는 전부 **실제 시드 원문**(`data-seeds/company-research-seed-2026-08.1.json`)이다.
 * 내가 지어낸 문장으로는 「어디까지가 순수 부정인가」를 검증할 수 없다 — 실측 분포는
 * 352개사에서 부정어를 품은 값 78건, 그중 **순수 부정 12건**(coreValues 6 · visionMission 6).
 *
 * 시나리오:
 *  1. 순수 부정 → 숨김 (한 문장 · 마침표 유무 · 부정 괄호 · 메타 괄호)
 *  2. 🔴 **과잉 차단 방어** — 부정 뒤 내용 · 내용 뒤 부정 · 내용 괄호 · `대신` 문장 → 표시
 *  3. 정상 값 → 표시
 *  4. `isFilled` 연동 — 문자열만 이 판정을 타고 배열·객체는 그대로
 *  5. `hasResearchContent` — 순수 부정만 남은 조사는 탭 자체가 안 뜬다
 */
import { describe, it, expect } from 'vitest'
import { hasResearchContent, isFilled, isUnconfirmedOnly } from './companyResearch'

// ── 실측 원문 — 순수 부정 (전수 12건 중) ──────────────────────────────
const PURE = {
  삼성물산_핵심가치: '삼성물산 별도의 공식 핵심가치 문구는 확인하지 못함 (인재상으로 대체 서술)',
  현대로템: '확인 못 함 (그룹 공통 핵심가치 외 현대로템 고유의 공식 핵심가치 문구는 확정하지 못함)',
  리디: '확인되지 않음 (공식 핵심가치 문구는 웹 공개 자료에서 확인하지 못함)',
  근로복지공단: '공식 핵심가치 문구를 웹 검색으로 확인하지 못했다.',
  경남은행: '공식 핵심가치 세부 항목은 웹에서 확정하지 못함.',
  예스24: '공식 채용 채널에서 명문화된 핵심가치 문구는 확인되지 않았다.',
  코웨이_비전: '공식 비전 슬로건은 확인되지 않음',
  스튜디오드래곤_비전: '공식 별도 비전 문구는 확인하지 못함',
  HD현대중공업_비전: '확인 못 함 (공식 비전·미션 문구를 이번 조사에서 확정하지 못함)',
  삼성물산_비전: '공식 별도 비전 문구는 확인하지 못함 (삼성그룹 공통 경영이념 수준의 서술은 학습 지식 기반)',
  DB손해보험_비전: '확인되지 않음 (공식 비전/미션 문구는 웹 공개 자료에서 확인하지 못함)',
  키움증권_비전: '공식 비전·미션 문구는 확인하지 못함.',
}

// ── 실측 원문 — 부정어가 있지만 **내용이 있다** (숨기면 안 된다) ──────
const HAS_CONTENT = {
  // 부정 뒤에 내용 (task 가 지목한 사례)
  우리금융캐피탈:
    '우리금융캐피탈 자체의 공식 핵심가치 문서는 확인되지 않았다. 우리금융그룹 차원에서는 정도경영과 임직원 존중·소통, 계열사 간 신뢰를 통한 시너지 창출을 강조한다.',
  키움증권_핵심가치:
    "공식 핵심가치 문구는 확인하지 못했으나, 'Online Trading의 First-mover'로서의 차별화된 사업철학이 그룹 계열사(키움자산운용) 소개 자료에서 확인된다.",
  당근: "공식 핵심가치 문구는 확인되지 않았으며, 조직문화 키워드로 '뛰어난 동료'와 '자율'을 강조한다",
  // 내용이 먼저, 부정이 뒤
  HD현대중공업_핵심가치:
    "HD현대 그룹 인재상 3대 축(공식 채용 페이지 기준): 최고에 도전하는 열정, 세상을 바꾸는 혁신, 정직을 실천하는 신뢰. 별도의 '핵심가치' 문구는 확인하지 못해 인재상으로 대체.",
  롯데이노베이트:
    "롯데그룹 공통 핵심가치 'Beyond Customer Expectation'(Challenge·Respect·Originality)이 적용되며, 계열사 고유의 별도 핵심가치 표현은 검색으로 확인하지 못함.",
  // 부정인데 괄호 안에 내용
  현대건설:
    '현대건설 별도 공식 핵심가치 문구는 확인하지 못함 (현대자동차그룹 공통 핵심가치인 무한책임정신·가능성의 실현·인류애의 구현을 공유할 가능성)',
  두산에너빌리티_비전:
    "확인 못 함 (공식 미션 문구는 확정하지 못했으며, '생태 친화적 에너지의 새로운 시대'라는 지향점만 채용 페이지에서 확인)",
  // `대신` 으로 이어지는 대체 내용
  지역난방공사:
    '공식 핵심가치 문구를 웹 검색으로 확인하지 못했다. 대신 인재상 4대 역량(KNOWLEDGE·HUMANITY·CREATIVITY·DRIVE)을 공식 확인했다.',
  // `…있으나` (쉼표 없는 연결어미) 뒤에 과거 값
  한국환경공단:
    '최신 공식 핵심가치 명문화는 웹에서 확정하지 못함. 과거 자료에서 열정·신뢰·화합·글로벌 마인드가 핵심가치로 언급된 바 있으나 현재 유효 여부는 확인하지 못했다.',
  // 메타 괄호만 붙은 정상 값 — 괄호가 부정이어도 본문은 내용이다
  알테오젠: '전문성·책임감·열정·창의성을 겸비한 인재를 추구 (공식 핵심가치 문구는 별도 확인 못 함)',
  HK이노엔: '창조성, 합리성, 적극성, 자주성을 강조하는 조직문화 (공식 페이지 문구 재확인 필요)',
}

const NORMAL = {
  삼성전자_핵심가치:
    '인재제일(기업은 사람이라는 신념으로 인재를 소중히 여기고 능력 발휘 기회 제공), 최고지향(끊임없는 열정과 도전정신으로 세계 최고를 추구) — 삼성전자 공식 5대 핵심가치',
  삼성전자_비전:
    '인재와 기술을 바탕으로 최고의 제품과 서비스를 창출하여 인류사회에 공헌한다 (삼성전자 공식 경영이념)',
}

describe('isUnconfirmedOnly — 1) 순수 부정은 숨긴다', () => {
  it.each(Object.entries(PURE))('1) %s', (_name, raw) => {
    expect(isUnconfirmedOnly(raw)).toBe(true)
  })
})

describe('isUnconfirmedOnly — 2) 🔴 과잉 차단 방어 (부정어가 있어도 내용이 있으면 표시)', () => {
  it.each(Object.entries(HAS_CONTENT))('2) %s', (_name, raw) => {
    expect(isUnconfirmedOnly(raw)).toBe(false)
  })
})

describe('isUnconfirmedOnly — 3) 경계', () => {
  it.each(Object.entries(NORMAL))('3-a) 정상 값 %s → false', (_name, raw) => {
    expect(isUnconfirmedOnly(raw)).toBe(false)
  })

  it('3-b) 빈 값 4종 → false (「비었다」는 별도 판정이다)', () => {
    expect(isUnconfirmedOnly(undefined)).toBe(false)
    expect(isUnconfirmedOnly(null)).toBe(false)
    expect(isUnconfirmedOnly('')).toBe(false)
    expect(isUnconfirmedOnly('   \n ')).toBe(false)
  })

  it('3-c) 안 닫힌 괄호도 터지지 않는다', () => {
    expect(isUnconfirmedOnly('공식 핵심가치 문구는 확인하지 못함 (인재상으로')).toBe(true)
  })
})

describe('isFilled — 4) 문자열만 이 판정을 탄다', () => {
  it('4-a) 순수 부정 문자열은 비어 있는 것으로 친다', () => {
    expect(isFilled(PURE.삼성물산_핵심가치)).toBe(false)
    expect(isFilled(PURE.코웨이_비전)).toBe(false)
  })

  it('4-b) 내용 있는 문자열·빈 문자열은 기존 그대로', () => {
    expect(isFilled(HAS_CONTENT.우리금융캐피탈)).toBe(true)
    expect(isFilled(NORMAL.삼성전자_핵심가치)).toBe(true)
    expect(isFilled('')).toBe(false)
    expect(isFilled('   ')).toBe(false)
  })

  it('4-c) 배열·객체·그 밖의 타입은 판정이 바뀌지 않는다', () => {
    expect(isFilled(['성장 지향', '협업'])).toBe(true)
    expect(isFilled([])).toBe(false)
    expect(isFilled({ hq: '경기도 성남시' })).toBe(true)
    expect(isFilled({ hq: '' })).toBe(false)
    // 🔴 객체 값이 순수 부정뿐이면 그 객체도 비었다 (재귀가 같은 규칙을 탄다)
    expect(isFilled({ hq: PURE.근로복지공단 })).toBe(false)
    expect(isFilled(undefined)).toBe(false)
    expect(isFilled(0)).toBe(false)
  })
})

describe('hasResearchContent — 5) 순수 부정만 남으면 탭 자체가 안 뜬다', () => {
  it('5-a) 두 항목이 전부 「확인하지 못함」 → false', () => {
    expect(
      hasResearchContent({
        status: 'ok',
        research: { coreValues: PURE.삼성물산_핵심가치, visionMission: PURE.코웨이_비전 },
      }),
    ).toBe(false)
  })

  it('5-b) 하나라도 내용이 있으면 true', () => {
    expect(
      hasResearchContent({
        status: 'ok',
        research: { coreValues: PURE.삼성물산_핵심가치, businessSummary: '반도체 회사다.' },
      }),
    ).toBe(true)
  })
})
