import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { CubeCamera, HalfFloatType, Scene, WebGLCubeRenderTarget } from 'three'
import { QUALITY, useQualityStore } from './quality'

/**
 * Renders `children` into a private scene and captures it as the reflection cube map.
 * The capture is throttled by the quality tier: six faces per frame is the single most
 * expensive pass in the studio, and the light panels move slowly enough to skip frames.
 */
export function StudioEnvironment({ children }: { children: ReactNode }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const interval = useQualityStore((state) => QUALITY[state.tier].environmentInterval)
  const resolution = useQualityStore((state) => QUALITY[state.tier].environmentResolution)
  const studio = useMemo(() => new Scene(), [])
  const frame = useRef(0)

  const { target, camera } = useMemo(() => {
    const cubeTarget = new WebGLCubeRenderTarget(resolution, { type: HalfFloatType, generateMipmaps: false })
    return { target: cubeTarget, camera: new CubeCamera(0.1, 100, cubeTarget) }
  }, [resolution])

  useEffect(() => {
    scene.environment = target.texture
    frame.current = 0
    return () => {
      if (scene.environment === target.texture) scene.environment = null
      target.dispose()
    }
  }, [scene, target])

  useFrame(() => {
    if (frame.current++ % interval === 0) camera.update(gl, studio)
  })

  return createPortal(children, studio)
}
