import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { CubeTexture, IcosahedronGeometry, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { audioEngine } from '../audio/AudioEngine'
import fragmentShader from '../shaders/opticalCore.frag?raw'
import vertexShader from '../shaders/opticalCore.vert?raw'
import { OrbitalParticles } from './OrbitalParticles'
import { sceneLive } from './sceneState'

const SUBDIVISIONS = 64
const CORE_SCALE = 1.22
const ENVIRONMENT_INTENSITY = 1.15
const FULL_SIZE_ASPECT = 1.15
const MIN_FIT = 0.42

function createCoreGeometry() {
  const faceted = new IcosahedronGeometry(1, SUBDIVISIONS)
  faceted.deleteAttribute('normal')
  faceted.deleteAttribute('uv')
  const welded = mergeVertices(faceted)
  faceted.dispose()
  return welded
}

function createCoreUniforms() {
  const { palette } = sceneLive
  return {
    uTime: { value: 0 },
    uSub: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uRms: { value: 0 },
    uTurbulence: { value: 1 },
    uDisplacement: { value: 0.4 },
    uIridescence: { value: 0.6 },
    uEnvIntensity: { value: ENVIRONMENT_INTENSITY },
    uEnvMap: { value: null as CubeTexture | null },
    uPaletteOffset: { value: palette.offset },
    uPaletteAmplitude: { value: palette.amplitude },
    uPaletteFrequency: { value: palette.frequency },
    uPalettePhase: { value: palette.phase },
  }
}

export function SculptureCore() {
  const scene = useThree((state) => state.scene)
  const aspect = useThree((state) => state.viewport.aspect)
  const fit = Math.max(MIN_FIT, Math.min(1, aspect / FULL_SIZE_ASPECT))
  const geometry = useMemo(createCoreGeometry, [])
  const uniforms = useMemo(createCoreUniforms, [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        lights: true,
        uniforms: { ...UniformsUtils.clone(UniformsLib.lights), ...uniforms },
      }),
    [uniforms],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const { bands } = audioEngine
    const { scalars } = sceneLive
    const environment = scene.environment

    uniforms.uTime.value = sceneLive.time
    uniforms.uSub.value = bands.sub + bands.transient * 0.6
    uniforms.uBass.value = bands.bass
    uniforms.uMid.value = bands.mid
    uniforms.uHigh.value = bands.high
    uniforms.uRms.value = bands.rms
    uniforms.uTurbulence.value = scalars.turbulence
    uniforms.uDisplacement.value = scalars.displacement
    uniforms.uIridescence.value = scalars.iridescence
    uniforms.uEnvMap.value = environment instanceof CubeTexture ? environment : null
  })

  return (
    <group scale={fit}>
      <mesh geometry={geometry} material={material} scale={CORE_SCALE} frustumCulled={false} />
      <OrbitalParticles />
    </group>
  )
}
