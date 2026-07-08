/** AI 제안에 남는 "[본인 경험 채우기: …]" 빈칸 감지 — 그대로 제출되는 사고 방지 */
export function countFillPlaceholders(text: string): number {
  const matches = text.match(/\[본인 경험 채우기[^\]]*\]/g)
  return matches ? matches.length : 0
}
