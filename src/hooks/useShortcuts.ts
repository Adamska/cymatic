import { useEffect } from 'react'
import {
  recordVideo,
  shareCue,
  stepCue,
  takeStill,
  toggleFullscreen,
  togglePlayback,
} from '../features/studioActions'
import { usePlaylistStore } from '../store/usePlaylistStore'
import { useStudioStore } from '../store/useStudioStore'
import { useUiStore } from '../store/useUiStore'

export interface Shortcut {
  keys: string
  label: string
}

/** Documented in the help overlay, in the order shown there. */
export const SHORTCUTS: readonly Shortcut[] = [
  { keys: 'Space', label: 'Play or pause the file' },
  { keys: '1 2 3 4', label: 'Synth, mic, file menu, shared tab' },
  { keys: 'Left Right', label: 'Previous or next cue' },
  { keys: '[ ]', label: 'Previous or next playlist track' },
  { keys: 'A', label: 'Auto director on or off' },
  { keys: 'H', label: 'Hide the interface' },
  { keys: 'F', label: 'Fullscreen' },
  { keys: 'L', label: 'Copy a link to this cue' },
  { keys: 'S', label: 'Save a still' },
  { keys: 'R', label: 'Record ten seconds of video' },
  { keys: '?', label: 'This help' },
]

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return
      const ui = useUiStore.getState()
      const studio = useStudioStore.getState()
      const actions: Record<string, () => void> = {
        ' ': togglePlayback,
        '1': () => (studio.engaged ? studio.selectSynth() : void studio.engage()),
        '2': () => void studio.selectMicrophone(),
        '3': () => ui.togglePanel('tracks'),
        '4': () => void studio.selectTab(),
        ArrowLeft: () => stepCue(-1),
        ArrowRight: () => stepCue(1),
        '[': () => usePlaylistStore.getState().step(-1),
        ']': () => usePlaylistStore.getState().step(1),
        a: () => ui.setAutoDirector(!ui.autoDirector),
        h: ui.toggleHud,
        f: toggleFullscreen,
        l: () => void shareCue(),
        s: () => void takeStill(),
        r: () => void recordVideo(),
        '?': () => ui.togglePanel('help'),
        Escape: () => ui.openPanel(null),
      }
      const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? actions[event.key]
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
