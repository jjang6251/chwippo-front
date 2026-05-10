import type { Application } from '@/types/application'

function getNextActionDate(app: Application): number {
  const sorted = [...app.steps].sort((a, b) => a.orderIndex - b.orderIndex)
  const currentStep = sorted[app.currentStepIndex]

  const scheduledDate = currentStep?.scheduledDate ?? null
  const dateStr = scheduledDate ?? app.deadline

  if (!dateStr) return Infinity
  return new Date(dateStr).getTime()
}

function getDeadlineMs(app: Application): number {
  return app.deadline ? new Date(app.deadline).getTime() : Infinity
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

function compareByDeadline(a: Application, b: Application): number {
  const dateA = getDeadlineMs(a)
  const dateB = getDeadlineMs(b)
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
    ...starredPassed.sort(compareByDeadline),
    ...normalPassed.sort(compareByDeadline),
  ]
}
