import { useNavigate, type NavigateFunction, type NavigateOptions, type To } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'

const DEMO_PASS_THROUGH = new Set(['/', '/login', '/login/callback', '/privacy', '/terms'])

export function useDemoNavigate(): NavigateFunction {
  const isDemo = useDemoMode()
  const navigate = useNavigate()
  function demoNavigate(to: To, options?: NavigateOptions): void
  function demoNavigate(delta: number): void
  function demoNavigate(to: To | number, options?: NavigateOptions): void {
    if (typeof to === 'number') {
      navigate(to)
    } else if (typeof to === 'string' && isDemo && !to.startsWith('/demo') && !DEMO_PASS_THROUGH.has(to)) {
      navigate('/demo' + to, options)
    } else {
      navigate(to as To, options)
    }
  }
  return demoNavigate
}
