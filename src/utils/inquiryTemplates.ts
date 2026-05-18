export const TEMPLATED_CATEGORIES = ['버그 신고', '기능 추가 요청', '기능 개선', '계정·개인정보'] as const

const TEMPLATES: Record<string, string> = {
  '버그 신고': `[발생 화면]
(예: 보드 카드 클릭 시, 캘린더 날짜 탭 후)

[재현 절차]
1.
2.
3.

[기대 동작]


[실제 동작]


[사용 기기·브라우저]
(예: iPhone 15 / Safari 17, 윈도우 / Chrome 124)`,

  '기능 추가 요청': `[원하는 기능]


[어떤 상황에서 필요한가요]


[지금은 어떻게 해결하고 계신가요]


[참고할 만한 다른 서비스 (선택)]
`,

  '기능 개선': `[개선하고 싶은 기능·화면]


[지금 어떤 점이 불편한가요]


[어떻게 바뀌면 좋을까요]
`,

  '계정·개인정보': `[문의 유형]
계정 복구 / 닉네임 변경 / 데이터 삭제 / 개인정보 열람 / 기타

[자세한 내용]
`,
}

export function getInquiryTemplate(category: string): string | null {
  return TEMPLATES[category] ?? null
}
