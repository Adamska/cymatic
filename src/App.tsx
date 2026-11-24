import { lazy, Suspense } from 'react'
import { Hud } from './components/hud/Hud'
import { useDirectiveBridge } from './hooks/useDirectiveBridge'
import { useStudioStore } from './store/useStudioStore'

const Stage = lazy(() => import('./scene/Stage').then((module) => ({ default: module.Stage })))

export function App() {
  const directive = useDirectiveBridge()
  const morphing = useStudioStore((state) => state.origin === 'morph')

  return (
    <main className="relative h-full w-full overflow-hidden bg-void text-white">
      <Suspense fallback={null}>
        <Stage look={directive} sweep={!morphing} />
      </Suspense>
      <Hud />
    </main>
  )
}
