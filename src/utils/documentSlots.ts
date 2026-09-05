/**
 * 「지원 서류」 고정 슬롯 4종의 규칙 — 형식 · 크기 · 안내문.
 *
 * 왜 자유 업로드가 아니라 자리를 미리 만드나: 실측 11곳 중 5곳이 파일을 요구하는데
 * (`company/01_product/autofill-census-2026-09.md`) **요구하는 종류가 거의 같다**.
 * 자리를 비워 두면 「무엇을 올려야 하나」를 사용자가 매번 다시 판단한다.
 *
 * 🔴 슬롯은 **항목이 없는 서류만** 맡는다 (CEO 2026-09-05). 어학 성적표·성적증명서·
 * 졸업증명서는 어학·학력 **항목에 붙는 것이 원본**이라 슬롯에서 뺐다 — 두 군데 저장되면
 * 어느 쪽이 최신인지 사용자도 우리도 모른다.
 *
 * 🔴 규칙은 **파일을 고르기 전에** 보여주고, 어긋나면 업로드 전에 막는다 — R2 에 올린 뒤
 * 서버가 400 을 주면 고아 파일과 낭비된 대기 시간만 남는다.
 */
import type { DocumentSlot } from '@/api/myinfo'

const MB = 1024 * 1024
const IMAGE_MIMES = ['image/jpeg', 'image/png']
const PDF_MIMES = ['application/pdf']

export interface SlotSpec {
  slot: DocumentSlot
  label: string
  /** `<input accept>` */
  accept: string
  /** 사람이 읽는 형식 */
  formats: string
  mimes: string[]
  maxBytes: number
  /** 행에 붙는 한 줄 안내 */
  note?: string
  /**
   * 파일 대신 링크를 받을 수 있는가.
   *
   * 🔴 이력서·경력기술서도 링크를 받는다 (CEO 2026-09-05) — 노션·개인 사이트로 이력서를
   * 관리하는 사람이 적지 않은데, 파일 칸만 있으면 그 사람은 이 자리를 영원히 비워 둔다.
   * 대부분의 지원서는 여전히 파일을 요구하므로 아래 `linkNote` 가 그 사실을 같이 말한다.
   */
  linkable?: boolean
  /** 링크를 받는 슬롯 중, 파일이 여전히 기본인 곳에 붙는 한 줄 */
  linkNote?: string
}

const LINK_NOTE = '대부분 지원서는 파일로 받아요 — 링크만 있으면 파일 칸은 비워 둬요'

export const SLOT_SPECS: SlotSpec[] = [
  {
    slot: 'photo', label: '증명사진', accept: '.jpg,.jpeg,.png', formats: 'JPG · PNG',
    mimes: IMAGE_MIMES, maxBytes: 5 * MB,
    note: '3:4 비율 · 2MB 이하가 대부분 폼에서 통해요',
  },
  { slot: 'resume',           label: '이력서',      accept: '.pdf', formats: 'PDF', mimes: PDF_MIMES, maxBytes: 10 * MB, linkable: true, linkNote: LINK_NOTE },
  { slot: 'portfolio',        label: '포트폴리오',  accept: '.pdf', formats: 'PDF', mimes: PDF_MIMES, maxBytes: 20 * MB, linkable: true },
  { slot: 'career_statement', label: '경력기술서',  accept: '.pdf', formats: 'PDF', mimes: PDF_MIMES, maxBytes: 10 * MB, linkable: true, linkNote: LINK_NOTE },
]

/** 바이트 → "1.2MB" / "340KB" */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < MB) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / MB).toFixed(1)}MB`
}

export const maxLabel = (bytes: number) => `${Math.round(bytes / MB)}MB`

/**
 * 업로드 **전** 차단 판정. 통과하면 `null`, 아니면 사용자에게 그대로 보여줄 문장.
 * 🔴 숫자를 반드시 넣는다 — 「너무 커요」만으로는 무엇을 줄여야 할지 알 수 없다.
 */
export function validateSlotFile(spec: SlotSpec, file: File): string | null {
  if (!spec.mimes.includes(file.type)) {
    return `${spec.label}은(는) ${spec.formats} 만 올릴 수 있어요.`
  }
  if (file.size <= 0) return '빈 파일은 올릴 수 없어요.'
  if (file.size > spec.maxBytes) {
    return `${spec.label}은(는) ${maxLabel(spec.maxBytes)} 이하만 올릴 수 있어요. (선택한 파일 ${formatBytes(file.size)})`
  }
  return null
}
