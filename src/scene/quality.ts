import { create } from 'zustand'

export type QualityTier = 0 | 1 | 2

export interface QualityProfile {
  dpr: number
  /** Most pixels the canvas may render; the pixel ratio drops below `dpr` on large screens. */
  pixels: number
  subdivisions: number
  particles: number
  sand: number
  /** Re-render the reflection cube map once every this many frames. */
  environmentInterval: number
  environmentResolution: number
  godRays: boolean
}

export const QUALITY: Record<QualityTier, QualityProfile> = {
  0: {
    dpr: 1,
    pixels: 1_400_000,
    subdivisions: 40,
    particles: 260,
    sand: 2400,
    environmentInterval: 6,
    environmentResolution: 128,
    godRays: false,
  },
  1: {
    dpr: 1.35,
    pixels: 2_600_000,
    subdivisions: 64,
    particles: 400,
    sand: 4200,
    environmentInterval: 3,
    environmentResolution: 128,
    godRays: false,
  },
  2: {
    dpr: 1.75,
    pixels: 3_800_000,
    subdivisions: 88,
    particles: 520,
    sand: 6400,
    environmentInterval: 2,
    environmentResolution: 256,
    godRays: true,
  },
}

interface BatteryLike {
  level: number
  charging: boolean
}

type NavigatorHints = Navigator & {
  deviceMemory?: number
  getBattery?: () => Promise<BatteryLike>
}

function initialTier(): QualityTier {
  const hints: NavigatorHints = navigator
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const cores = navigator.hardwareConcurrency || 4
  const memory = hints.deviceMemory ?? 8
  if (coarse || memory <= 2 || cores <= 2) return 0
  if (memory <= 4 || cores <= 4 || window.devicePixelRatio > 2.5) return 1
  return 2
}

interface QualityState {
  tier: QualityTier
  /** Highest tier allowed, lowered to 0 while the battery runs low. */
  ceiling: QualityTier
  step: (direction: 1 | -1) => void
  setCeiling: (ceiling: QualityTier) => void
}

const clampTier = (tier: number, ceiling: QualityTier): QualityTier => Math.max(0, Math.min(ceiling, tier)) as QualityTier

export const useQualityStore = create<QualityState>()((set, get) => ({
  tier: initialTier(),
  ceiling: 2,
  step: (direction) => set({ tier: clampTier(get().tier + direction, get().ceiling) }),
  setCeiling: (ceiling) => set({ ceiling, tier: clampTier(get().tier, ceiling) }),
}))

/** Caps quality while the device runs on a low battery, where the API exists. */
export function watchBattery(): void {
  const hints: NavigatorHints = navigator
  void hints.getBattery?.().then((battery) => {
    const apply = () => useQualityStore.getState().setCeiling(!battery.charging && battery.level < 0.2 ? 0 : 2)
    apply()
    const target = battery as BatteryLike & Partial<EventTarget>
    target.addEventListener?.('levelchange', apply)
    target.addEventListener?.('chargingchange', apply)
  })
}
