import { create } from 'zustand'

export type Panel = 'tracks' | 'playlist' | 'rig' | 'help' | null

interface UiState {
  /** Hidden on purpose with the H key, as opposed to faded out while the pointer rests. */
  hudHidden: boolean
  idle: boolean
  panel: Panel
  autoDirector: boolean
  recording: boolean
  midiDevice: string | null
  showcase: boolean
  toggleHud: () => void
  setIdle: (idle: boolean) => void
  openPanel: (panel: Panel) => void
  togglePanel: (panel: Exclude<Panel, null>) => void
  setAutoDirector: (enabled: boolean) => void
  setRecording: (recording: boolean) => void
  setMidiDevice: (device: string | null) => void
  setShowcase: (showcase: boolean) => void
}

export const useUiStore = create<UiState>()((set, get) => ({
  hudHidden: false,
  idle: false,
  panel: null,
  autoDirector: false,
  recording: false,
  midiDevice: null,
  showcase: false,
  toggleHud: () => set({ hudHidden: !get().hudHidden }),
  setIdle: (idle) => set({ idle }),
  openPanel: (panel) => set({ panel }),
  togglePanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
  setAutoDirector: (autoDirector) => set({ autoDirector }),
  setRecording: (recording) => set({ recording }),
  setMidiDevice: (midiDevice) => set({ midiDevice }),
  setShowcase: (showcase) => set({ showcase }),
}))
