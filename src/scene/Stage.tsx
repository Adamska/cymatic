import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Mesh } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { Atmosphere } from './Atmosphere'
import { LightingRig } from './LightingRig'
import { motion, stepMotion } from './motionState'
import { PostProcessingStack } from './PostProcessingStack'
import { QUALITY, useQualityStore, watchBattery } from './quality'
import { RaySource } from './RaySource'
import { SculptureCore } from './SculptureCore'
import { sceneLive, setSceneTarget, stepScene, type SceneLook } from './sceneState'
import { CameraDirector, CaptureDriver } from './StageDirectors'

const MAX_FRAME_DELTA = 0.1
const READY_EVENT = 'cymatic:ready'

function FrameDriver() {
  const announced = useRef(false)
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_FRAME_DELTA)
    audioEngine.update(step)
    stepMotion(step, audioEngine.bands, sceneLive.scalars.flow)
    stepScene(step, motion.charge)
    if (!announced.current) {
      announced.current = true
      window.requestAnimationFrame(() => window.dispatchEvent(new Event(READY_EVENT)))
    }
  }, -1)
  return null
}

export function Stage({ look, sweep }: { look: SceneLook; sweep: boolean }) {
  const [sun, setSun] = useState<Mesh | null>(null)
  const profile = useQualityStore((state) => QUALITY[state.tier])
  const step = useQualityStore((state) => state.step)

  useEffect(() => setSceneTarget(look, sweep), [look, sweep])
  useEffect(watchBattery, [])

  return (
    <Canvas
      flat
      dpr={[1, profile.dpr]}
      camera={{ position: [0, 0.5, 6.6], fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor onIncline={() => step(1)} onDecline={() => step(-1)} flipflops={4} />
      <color attach="background" args={['#05060a']} />
      <FrameDriver />
      <Atmosphere />
      <LightingRig />
      {profile.godRays && <RaySource onReady={setSun} />}
      <SculptureCore />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minDistance={4.2}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.35}
      />
      <CameraDirector />
      <CaptureDriver />
      <PostProcessingStack sun={profile.godRays ? sun : null} />
    </Canvas>
  )
}
