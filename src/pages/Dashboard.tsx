import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { DdayPinnedCard } from '@/components/dashboard/DdayPinnedCard'
import { SectionWrapper } from '@/components/dashboard/SectionWrapper'
import { AddSectionSheet } from '@/components/dashboard/AddSectionSheet'
import { StatsSection } from '@/components/dashboard/sections/StatsSection'
import { DdaySection } from '@/components/dashboard/sections/DdaySection'
import { TodosSection } from '@/components/dashboard/sections/TodosSection'
import { GoalsSection } from '@/components/dashboard/sections/GoalsSection'
import { TodayScheduleSection } from '@/components/dashboard/sections/TodayScheduleSection'
import { TopApplicationsSection } from '@/components/dashboard/sections/TopApplicationsSection'
import { CalendarMiniSection } from '@/components/dashboard/sections/CalendarMiniSection'
import { CoverLetterQuickSection } from '@/components/dashboard/sections/CoverLetterQuickSection'
import { useDashboardStats, useDdayList } from '@/hooks/useDashboard'
import { InterviewReviewCard } from '@/components/dashboard/InterviewReviewCard'
import { useDashboardConfig, useUpdateDashboardConfig } from '@/hooks/useDashboardConfig'
import { useProfile } from '@/hooks/useMyinfo'
import { useAuthStore } from '@/stores/authStore'

export function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: dday, isLoading: ddayLoading } = useDdayList()
  const { data: profile } = useProfile()
  const { data: config } = useDashboardConfig()
  const { mutate: saveConfig } = useUpdateDashboardConfig()

  const [editMode, setEditMode] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const goals = profile?.goal_other
    ?.split('\n')
    .map((g) => g.trim())
    .filter(Boolean) ?? []

  const now = new Date()
  const month = now.getMonth() + 1
  const date = now.getDate()
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const day = dayNames[now.getDay()]

  const pinnedItem = dday?.find(
    (item) => item.type === 'interview' && item.pinnedContent && item.dday <= 1 && item.dday >= 0,
  )

  const sections = config?.sections ?? []
  // stats는 항상 최상단 고정 — DndContext 밖에서 별도 렌더링
  const draggableSections = sections.filter((s) => s.visible && s.id !== 'stats')
  const draggableIds = draggableSections.map((s) => s.id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = draggableIds.indexOf(active.id as string)
    const newIndex = draggableIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(draggableSections, oldIndex, newIndex)
    const statsSection = sections.find((s) => s.id === 'stats') ?? { id: 'stats', visible: true }
    saveConfig({ sections: [statsSection, ...reordered] })
  }

  function handleRemove(id: string) {
    const newSections = sections.map((s) => s.id === id ? { ...s, visible: false } : s)
    saveConfig({ sections: newSections })
  }

  function handleToggle(id: string) {
    const existing = sections.find((s) => s.id === id)
    const isActive = existing?.visible === true
    const statsSection = sections.find((s) => s.id === 'stats') ?? { id: 'stats', visible: true }
    const rest = sections.filter((s) => s.id !== 'stats')
    let newRest
    if (existing) {
      newRest = rest.map((s) => s.id === id ? { ...s, visible: !isActive } : s)
    } else {
      newRest = [...rest, { id, visible: true }]
    }
    saveConfig({ sections: [statsSection, ...newRest] })
  }

  function renderSectionContent(id: string) {
    switch (id) {
      case 'dday':              return <DdaySection items={dday} isLoading={ddayLoading} />
      case 'todos':             return <TodosSection />
      case 'goals':             return <GoalsSection goals={goals} />
      case 'today_schedule':    return <TodayScheduleSection items={dday} isLoading={ddayLoading} />
      case 'top_applications':  return <TopApplicationsSection />
      case 'calendar_mini':     return <CalendarMiniSection />
      case 'cover_letter_quick':return <CoverLetterQuickSection />
      default:                  return null
    }
  }

  const activeSectionIds = sections.filter((s) => s.visible).map((s) => s.id)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <p className="text-text-quaternary text-xs mb-2 tracking-wide">{month}월 {date}일 ({day})</p>
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-end gap-2">
            <h1 className="text-text-primary text-2xl font-bold leading-tight">
              안녕하세요,{' '}
              <span className="text-brand">{user?.nickname ?? ''}님</span>
            </h1>
            <span className="text-xl mb-0.5">👋</span>
          </div>
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`flex-none text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
              editMode
                ? 'bg-brand/20 border-brand/40 text-brand'
                : 'bg-white/5 border-white/8 text-text-quaternary hover:text-text-tertiary'
            }`}
          >
            {editMode ? '완료' : '섹션 편집'}
          </button>
        </div>
        <p className="text-text-quaternary text-sm mt-1">오늘도 취뽀 향해 한 걸음씩!</p>
      </div>

      {/* 어제 면접 후기 CTA */}
      <InterviewReviewCard />

      {/* 면접 핀 카드 (D-1 / D-day) — 커스터마이징 대상 아님 */}
      {pinnedItem && (
        <div className="mb-6">
          <DdayPinnedCard item={pinnedItem} />
        </div>
      )}

      {/* stats 섹션 — 항상 최상단 고정, 드래그 없음 */}
      <div className="mb-6 bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
        <StatsSection stats={stats} isLoading={statsLoading} />
      </div>

      {/* 드래그 가능한 섹션들 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={draggableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-6 sm:space-y-4">
            {draggableSections.map((s) => (
              <SectionWrapper
                key={s.id}
                id={s.id}
                editMode={editMode}
                onRemove={() => handleRemove(s.id)}
              >
                {renderSectionContent(s.id)}
              </SectionWrapper>
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 shadow-2xl shadow-black/40 cursor-grabbing">
              {renderSectionContent(activeId)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 섹션 추가 (항상 노출) */}
      <button
        onClick={() => setShowAddSheet(true)}
        className="mt-4 w-full py-3 rounded-xl border border-dashed border-white/15 text-text-quaternary text-xs hover:border-brand/40 hover:text-brand transition-colors"
      >
        + 섹션 추가
      </button>

      {showAddSheet && (
        <AddSectionSheet
          activeSectionIds={activeSectionIds}
          onToggle={handleToggle}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  )
}
