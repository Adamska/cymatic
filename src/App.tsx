import { lazy, Suspense } from 'react'
import { Hud } from './components/hud/Hud'
import { useDirectiveBridge } from './hooks/useDirectiveBridge'

const Stage = lazy(() => import('./scene/Stage').then((module) => ({ default: module.Stage })))

export function App() {
  const directive = useDirectiveBridge()

  return (
    <main className="relative h-full w-full overflow-hidden bg-void text-white">
      <Suspense fallback={null}>
        <Stage look={directive} />
      </Suspense>
      <Hud />
    </main>
  )
}
