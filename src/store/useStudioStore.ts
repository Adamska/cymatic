import { create } from 'zustand'
import type { OpticKey, SceneDirective } from '../ai/directiveSchema'
import { DEFAULT_DIRECTIVE } from '../ai/presets'
import { directScene } from '../ai/sceneDirector'
import { audioEngine, type AudioSourceKind } from '../audio/AudioEngine'
import type { PlaybackOptions } from '../audio/FilePlayer'
import type { SampleTrack } from '../audio/sampleTracks'

export type DirectiveOrigin = 'default' | 'model' | 'preset' | 'shared' | 'auto' | 'history' | 'morph'

export interface CueEntry {
  id: number
  directive: SceneDirective
}

interface StudioState {
  engaged: boolean
  source: AudioSourceKind
  trackName: string | null
  volume: number
  directive: SceneDirective
  origin: DirectiveOrigin
  history: readonly CueEntry[]
  directing: boolean
  notice: string | null
  engage: () => Promise<void>
  selectSynth: () => void
  selectMicrophone: () => Promise<void>
  selectTab: () => Promise<void>
  loadFile: (file: File) => Promise<void>
  loadTrack: (track: SampleTrack) => Promise<void>
  playBlob: (blob: Blob, trackName: string, options?: PlaybackOptions) => Promise<boolean>
  setVolume: (volume: number) => void
  direct: (prompt: string) => Promise<void>
  setDirective: (directive: SceneDirective, origin: DirectiveOrigin) => void
  tuneOptic: (key: OpticKey, value: number) => void
  tuneLightIntensity: (value: number) => void
  notify: (notice: string | null) => void
}

const AUDIO_FILE_PATTERN = /\.(mp3|wav|ogg|oga|m4a|flac|aac)$/i
const HISTORY_LIMIT = 8
const REMEMBERED_ORIGINS: ReadonlySet<DirectiveOrigin> = new Set(['default', 'model', 'preset', 'shared', 'auto'])
let pendingDirection: AbortController | null = null
let nextCueId = 1

export const useStudioStore = create<StudioState>()((set, get) => ({
  engaged: false,
  source: 'synth',
  trackName: null,
  volume: 0.8,
  directive: DEFAULT_DIRECTIVE,
  origin: 'default',
  history: [{ id: 0, directive: DEFAULT_DIRECTIVE }],
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

  selectTab: async () => {
    try {
      await audioEngine.useTab(() => {
        if (get().source === 'tab') set({ notice: 'Tab sharing stopped.' })
      })
      set({ engaged: true, source: 'tab', trackName: null, notice: null })
    } catch {
      set({ notice: 'Share a tab and tick "Share tab audio" to analyse it.' })
    }
  },

  loadFile: async (file) => {
    if (!file.type.startsWith('audio/') && !AUDIO_FILE_PATTERN.test(file.name)) {
      set({ notice: 'Drop an MP3, WAV or OGG file.' })
      return
    }
    await get().playBlob(file, file.name.replace(/\.[^.]+$/, ''))
  },

  loadTrack: async (track) => {
    try {
      const response = await fetch(track.url)
      if (!response.ok) throw new Error(`Track request failed with ${response.status}`)
      await get().playBlob(await response.blob(), track.title)
    } catch {
      set({ notice: 'The sample track could not be loaded.' })
    }
  },

  playBlob: async (blob, trackName, options) => {
    try {
      await audioEngine.playFile(blob, options)
      set({ engaged: true, source: 'file', trackName, notice: null })
      return true
    } catch {
      set({ notice: 'That file could not be decoded.' })
      return false
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
      set({ directing: false })
      get().setDirective(directive, source)
    } catch {
      if (pendingDirection === controller) set({ directing: false })
    }
  },

  setDirective: (directive, origin) => {
    const remember = REMEMBERED_ORIGINS.has(origin)
    const history = remember ? [{ id: nextCueId++, directive }, ...get().history].slice(0, HISTORY_LIMIT) : get().history
    set({ directive, origin, history })
  },

  tuneOptic: (key, value) => {
    const { directive } = get()
    set({ directive: { ...directive, optics: { ...directive.optics, [key]: value } } })
  },

  tuneLightIntensity: (value) => {
    const { directive } = get()
    set({ directive: { ...directive, lights: { ...directive.lights, intensity: value } } })
  },

  notify: (notice) => set({ notice }),
}))
