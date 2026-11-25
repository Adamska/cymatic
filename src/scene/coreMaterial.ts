import { CubeTexture, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three'
import fragmentShader from '../shaders/opticalCore.frag?raw'
import vertexShader from '../shaders/opticalCore.vert?raw'
import { motion, strikeState } from './motionState'
import './shaderChunks'
import { cueWave, targetPalette } from './sceneState'
import type { SpectrumField } from './spectrumField'

const ENVIRONMENT_INTENSITY = 1.15

export function createCoreUniforms(field: SpectrumField) {
  return {
    uTime: { value: 0 },
    uPhase: { value: motion.phase },
    uBands: { value: motion.bands },
    uPitch: { value: 0.5 },
    uKickAge: { value: 99 },
    uKickForce: { value: 0 },
    uSnapAge: { value: 99 },
    uSnapForce: { value: 0 },
    uStretch: { value: new Vector3(1, 1, 1) },
    uAirGlow: { value: 0 },
    uBass: { value: 0 },
    uHigh: { value: 0 },
    uRms: { value: 0 },
    uShimmer: { value: 0 },
    uSpectrum: { value: field.texture },
    uSpectrumMean: { value: 0 },
    uTurbulence: { value: 1 },
    uDisplacement: { value: 0.4 },
    uIridescence: { value: 0.6 },
    uEnvIntensity: { value: ENVIRONMENT_INTENSITY },
    uEnvMap: { value: null as CubeTexture | null },
    uPaletteOffset: { value: targetPalette.offset },
    uPaletteAmplitude: { value: targetPalette.amplitude },
    uPaletteFrequency: { value: targetPalette.frequency },
    uPalettePhase: { value: targetPalette.phase },
    uFromOffset: { value: cueWave.from.offset },
    uFromAmplitude: { value: cueWave.from.amplitude },
    uFromFrequency: { value: cueWave.from.frequency },
    uFromPhase: { value: cueWave.from.phase },
    uWave: { value: 1 },
    uWaveOrigin: { value: new Vector3(0, 0, 1) },
    uStrikeDir: { value: strikeState.direction },
    uStrikeAge: { value: 99 },
    uStrikeForce: { value: 0 },
  }
}

export type CoreUniforms = ReturnType<typeof createCoreUniforms>

export function createCoreMaterial(uniforms: CoreUniforms): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    lights: true,
    uniforms: { ...UniformsUtils.clone(UniformsLib.lights), ...uniforms },
  })
}
