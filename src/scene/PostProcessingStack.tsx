import { useFrame } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  GodRays,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect } from 'postprocessing'
import { useEffect, useMemo, useRef, type ReactElement } from 'react'
import { HalfFloatType, type Mesh } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { ImpactBlurEffect } from './ImpactBlurEffect'
import { motion } from './motionState'
import { QUALITY, useQualityStore } from './quality'
import { sceneLive } from './sceneState'

const RESTING_ABERRATION = 0.0005
const TRANSIENT_ABERRATION = 0.0065
const IMPACT_BLUR = 0.045
/**
 * Fixed for the session: changing it rebuilds every pass of the composer, a visible hitch.
 * High density screens are sharp enough without it, and it is the costliest pass there.
 */
const MULTISAMPLING = typeof window !== 'undefined' && window.devicePixelRatio >= 1.5 ? 0 : 2

export function PostProcessingStack({ sun }: { sun: Mesh | null }) {
  const bloom = useRef<BloomEffect>(null)
  const aberration = useRef<ChromaticAberrationEffect>(null)
  const impactBlur = useMemo(() => new ImpactBlurEffect(), [])
  const profile = useQualityStore((state) => QUALITY[state.tier])

  useEffect(() => () => impactBlur.dispose(), [impactBlur])

  useFrame(() => {
    const { bands } = audioEngine
    const { scalars } = sceneLive

    if (bloom.current) {
      bloom.current.intensity = scalars.bloom * (0.85 + bands.rms * 0.5)
    }
    if (aberration.current) {
      const spread = (RESTING_ABERRATION + Math.max(bands.transient, bands.impact) * TRANSIENT_ABERRATION) * (0.35 + scalars.aberration * 1.65)
      aberration.current.offset.set(spread, spread * 0.6)
    }
    impactBlur.strength = Math.max(0, motion.pulse - 0.15) * IMPACT_BLUR
  })

  const effects: ReactElement[] = [
    <Bloom key="bloom" ref={bloom} mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.18} radius={0.82} intensity={1} />,
  ]
  if (profile.godRays && sun) {
    effects.push(<GodRays key="rays" sun={sun} samples={32} density={0.88} decay={0.88} weight={0.1} exposure={0.14} clampMax={1} blur />)
  }
  effects.push(
    <ChromaticAberration key="aberration" ref={aberration} radialModulation modulationOffset={0.18} />,
    <primitive key="impact" object={impactBlur} />,
    <ToneMapping key="tone" mode={ToneMappingMode.ACES_FILMIC} />,
    <Vignette key="vignette" offset={0.22} darkness={0.72} />,
    <Noise key="grain" blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.07} />,
  )

  return (
    <EffectComposer autoClear={false} multisampling={MULTISAMPLING} frameBufferType={HalfFloatType}>
      {effects}
    </EffectComposer>
  )
}
