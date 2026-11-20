import { create } from 'zustand'
import type { OpticKey, SceneDirective } from '../ai/directiveSchema'
import { DEFAULT_DIRECTIVE } from '../ai/presets'
import { directScene } from '../ai/sceneDirector'
import { audioEngine, type AudioSourceKind } from '../audio/AudioEngine'

export type DirectiveOrigin = 'default' | 'model' | 'preset'

interface StudioState {
  engaged: boolean
  source: AudioSourceKind
  trackName: string | null
  volume: number
  directive: SceneDirective
  origin: DirectiveOrigin
  directing: boolean
  notice: string | null
  engage: () => Promise<void>
  selectSynth: () => void
  selectMicrophone: () => Promise<void>
  loadFile: (file: File) => Promise<void>
  setVolume: (volume: number) => void
  direct: (prompt: string) => Promise<void>
  tuneOptic: (key: OpticKey, value: number) => void
  tuneLightIntensity: (value: number) => void
  dismissNotice: () => void
}

const AUDIO_FILE_PATTERN = /\.(mp3|wav|ogg|oga|m4a|flac|aac)$/i
let pendingDirection: AbortController | null = null

export const useStudioStore = create<StudioState>()((set, get) => ({
  engaged: false,
  source: 'synth',
  trackName: null,
  volume: 0.8,
  directive: DEFAULT_DIRECTIVE,
  origin: 'default',
  directing: false,
  notice: null,

  engage: async () => {
    try {
      await audioEngine.engage()
      set({ engaged: true, source: 'synth', trackName: null, notice: null })
    } catch {
      set({ notice: 'Audio could not start in this browser.' })
    }
  },

  selectSynth: () => {
    audioEngine.useSynth()
    set({ source: 'synth', trackName: null })
  },

  selectMicrophone: async () => {
    try {
      await audioEngine.useMicrophone()
      set({ engaged: true, source: 'microphone', trackName: null, notice: null })
    } catch {
      set({ notice: 'Microphone access was declined.' })
    }
  },

  loadFile: async (file) => {
    if (!file.type.startsWith('audio/') && !AUDIO_FILE_PATTERN.test(file.name)) {
      set({ notice: 'Drop an MP3, WAV or OGG file.' })
      return
    }
    try {
      await audioEngine.playFile(file)
      set({ engaged: true, source: 'file', trackName: file.name.replace(/\.[^.]+$/, ''), notice: null })
    } catch {
      set({ notice: 'That file could not be decoded.' })
    }
  },

  setVolume: (volume) => {
    audioEngine.setVolume(volume)
    set({ volume })
  },

  direct: async (prompt) => {
    const trimmed = prompt.trim()
    if (!trimmed) return

    pendingDirection?.abort()
    const controller = new AbortController()
    pendingDirection = controller
    set({ directing: true })

    try {
      const { directive, source } = await directScene(trimmed, controller.signal)
      set({ directive, origin: source, directing: false })
    } catch {
      if (pendingDirection === controller) set({ directing: false })
    }
  },

  tuneOptic: (key, value) => {
    const { directive } = get()
    set({ directive: { ...directive, optics: { ...directive.optics, [key]: value } } })
  },

  tuneLightIntensity: (value) => {
    const { directive } = get()
    set({ directive: { ...directive, lights: { ...directive.lights, intensity: value } } })
  },

  dismissNotice: () => set({ notice: null }),
}))
