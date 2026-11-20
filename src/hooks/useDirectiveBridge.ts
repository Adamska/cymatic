import { useEffect } from 'react'
import type { SceneDirective } from '../ai/directiveSchema'
import { audioEngine } from '../audio/AudioEngine'
import { useStudioStore } from '../store/useStudioStore'

export function useDirectiveBridge(): SceneDirective {
  const directive = useStudioStore((state) => state.directive)
  const patch = directive.synth

  useEffect(() => audioEngine.applyPatch(patch), [patch])
  useEffect(() => () => audioEngine.dispose(), [])

  return directive
}
