import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { Atmosphere } from './Atmosphere'
import { LightingRig } from './LightingRig'
import { motion, stepMotion } from './motionState'
import { PostProcessingStack } from './PostProcessingStack'
import { SculptureCore } from './SculptureCore'
import { sceneLive, setSceneTarget, stepScene, type SceneLook } from './sceneState'

const MAX_FRAME_DELTA = 0.1

function FrameDriver() {
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_FRAME_DELTA)
    audioEngine.update(step)
    stepMotion(step, audioEngine.bands, sceneLive.scalars.flow)
    stepScene(step, motion.charge)
  }, -1)
  return null
}

export function Stage({ look }: { look: SceneLook }) {
  useEffect(() => setSceneTarget(look), [look])

  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.5, 6.6], fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#05060a']} />
      <FrameDriver />
      <Atmosphere />
      <LightingRig />
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
      <PostProcessingStack />
    </Canvas>
  )
}
