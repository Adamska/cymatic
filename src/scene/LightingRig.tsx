import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  Color,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type PointLight,
  type SpotLight,
} from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { sceneLive } from './sceneState'

type PanelMesh = Mesh & { material: MeshBasicMaterial }

const GRADIENT_SIZE = 64
const KEY_CANDELA = 70
const FILL_CANDELA = 18
const RIM_CANDELA = 34

function createSoftboxGradient(): DataTexture {
  const data = new Uint8Array(GRADIENT_SIZE * GRADIENT_SIZE * 4)
  for (let y = 0; y < GRADIENT_SIZE; y++) {
    for (let x = 0; x < GRADIENT_SIZE; x++) {
      const u = x / (GRADIENT_SIZE - 1)
      const v = y / (GRADIENT_SIZE - 1)
      const feather = Math.pow(Math.sin(u * Math.PI) * Math.sin(v * Math.PI), 1.2)
      const sweep = 0.25 + 0.75 * u
      data.fill(Math.round(255 * feather * sweep), (y * GRADIENT_SIZE + x) * 4, (y * GRADIENT_SIZE + x) * 4 + 3)
      data[(y * GRADIENT_SIZE + x) * 4 + 3] = 255
    }
  }
  const texture = new DataTexture(data, GRADIENT_SIZE, GRADIENT_SIZE, RGBAFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function tint(panel: PanelMesh | null, color: Color, intensity: number): void {
  panel?.material.color.copy(color).multiplyScalar(intensity)
}

function StudioPanels() {
  const carousel = useRef<Group>(null)
  const keyPanel = useRef<PanelMesh>(null)
  const fillPanel = useRef<PanelMesh>(null)
  const rimPanel = useRef<PanelMesh>(null)
  const halo = useRef<PanelMesh>(null)
  const gradient = useMemo(createSoftboxGradient, [])
  const blend = useMemo(() => new Color(), [])

  useEffect(() => () => gradient.dispose(), [gradient])

  useFrame(() => {
    const { bands } = audioEngine
    const { lights, scalars, time } = sceneLive
    const level = scalars.intensity

    if (carousel.current) carousel.current.rotation.y = time * 0.16
    tint(keyPanel.current, lights.key, level * (2.6 + bands.rms * 1.6))
    tint(fillPanel.current, lights.fill, level * (2 + bands.mid * 1.6))
    tint(rimPanel.current, lights.rim, level * (2.4 + bands.high * 3))
    tint(halo.current, blend.copy(lights.key).lerp(lights.rim, 0.5), level * (1.2 + Math.max(bands.transient, bands.impact) * 4))
  })

  return (
    <>
      <mesh scale={40}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#030409" side={BackSide} />
      </mesh>
      <group ref={carousel}>
        <Lightformer ref={keyPanel} form="rect" map={gradient} position={[3.5, 5, 4]} scale={[7, 4.5, 1]} target={[0, 0, 0]} />
        <Lightformer ref={fillPanel} form="rect" map={gradient} position={[-6.5, 0.5, 1.5]} scale={[3, 8, 1]} target={[0, 0, 0]} />
        <Lightformer ref={rimPanel} form="rect" map={gradient} position={[4, -1.5, -6]} scale={[9, 2.2, 1]} target={[0, 0, 0]} />
      </group>
      <Lightformer ref={halo} form="ring" position={[0, -6.5, 0]} scale={5} target={[0, 0, 0]} />
    </>
  )
}

export function LightingRig() {
  const keyLight = useRef<SpotLight>(null)
  const fillLight = useRef<PointLight>(null)
  const rimLight = useRef<PointLight>(null)

  useFrame(() => {
    const { bands } = audioEngine
    const { lights, scalars, time } = sceneLive
    const level = scalars.intensity
    const key = keyLight.current
    const fill = fillLight.current
    const rim = rimLight.current

    if (key) {
      key.position.set(Math.sin(time * 0.17) * 3.4 + 2.2, 4.6 + Math.sin(time * 0.11) * 0.7, 4.4)
      key.color.copy(lights.key)
      key.intensity = KEY_CANDELA * level * (0.8 + bands.rms * 0.5)
    }
    if (fill) {
      fill.position.set(-4.2, Math.sin(time * 0.23) * 1.6 - 0.8, Math.cos(time * 0.19) * 2 + 2.4)
      fill.color.copy(lights.fill)
      fill.intensity = FILL_CANDELA * level * (0.7 + bands.mid * 0.7)
    }
    if (rim) {
      rim.position.set(Math.sin(time * 0.29) * 3.2, 1.6 + Math.cos(time * 0.21) * 1.2, -4.4)
      rim.color.copy(lights.rim)
      rim.intensity = RIM_CANDELA * level * (0.6 + bands.high * 1.2 + bands.transient * 1.5)
    }
  })

  return (
    <>
      <spotLight ref={keyLight} angle={0.46} penumbra={0.9} decay={2} />
      <pointLight ref={fillLight} decay={2} />
      <pointLight ref={rimLight} decay={2} />
      <Environment frames={Infinity} resolution={256}>
        <StudioPanels />
      </Environment>
    </>
  )
}
