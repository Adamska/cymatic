import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CubeTexture, IcosahedronGeometry, ShaderMaterial, UniformsLib, UniformsUtils, type Mesh } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { audioEngine } from '../audio/AudioEngine'
import fragmentShader from '../shaders/opticalCore.frag?raw'
import vertexShader from '../shaders/opticalCore.vert?raw'
import { motion } from './motionState'
import { OrbitalParticles } from './OrbitalParticles'
import { SpectrumField } from './spectrumField'
import { sceneLive } from './sceneState'

const SUBDIVISIONS = 88
const CORE_SCALE = 1.22
const ENVIRONMENT_INTENSITY = 1.15
const FULL_SIZE_ASPECT = 1.15
const MIN_FIT = 0.42
const BREATH_DEPTH = 0.1
const PULSE_DEPTH = 0.1

function createCoreGeometry() {
  const faceted = new IcosahedronGeometry(1, SUBDIVISIONS)
  faceted.deleteAttribute('normal')
  faceted.deleteAttribute('uv')
  const welded = mergeVertices(faceted)
  faceted.dispose()
  return welded
}

function createCoreUniforms(field: SpectrumField) {
  const { palette } = sceneLive
  return {
    uTime: { value: 0 },
    uPhase: { value: motion.phase },
    uSwell: { value: 0 },
    uTwist: { value: 0 },
    uRipple: { value: 0 },
    uEnergy: { value: 0 },
    uBass: { value: 0 },
    uHigh: { value: 0 },
    uRms: { value: 0 },
    uSpectrum: { value: field.texture },
    uSpectrumMean: { value: 0 },
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
  const meshRef = useRef<Mesh>(null)
  const scene = useThree((state) => state.scene)
  const aspect = useThree((state) => state.viewport.aspect)
  const fit = Math.max(MIN_FIT, Math.min(1, aspect / FULL_SIZE_ASPECT))
  const geometry = useMemo(createCoreGeometry, [])
  const field = useMemo(() => new SpectrumField(), [])
  const uniforms = useMemo(() => createCoreUniforms(field), [field])
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
      field.dispose()
    },
    [geometry, material, field],
  )

  useFrame((_, delta) => {
    const { bands } = audioEngine
    field.update(audioEngine.spectrum, audioEngine.binHz, Math.min(delta, 0.1))
    uniforms.uSpectrumMean.value = field.mean
    const { scalars } = sceneLive
    const environment = scene.environment

    uniforms.uTime.value = sceneLive.time
    uniforms.uSwell.value = motion.low
    uniforms.uTwist.value = motion.mid
    uniforms.uRipple.value = motion.high
    uniforms.uEnergy.value = motion.charge + motion.pulse * 0.9
    uniforms.uBass.value = bands.bass
    uniforms.uHigh.value = Math.max(bands.high, motion.high)
    uniforms.uRms.value = bands.rms
    uniforms.uTurbulence.value = scalars.turbulence
    uniforms.uDisplacement.value = scalars.displacement
    uniforms.uIridescence.value = scalars.iridescence
    uniforms.uEnvMap.value = environment instanceof CubeTexture ? environment : null

    const mesh = meshRef.current
    if (mesh) {
      mesh.rotation.set(motion.pitch, motion.yaw, 0)
      mesh.scale.setScalar(CORE_SCALE * (1 + Math.max(-0.2, motion.low) * BREATH_DEPTH + motion.pulse * PULSE_DEPTH))
    }
  })

  return (
    <group scale={fit}>
      <mesh ref={meshRef} geometry={geometry} material={material} scale={CORE_SCALE} frustumCulled={false} />
      <OrbitalParticles />
    </group>
  )
}
