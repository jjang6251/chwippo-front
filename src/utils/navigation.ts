import type { NavigateFunction } from 'react-router-dom'

export function goBack(navigate: NavigateFunction, fallback: string) {
  if (window.history.length > 1) {
    navigate(-1)
  } else {
    navigate(fallback, { replace: true })
  }
}
