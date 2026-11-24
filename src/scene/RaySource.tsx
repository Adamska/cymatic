import { useFrame } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import { Vector3, type Mesh, type MeshBasicMaterial } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { motion } from './motionState'
import { sceneLive } from './sceneState'

const DISTANCE = 3.6
const RADIUS = 0.62

/**
 * A small eclipse disc kept behind the sculpture. It is the light source the god rays
 * stream from, so the form's silhouette cuts shafts of light that brighten on impacts.
 */
export function RaySource({ onReady }: { onReady: (mesh: Mesh | null) => void }) {
  const meshRef = useRef<Mesh & { material: MeshBasicMaterial }>(null)
  const toward = useMemo(() => new Vector3(), [])
  const attach = useCallback(
    (mesh: (Mesh & { material: MeshBasicMaterial }) | null) => {
      meshRef.current = mesh
      onReady(mesh)
    },
    [onReady],
  )

  useFrame(({ camera }) => {
    const mesh = meshRef.current
    if (!mesh) return
    camera.getWorldDirection(toward)
    mesh.position.copy(toward).multiplyScalar(DISTANCE)
    const { lights, scalars } = sceneLive
    const glow = scalars.intensity * (0.22 + audioEngine.bands.rms * 0.35 + motion.pulse * 0.7)
    mesh.material.color.copy(lights.key).lerp(lights.rim, 0.35).multiplyScalar(glow)
  })

  return (
    <mesh ref={attach}>
      <sphereGeometry args={[RADIUS, 24, 16]} />
      <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
