import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, ShaderMaterial, Vector3, type Mesh } from 'three'
import fragmentShader from '../shaders/shockRings.frag?raw'
import vertexShader from '../shaders/shockRings.vert?raw'
import { motion, type SkinEvent } from './motionState'
import { samplePalette } from './sceneState'

const SLOTS = 6
const LIFE = 1.6
const REACH = 6.5
const DEPTH = 0.9
/** A beat only sends a ring once the passage is strong enough; weaker music stays clean. */
const KICK_THRESHOLD = 0.55
const SNAP_THRESHOLD = 0.7

interface Watched {
  event: SkinEvent
  lastAge: number
  threshold: number
  tone: number
  gain: number
}

/**
 * Shock waves behind the sculpture. Strong kicks push a wide, warm ring outward; snares on
 * an intense passage add thinner, brighter ones. Nothing appears while the music is calm.
 */
export function ShockRings() {
  const meshRef = useRef<Mesh>(null)
  const scratch = useMemo(() => ({ toward: new Vector3(), color: new Color() }), [])
  const cursor = useRef(0)
  const watched = useMemo<Watched[]>(
    () => [
      { event: motion.kickEvent, lastAge: 99, threshold: KICK_THRESHOLD, tone: 0.2, gain: 1 },
      { event: motion.snapEvent, lastAge: 99, threshold: SNAP_THRESHOLD, tone: 0.62, gain: 0.7 },
    ],
    [],
  )
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uAges: { value: new Array<number>(SLOTS).fill(LIFE) },
          uForces: { value: new Array<number>(SLOTS).fill(0) },
          uColors: { value: Array.from({ length: SLOTS }, () => new Color()) },
          uReach: { value: REACH },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ camera }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const ages = material.uniforms.uAges?.value as number[]
    const forces = material.uniforms.uForces?.value as number[]
    const colors = material.uniforms.uColors?.value as Color[]
    for (let slot = 0; slot < SLOTS; slot++) ages[slot] = Math.min(LIFE, (ages[slot] ?? LIFE) + delta)

    for (const watch of watched) {
      const fresh = watch.event.age < watch.lastAge
      watch.lastAge = watch.event.age
      const strength = watch.event.force * motion.intensity * watch.gain
      if (!fresh || motion.intensity < watch.threshold) continue
      const slot = cursor.current
      cursor.current = (slot + 1) % SLOTS
      ages[slot] = 0
      forces[slot] = Math.min(1.4, strength * 1.3)
      samplePalette(watch.tone + slot * 0.04, colors[slot] ?? scratch.color)
    }

    camera.getWorldDirection(scratch.toward)
    mesh.position.copy(scratch.toward).multiplyScalar(DEPTH)
    mesh.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh ref={meshRef} material={material} renderOrder={-0.5} frustumCulled={false}>
      <planeGeometry args={[REACH * 2, REACH * 2]} />
    </mesh>
  )
}
