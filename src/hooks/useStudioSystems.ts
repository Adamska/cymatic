import { useEffect } from 'react'
import { startAutoDirector } from '../features/autoDirector'
import { readSharedDirective } from '../features/shareLink'
import { usePlaylistStore } from '../store/usePlaylistStore'
import { useStudioStore } from '../store/useStudioStore'
import { useUiStore } from '../store/useUiStore'

const IDLE_MS = 3500
const SHOWCASE_MS = 6500

/** Opens a cue carried by the link, now and whenever the hash changes. */
function useSharedCue(): void {
  useEffect(() => {
    const apply = () => {
      const shared = readSharedDirective()
      if (shared && shared.title !== useStudioStore.getState().directive.title) useStudioStore.getState().setDirective(shared, 'shared')
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])
}

function useAutoDirector(): void {
  const enabled = useUiStore((state) => state.autoDirector)
  const engaged = useStudioStore((state) => state.engaged)
  useEffect(() => {
    if (!enabled || !engaged) return
    return startAutoDirector(
      () => useStudioStore.getState().directive.title,
      (directive) => useStudioStore.getState().setDirective(directive, 'auto'),
    )
  }, [enabled, engaged])
}

/** Fades the interface out after a few still seconds once sound is running. */
function useIdleHud(): void {
  const engaged = useStudioStore((state) => state.engaged)
  useEffect(() => {
    if (!engaged) return
    let timer = 0
    const wake = () => {
      window.clearTimeout(timer)
      if (useUiStore.getState().idle) useUiStore.getState().setIdle(false)
      timer = window.setTimeout(() => useUiStore.getState().setIdle(true), IDLE_MS)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    for (const name of events) window.addEventListener(name, wake, { passive: true })
    wake()
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, wake)
      useUiStore.getState().setIdle(false)
    }
  }, [engaged])
}

/** Shows the prompt suggestions for a few seconds after the first sound, as a hint. */
function useShowcase(): void {
  const engaged = useStudioStore((state) => state.engaged)
  useEffect(() => {
    if (!engaged) return
    useUiStore.getState().setShowcase(true)
    const timer = window.setTimeout(() => useUiStore.getState().setShowcase(false), SHOWCASE_MS)
    return () => window.clearTimeout(timer)
  }, [engaged])
}

export function useStudioSystems(): void {
  useSharedCue()
  useAutoDirector()
  useIdleHud()
  useShowcase()
  useEffect(() => void usePlaylistStore.getState().restoreSpotify(), [])
}
