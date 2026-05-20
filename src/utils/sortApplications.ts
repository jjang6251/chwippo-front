import type { Application } from '@/types/application'

function getNextActionDate(app: Application): number {
  const sorted = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const currentStep = sorted[app.currentStepIndex]
  const dateStr = currentStep?.scheduledDate ?? null

  if (!dateStr) return Infinity
  return new Date(dateStr).getTime()
}

function getFirstStepDateMs(app: Application): number {
  const sorted = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const firstScheduled = sorted[0]?.scheduledDate
  return firstScheduled ? new Date(firstScheduled).getTime() : Infinity
}

function getCreatedAtMs(app: Application): number {
  return new Date(app.createdAt).getTime()
}

function compareByNextAction(a: Application, b: Application): number {
  const dateA = getNextActionDate(a)
  const dateB = getNextActionDate(b)
  if (dateA !== dateB) return dateA - dateB
  return getCreatedAtMs(b) - getCreatedAtMs(a)
}

function compareByFirstStepDate(a: Application, b: Application): number {
  const dateA = getFirstStepDateMs(a)
  const dateB = getFirstStepDateMs(b)
  if (dateA !== dateB) return dateA - dateB
  return getCreatedAtMs(b) - getCreatedAtMs(a)
}

export function sortApplications(apps: Application[]): Application[] {
  const starredActive: Application[] = []
  const normalActive: Application[] = []
  const starredPassed: Application[] = []
  const normalPassed: Application[] = []

  for (const app of apps) {
    const isPassed = app.status === 'PASSED'
    const isStarred = app.isStarred

    if (isStarred && !isPassed) starredActive.push(app)
    else if (!isStarred && !isPassed) normalActive.push(app)
    else if (isStarred && isPassed) starredPassed.push(app)
    else normalPassed.push(app)
  }

  return [
    ...starredActive.sort(compareByNextAction),
    ...normalActive.sort(compareByNextAction),
    ...starredPassed.sort(compareByFirstStepDate),
    ...normalPassed.sort(compareByFirstStepDate),
  ]
}
