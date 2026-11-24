import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CubeTexture, IcosahedronGeometry, Vector3, type Mesh } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { audioEngine } from '../audio/AudioEngine'
import { useStudioStore } from '../store/useStudioStore'
import { createCoreMaterial, createCoreUniforms } from './coreMaterial'
import { knock, motion, strike, strikeState } from './motionState'
import { ChladniPlate } from './ChladniPlate'
import { OrbitalParticles } from './OrbitalParticles'
import { QUALITY, useQualityStore } from './quality'
import { SpectrumField } from './spectrumField'
import { cueWave, sceneLive } from './sceneState'

const CORE_SCALE = 1.22
const FULL_SIZE_ASPECT = 1.15
const MIN_FIT = 0.42
const BREATH_DEPTH = 0.1
const PULSE_DEPTH = 0.1
const CLICK_TOLERANCE_PX = 6
const BELL_SCALE: readonly number[] = [0, 2, 4, 7, 9, 12, 14, 16, 19]

function createCoreGeometry(subdivisions: number) {
  const faceted = new IcosahedronGeometry(1, subdivisions)
  faceted.deleteAttribute('normal')
  faceted.deleteAttribute('uv')
  const welded = mergeVertices(faceted)
  faceted.dispose()
  return welded
}

/** Pitches a strike on a pentatonic ladder above the cue's drone, higher toward the poles. */
function bellFrequency(direction: Vector3): number {
  const step = Math.min(BELL_SCALE.length - 1, Math.floor(Math.abs(direction.y) * BELL_SCALE.length))
  const rootHz = useStudioStore.getState().directive.synth.rootHz
  return rootHz * 8 * 2 ** ((BELL_SCALE[step] ?? 0) / 12)
}

export function SculptureCore() {
  const meshRef = useRef<Mesh>(null)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const aspect = useThree((state) => state.viewport.aspect)
  const subdivisions = useQualityStore((state) => QUALITY[state.tier].subdivisions)
  const particles = useQualityStore((state) => QUALITY[state.tier].particles)
  const fit = Math.max(MIN_FIT, Math.min(1, aspect / FULL_SIZE_ASPECT))
  const geometry = useMemo(() => createCoreGeometry(subdivisions), [subdivisions])
  const field = useMemo(() => new SpectrumField(), [])
  const uniforms = useMemo(() => createCoreUniforms(field), [field])
  const material = useMemo(() => createCoreMaterial(uniforms), [uniforms])
  const scratch = useMemo(() => new Vector3(), [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      material.dispose()
      field.dispose()
    },
    [material, field],
  )

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const mesh = meshRef.current
    if (!mesh || event.delta > CLICK_TOLERANCE_PX) return
    event.stopPropagation()
    const direction = mesh.worldToLocal(event.point.clone()).normalize()
    strike(direction, 1)
    void audioEngine.strike(bellFrequency(direction), 0.9)
  }

  useFrame((_, delta) => {
    const { bands } = audioEngine
    field.update(audioEngine.spectrum, audioEngine.binHz, Math.min(delta, 0.1))
    uniforms.uSpectrumMean.value = field.mean
    const { scalars } = sceneLive
    const environment = scene.environment
    const mesh = meshRef.current

    if (cueWave.fresh && mesh) {
      cueWave.fresh = false
      const facing = mesh.worldToLocal(scratch.copy(camera.position)).normalize()
      uniforms.uWaveOrigin.value.set(facing.x + 0.35, facing.y + 0.25, facing.z).normalize()
      knock(0.45)
    }

    uniforms.uTime.value = sceneLive.time
    uniforms.uSwell.value = motion.low
    uniforms.uTwist.value = motion.mid
    uniforms.uRipple.value = motion.high
    uniforms.uEnergy.value = motion.charge + motion.pulse * 0.9
    uniforms.uBass.value = bands.bass
    uniforms.uHigh.value = Math.max(bands.high, motion.high)
    uniforms.uRms.value = bands.rms
    uniforms.uShimmer.value = Math.min(1, bands.sparkle * 1.4 + bands.high * 0.25)
    uniforms.uTurbulence.value = scalars.turbulence
    uniforms.uDisplacement.value = scalars.displacement
    uniforms.uIridescence.value = scalars.iridescence
    uniforms.uEnvMap.value = environment instanceof CubeTexture ? environment : null
    uniforms.uWave.value = cueWave.progress
    uniforms.uStrikeAge.value = strikeState.age
    uniforms.uStrikeForce.value = strikeState.force

    if (mesh) {
      mesh.rotation.set(motion.pitch, motion.yaw, 0)
      mesh.scale.setScalar(CORE_SCALE * (1 + Math.max(-0.2, motion.low) * BREATH_DEPTH + motion.pulse * PULSE_DEPTH))
    }
  })

  return (
    <group scale={fit}>
      <mesh ref={meshRef} geometry={geometry} material={material} scale={CORE_SCALE} frustumCulled={false} />
      <mesh
        scale={CORE_SCALE * 1.04}
        onClick={onClick}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <OrbitalParticles key={particles} count={particles} />
      <ChladniPlate />
    </group>
  )
}
