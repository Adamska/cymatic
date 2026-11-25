import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BackSide } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { motion } from './motionState'
import './shaderChunks'
import fragmentShader from '../shaders/atmosphere.frag?raw'
import vertexShader from '../shaders/atmosphere.vert?raw'
import { sceneLive } from './sceneState'

const DOME_RADIUS = 30

export function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uRms: { value: 0 },
      uIntensity: { value: 0 },
      uFlow: { value: 0 },
      uFlash: { value: 0 },
      uPaletteOffset: { value: sceneLive.palette.offset },
      uPaletteAmplitude: { value: sceneLive.palette.amplitude },
      uPaletteFrequency: { value: sceneLive.palette.frequency },
      uPalettePhase: { value: sceneLive.palette.phase },
    }),
    [],
  )

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1)
    const { kickEvent, intensity, surge } = motion
    uniforms.uTime.value = sceneLive.time
    uniforms.uIntensity.value = intensity
    uniforms.uFlow.value += step * (0.04 + intensity * 0.22 + surge.x * 0.12)
    uniforms.uFlash.value = kickEvent.force * Math.exp(-kickEvent.age * 7) * intensity * intensity
    uniforms.uBass.value = audioEngine.bands.bass
    uniforms.uRms.value = audioEngine.bands.rms
  })

  return (
    <mesh scale={DOME_RADIUS} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}
