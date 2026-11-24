import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { PerspectiveCamera } from 'three'
import { captureState } from '../capture/capture'
import { motion } from './motionState'

const BASE_FOV = 34
const BASE_SPIN = 0.35

interface SpinningControls {
  autoRotateSpeed: number
}

const hasSpin = (controls: unknown): controls is SpinningControls =>
  typeof controls === 'object' && controls !== null && 'autoRotateSpeed' in controls

/** The camera listens too: the orbit speeds up with energy and the lens punches in on impacts. */
export function CameraDirector() {
  const controls = useThree((state) => state.controls)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useFrame(({ camera }, delta) => {
    if (hasSpin(controls)) controls.autoRotateSpeed = BASE_SPIN + motion.charge * 1.1 + motion.pulse * 1.8
    if (reduced || !(camera instanceof PerspectiveCamera)) return
    const goal = BASE_FOV - motion.pulse * 2.6 - motion.charge * 1.2
    camera.fov += (goal - camera.fov) * (1 - Math.exp(-delta * 9))
    camera.updateProjectionMatrix()
  })
  return null
}

/**
 * Takes still captures right after the composer has drawn, while the drawing buffer is
 * still intact. A still raises the pixel ratio for two frames, encodes, then restores it.
 */
export function CaptureDriver() {
  const gl = useThree((state) => state.gl)
  const setDpr = useThree((state) => state.setDpr)

  useEffect(() => {
    captureState.canvas = gl.domElement
    return () => {
      captureState.canvas = null
    }
  }, [gl])

  useFrame(() => {
    const still = captureState.still
    if (!still) return
    if (still.framesLeft === 2) {
      still.restoreRatio = gl.getPixelRatio()
      setDpr(Math.max(still.restoreRatio, captureState.stillPixelRatio))
    }
    if (still.framesLeft-- > 0) return
    captureState.still = null
    gl.domElement.toBlob((blob) => still.resolve(blob), 'image/png')
    setDpr(still.restoreRatio)
  }, 10)

  return null
}
