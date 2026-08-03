/**
 * 입력란 글자수 한도 관련 순수 헬퍼.
 *
 * **왜 유틸로 뺐나** — `maxLength` 속성은 붙여넣기 초과분을 **말없이 자른다**.
 * 사용자는 뒷부분이 사라진 걸 모른 채 "AI 가 왜 이상하지" 하게 되는데, 이건 이번
 * D0 실사고(응답 필드가 조용히 누락되어 크래시)와 성격이 같은 **조용한 데이터 손실**이다.
 *
 * 판정 로직 자체는 순수 계산이라 컴포넌트에서 분리해 단위 테스트로 고정한다.
 * 자소서 chat 외에 공고 붙여넣기·면접 모집요강 등 다른 입력란에도 같은 방어가 필요하다.
 */

/**
 * 붙여넣기가 한도에서 잘릴지 판정한다.
 *
 * @param currentLength  현재 입력값 길이
 * @param selectionLength 붙여넣기로 **대체될** 선택 영역 길이 (선택 없으면 0)
 * @param pastedLength   붙여넣는 텍스트 길이
 * @param max            한도
 */
export function willPasteTruncate(
  currentLength: number,
  selectionLength: number,
  pastedLength: number,
  max: number,
): boolean {
  return currentLength - selectionLength + pastedLength > max
}

/** 한도의 90% 이상이면 미리 경고 — 다 치고 나서 잘리는 것보다 먼저 아는 게 낫다 */
export function isNearLimit(currentLength: number, max: number): boolean {
  return currentLength >= max * 0.9
}
