import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector3, type Group } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { MODE_COUNT, samplePlate, spectralCentroid, type PlateSample } from './chladni'
import { motion } from './motionState'
import { QUALITY, useQualityStore } from './quality'
import { samplePalette, sceneLive } from './sceneState'

const PLATE_RADIUS = 3.3
const PRESETTLE_STEPS = 90
const OPENING_MODE = 4
const PLATE_DISTANCE = 2.8
const MODE_GLIDE = 0.5
const SETTLE_RATE = 2.6
const BOUNCE = 0.5

/** One step of sand physics: grains slide toward the nearest nodal line and hop off the antinodes. */
function settleSand(positions: Float32Array, count: number, mode: number, vibration: number, delta: number, sample: PlateSample): void {
  const settle = SETTLE_RATE * vibration * delta
  const bounce = BOUNCE * vibration * delta
  for (let index = 0; index < count; index++) {
    let x = positions[index * 3] ?? 0
    let y = positions[index * 3 + 1] ?? 0
    const { value, dx, dy } = samplePlate(x, y, mode, sample)
    const slope = dx * dx + dy * dy + 1e-3
    const pull = Math.min(0.08, Math.abs(value) * settle * 4) / Math.sqrt(slope)
    x -= Math.sign(value) * dx * pull + (Math.random() - 0.5) * bounce * Math.abs(value)
    y -= Math.sign(value) * dy * pull + (Math.random() - 0.5) * bounce * Math.abs(value)
    const reach = Math.hypot(x, y)
    if (reach > 1) {
      x *= 0.985 / reach
      y *= 0.985 / reach
    }
    positions[index * 3] = x
    positions[index * 3 + 1] = y
  }
}

const vertexShader = /* glsl */ `
  uniform float uSize;
  attribute float aSeed;
  varying float vSeed;
  varying float vEdge;
  void main() {
    vSeed = aSeed;
    vEdge = 1.0 - smoothstep(0.55, 1.0, length(position.xy));
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (0.6 + aSeed * 0.8) / -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uGlow;
  varying float vSeed;
  varying float vEdge;
  void main() {
    float falloff = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(mix(uColorA, uColorB, vSeed) * uGlow * falloff * vEdge, 1.0);
  }
`

/**
 * Glowing sand on a vibrating plate behind the sculpture, always facing the viewer.
 * Grains only move while the plate rings: they jump off the antinodes and settle on the
 * nodal lines of the mode picked by the spectral centroid, the way real cymatics work.
 */
export function ChladniPlate() {
  const groupRef = useRef<Group>(null)
  const count = useQualityStore((state) => QUALITY[state.tier].sand)
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let index = 0; index < count; index++) {
      const radius = Math.sqrt(Math.random())
      const angle = Math.random() * Math.PI * 2
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.sin(angle) * radius
      seeds[index] = Math.random()
    }
    const sample: PlateSample = { value: 0, dx: 0, dy: 0 }
    for (let step = 0; step < PRESETTLE_STEPS; step++) settleSand(positions, count, OPENING_MODE, 0.6, 1 / 30, sample)
    const buffer = new BufferGeometry()
    buffer.setAttribute('position', new BufferAttribute(positions, 3))
    buffer.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    return buffer
  }, [count])
  const uniforms = useMemo(
    () => ({ uSize: { value: 30 }, uColorA: { value: new Color() }, uColorB: { value: new Color() }, uGlow: { value: 0.3 } }),
    [],
  )
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [uniforms],
  )
  const state = useMemo(() => ({ mode: OPENING_MODE, sample: { value: 0, dx: 0, dy: 0 } as PlateSample, toward: new Vector3() }), [])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ camera }, frameDelta) => {
    const group = groupRef.current
    if (!group) return
    const delta = Math.min(frameDelta, 0.05)
    const { bands } = audioEngine

    camera.getWorldDirection(state.toward)
    group.position.copy(state.toward).multiplyScalar(PLATE_DISTANCE)
    group.quaternion.copy(camera.quaternion)

    const centroid = spectralCentroid(audioEngine.spectrum, audioEngine.binHz, 60, 5000)
    if (centroid >= 0) {
      const goal = Math.min(MODE_COUNT - 1, Math.max(0, centroid * 1.6 - 0.25) * (MODE_COUNT - 1))
      state.mode += (goal - state.mode) * (1 - Math.exp(-delta * MODE_GLIDE))
    }

    const vibration = Math.min(1.4, bands.rms * 0.9 + motion.pulse * 0.8 + bands.transient * 0.4)
    samplePalette(0.2 + sceneLive.time * 0.01, uniforms.uColorA.value)
    samplePalette(0.65 + sceneLive.time * 0.01, uniforms.uColorB.value)
    uniforms.uGlow.value = 0.16 + vibration * 0.26
    if (vibration < 0.01) return

    const attribute = geometry.getAttribute('position')
    settleSand(attribute.array as Float32Array, count, state.mode, vibration, delta, state.sample)
    attribute.needsUpdate = true
  })

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} scale={PLATE_RADIUS} renderOrder={-0.5} frustumCulled={false} />
    </group>
  )
}
