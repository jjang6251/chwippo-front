import { useNavigate, type NavigateOptions } from 'react-router-dom'
import { useDemoMode } from '@/contexts/demoMode'

const DEMO_PASS_THROUGH = new Set(['/', '/login', '/login/callback', '/privacy', '/terms'])

export function useDemoNavigate() {
  const isDemo = useDemoMode()
  const navigate = useNavigate()
  return (to: string | number, options?: NavigateOptions) => {
    if (typeof to === 'number') {
      navigate(to)
    } else if (isDemo && !to.startsWith('/demo') && !DEMO_PASS_THROUGH.has(to)) {
      navigate('/demo' + to, options)
    } else {
      navigate(to, options)
    }
  }
}
