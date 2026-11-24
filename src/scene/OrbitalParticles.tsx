import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Matrix4, type InstancedMesh } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { motion } from './motionState'
import { samplePalette, sceneLive } from './sceneState'

interface Orbit {
  radius: number
  speed: number
  phase: number
  inclination: number
  node: number
  size: number
  bin: number
  tone: number
}

const HIGHEST_BIN = 680

function createOrbits(count: number): Orbit[] {
  return Array.from({ length: count }, () => {
    const radius = 1.95 + Math.pow(Math.random(), 1.6) * 1.9
    return {
      radius,
      speed: (0.22 + Math.random() * 0.3) / Math.pow(radius / 2, 1.5),
      phase: Math.random() * Math.PI * 2,
      inclination: (Math.random() - 0.5) * 0.9,
      node: Math.random() * Math.PI * 2,
      size: 0.005 + Math.pow(Math.random(), 3) * 0.014,
      bin: 2 + Math.floor(Math.pow(Math.random(), 2) * HIGHEST_BIN),
      tone: Math.random(),
    }
  })
}

export function OrbitalParticles({ count }: { count: number }) {
  const meshRef = useRef<InstancedMesh>(null)
  const orbits = useMemo(() => createOrbits(count), [count])
  const scratch = useMemo(() => ({ matrix: new Matrix4(), color: new Color() }), [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const { spectrum } = audioEngine
    const { matrix, color } = scratch
    const time = sceneLive.time
    const swell = 1 + motion.low * 0.16 + motion.pulse * 0.12
    const flutter = Math.max(0, motion.high) * 0.1
    const shimmer = motion.phase.z * 2.3

    for (let index = 0; index < count; index++) {
      const orbit = orbits[index]
      if (!orbit) continue

      const level = (spectrum[orbit.bin] ?? 0) / 255
      const angle = orbit.phase + time * orbit.speed
      const radius = orbit.radius * (swell + flutter * Math.sin(orbit.phase * 13 + shimmer))
      const planarX = Math.cos(angle) * radius
      const planarZ = Math.sin(angle) * radius
      const tiltedZ = planarZ * Math.cos(orbit.inclination)
      const cosNode = Math.cos(orbit.node)
      const sinNode = Math.sin(orbit.node)
      const scale = orbit.size * (0.6 + level * 1.5)

      matrix.makeScale(scale, scale, scale)
      matrix.setPosition(
        planarX * cosNode + tiltedZ * sinNode,
        planarZ * Math.sin(orbit.inclination),
        tiltedZ * cosNode - planarX * sinNode,
      )
      mesh.setMatrixAt(index, matrix)
      mesh.setColorAt(index, samplePalette(orbit.tone + time * 0.02, color).multiplyScalar(0.6 + level * 2.4))
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
