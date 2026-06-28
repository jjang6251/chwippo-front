/**
 * W1 — signup 1 질문의 직군 enum + 그룹 정보.
 *
 * 21개 직군 (20 + 기타), 5 그룹.
 * 백엔드 `signup-job-categories.const.ts` 와 1:1 동기화 — 값 변경 시 양쪽 같이.
 */

export const JOB_CATEGORIES = [
  // A. IT·개발 (5)
  '백엔드 개발',
  '프론트엔드 개발',
  '모바일 앱 개발',
  '데이터·AI',
  'DevOps·인프라·보안',
  // B. 디자인·기획 (4)
  'UI/UX·프로덕트 디자이너',
  '그래픽·브랜드 디자이너',
  '서비스 기획·PM',
  '콘텐츠·에디터·PR',
  // C. 마케팅·영업·운영 (3)
  '마케팅·광고',
  '영업·세일즈',
  '고객서비스·CS·CX',
  // D. 경영지원·전문 (4)
  '인사·HR·노무',
  '재무·회계·세무',
  '법무·CPA·컴플라이언스',
  '경영기획·전략·컨설팅',
  // E. 산업·전문직 (4)
  '금융·은행·증권·보험',
  'R&D·연구개발',
  '의료·제약·바이오',
  '제조·생산·품질·SCM',
  // 기타
  '기타',
] as const

export type JobCategory = (typeof JOB_CATEGORIES)[number]

/** 그룹 ID — DESIGN.md 토큰 매칭 (브랜드 색 분배) */
export type GroupId = 'A' | 'B' | 'C' | 'D' | 'E' | 'X'

export interface JobGroup {
  id: GroupId
  label: string
  /** Tailwind 의미 색 토큰 (이미 정의된 col name) */
  color: 'brand' | 'accent' | 'info' | 'violet' | 'warning' | 'text-tertiary'
  categories: JobCategory[]
}

export const JOB_GROUPS: JobGroup[] = [
  {
    id: 'A',
    label: 'A. IT · 개발',
    color: 'brand',
    categories: [
      '백엔드 개발',
      '프론트엔드 개발',
      '모바일 앱 개발',
      '데이터·AI',
      'DevOps·인프라·보안',
    ],
  },
  {
    id: 'B',
    label: 'B. 디자인 · 기획',
    color: 'accent',
    categories: [
      'UI/UX·프로덕트 디자이너',
      '그래픽·브랜드 디자이너',
      '서비스 기획·PM',
      '콘텐츠·에디터·PR',
    ],
  },
  {
    id: 'C',
    label: 'C. 마케팅 · 영업 · 운영',
    color: 'info',
    categories: ['마케팅·광고', '영업·세일즈', '고객서비스·CS·CX'],
  },
  {
    id: 'D',
    label: 'D. 경영지원 · 전문',
    color: 'violet',
    categories: [
      '인사·HR·노무',
      '재무·회계·세무',
      '법무·CPA·컴플라이언스',
      '경영기획·전략·컨설팅',
    ],
  },
  {
    id: 'E',
    label: 'E. 산업 · 전문직',
    color: 'warning',
    categories: [
      '금융·은행·증권·보험',
      'R&D·연구개발',
      '의료·제약·바이오',
      '제조·생산·품질·SCM',
    ],
  },
  {
    id: 'X',
    label: '기타',
    color: 'text-tertiary',
    categories: ['기타'],
  },
]
