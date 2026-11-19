import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BackSide } from 'three'
import { audioEngine } from '../audio/AudioEngine'
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
      uPaletteOffset: { value: sceneLive.palette.offset },
      uPaletteAmplitude: { value: sceneLive.palette.amplitude },
      uPaletteFrequency: { value: sceneLive.palette.frequency },
      uPalettePhase: { value: sceneLive.palette.phase },
    }),
    [],
  )

  useFrame(() => {
    uniforms.uTime.value = sceneLive.time
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
