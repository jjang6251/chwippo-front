import { Link } from 'react-router-dom'
import { CardFieldsSection } from '@/components/admin/CardFieldsSection'

/**
 * `/ops/card-fields` — 카드 입력 실태.
 *
 * ## 왜 `/ops/reach` 안이 아니라 독립 페이지인가
 *
 * 처음엔 도달 현황 페이지 하단에 붙였는데 **찾지를 못했다.** 이유가 둘이었다:
 * ① 「도달 현황」이라는 이름만 보고 카드 입력 실태가 거기 있으리라 짐작할 근거가 없다
 * ② 그 페이지의 마무리 블록(읽는 법) **뒤에** 붙어서, 끝난 줄 알고 스크롤을 멈추게 된다
 *
 * 답하는 질문도 다르다 — 도달 현황은 *"어디까지 갔나"*, 여기는 *"무엇을 채웠나"* 다.
 * 질문이 다르면 화면을 나누고, `/ops` 첫 화면에서 **이름으로 찾을 수 있게** 한다.
 */
export function OpsCardFields() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <Link
          to="/ops"
          className="text-text-quaternary hover:text-text-tertiary text-sm transition-colors"
        >
          ← 관리자
        </Link>
        <span className="text-text-faint">/</span>
        <h1 className="text-lg font-bold text-text-primary">카드 입력 실태</h1>
      </div>

      <CardFieldsSection />
    </div>
  )
}
