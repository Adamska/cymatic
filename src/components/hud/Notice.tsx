import { useEffect } from 'react'
import { useStudioStore } from '../../store/useStudioStore'
import { GlassPanel } from './GlassPanel'

const DISMISS_AFTER_MS = 4200

export function Notice() {
  const notice = useStudioStore((state) => state.notice)
  const dismissNotice = useStudioStore((state) => state.dismissNotice)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(dismissNotice, DISMISS_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [notice, dismissNotice])

  if (!notice) return null

  return (
    <div className="absolute inset-x-0 top-5 flex justify-center px-6" role="status">
      <GlassPanel className="flex h-9 items-center rounded-full px-4 text-xs font-light text-white/85">{notice}</GlassPanel>
    </div>
  )
}
