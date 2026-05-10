import type { Application } from '@/types/application'

function getNextActionDate(app: Application): number {
  const sorted = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const currentStep = sorted[app.currentStepIndex]

  const scheduledDate = currentStep?.scheduledDate ?? null
  const dateStr = scheduledDate ?? app.deadline

  if (!dateStr) return Infinity
  return new Date(dateStr).getTime()
}

function getCreatedAtMs(app: Application): number {
  return new Date(app.createdAt).getTime()
}

export function sortApplications(apps: Application[]): Application[] {
  const active = apps.filter((a) => a.status !== 'PASSED')
  const passed = apps.filter((a) => a.status === 'PASSED')

  const sortedActive = [...active].sort((a, b) => {
    const dateA = getNextActionDate(a)
    const dateB = getNextActionDate(b)
    if (dateA !== dateB) return dateA - dateB
    return getCreatedAtMs(b) - getCreatedAtMs(a)
  })

  const sortedPassed = [...passed].sort((a, b) => {
    const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity
    const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity
    if (dateA !== dateB) return dateA - dateB
    return getCreatedAtMs(b) - getCreatedAtMs(a)
  })

  return [...sortedActive, ...sortedPassed]
}
