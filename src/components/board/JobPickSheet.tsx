import { Drawer } from 'vaul'
import { Modal } from '@/components/common/Modal'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { JobPickList } from '@/components/board/JobPickList'

interface Props {
  open: boolean
  candidates: string[]
  profileJobTitle?: string | null
  onPick: (value: string) => void
  onTypeOwn: () => void
  onClose: () => void
}

const TITLE = '어느 직무로 지원하세요?'
const SUB = '공고에 적힌 표기 그대로예요'

/**
 * 후보가 **4개 이상**일 때만 여는 선택 창 (≤3 은 카드 안에서 바로 고른다).
 *
 * 모바일은 바텀 시트(vaul), 데스크탑은 작은 중앙 모달 — 목록 하나를 띄우는 데
 * 화면을 다 덮을 이유가 없어 폭을 좁게 잡는다.
 */
export function JobPickSheet({
  open,
  candidates,
  profileJobTitle,
  onPick,
  onTypeOwn,
  onClose,
}: Props) {
  const isMobile = useIsMobile()
  if (!open) return null

  const list = (
    <JobPickList
      candidates={candidates}
      profileJobTitle={profileJobTitle}
      onPick={onPick}
      onTypeOwn={onTypeOwn}
      dense={isMobile}
    />
  )

  if (isMobile) {
    return (
      <Drawer.Root
        open
        onOpenChange={(o) => { if (!o) onClose() }}
        shouldScaleBackground={false}
        /* vaul 키보드 보정 해제 — iOS 에서 시트가 두 배로 밀려 올라간다 (근거는 InfoModal.tsx 주석) */
        repositionInputs={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Drawer.Content
            aria-label={TITLE}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-line rounded-t-2xl max-h-[85dvh] flex flex-col shadow-2xl outline-none"
          >
            <Drawer.Title className="sr-only">{TITLE}</Drawer.Title>
            <div
              className="mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-line-strong shrink-0"
              aria-hidden="true"
            />
            <div className="px-[18px] pt-2 pb-3 border-b border-line shrink-0">
              <p className="text-sm font-semibold text-text-primary">{TITLE}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{SUB}</p>
            </div>
            <div className="px-[18px] pt-2 pb-6 overflow-y-auto overscroll-contain flex-1">
              {list}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <Modal open onClose={onClose} title={TITLE} width="max-w-[380px]">
      <p className="text-xs text-text-tertiary -mt-1 mb-2">{SUB}</p>
      <div className="max-h-[400px] overflow-y-auto overscroll-contain">{list}</div>
    </Modal>
  )
}
