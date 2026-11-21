import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect } from 'postprocessing'
import { useRef } from 'react'
import { HalfFloatType } from 'three'
import { audioEngine } from '../audio/AudioEngine'
import { sceneLive } from './sceneState'

const RESTING_ABERRATION = 0.0005
const TRANSIENT_ABERRATION = 0.0065

export function PostProcessingStack() {
  const bloom = useRef<BloomEffect>(null)
  const aberration = useRef<ChromaticAberrationEffect>(null)

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
  })

  return (
    <EffectComposer multisampling={4} frameBufferType={HalfFloatType}>
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.18} radius={0.82} intensity={1} />
      <ChromaticAberration ref={aberration} radialModulation modulationOffset={0.18} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.22} darkness={0.72} />
      <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.07} />
    </EffectComposer>
  )
}
