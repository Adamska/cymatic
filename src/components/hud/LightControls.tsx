import type { CSSProperties } from 'react'
import { LIGHT_INTENSITY_RANGE, OPTIC_RANGES, type OpticKey } from '../../ai/directiveSchema'
import { useStudioStore } from '../../store/useStudioStore'
import { useUiStore } from '../../store/useUiStore'
import { GlassPanel } from './GlassPanel'
import { MorphControl } from './MorphControl'

interface DialProps {
  label: string
  value: number
  range: readonly [number, number]
  onChange: (value: number) => void
}

const OPTIC_DIALS: readonly { key: OpticKey; label: string }[] = [
  { key: 'bloom', label: 'Bloom' },
  { key: 'turbulence', label: 'Turbulence' },
  { key: 'displacement', label: 'Depth' },
  { key: 'flow', label: 'Flow' },
  { key: 'iridescence', label: 'Thin film' },
  { key: 'aberration', label: 'Aberration' },
]

function Dial({ label, value, range: [min, max], onChange }: DialProps) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="label-caps text-white/50">{label}</span>
        <span className="font-mono text-[0.625rem] text-white/75 tabular-nums">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="optic-range mt-1 w-full"
        style={{ '--fill': `${fill}%` } as CSSProperties}
      />
    </label>
  )
}

/**
 * The light rig: a side panel on desktop, a bottom sheet toggled from the action bar on
 * phones, where the dials sit in two columns to stay within thumb reach.
 */
export function LightControls() {
  const optics = useStudioStore((state) => state.directive.optics)
  const lights = useStudioStore((state) => state.directive.lights)
  const sheetOpen = useUiStore((state) => state.panel === 'rig')
  const { tuneOptic, tuneLightIntensity } = useStudioStore.getState()

  return (
    <GlassPanel
      className={`absolute inset-x-3 bottom-36 z-20 max-h-[50vh] overflow-y-auto rounded-3xl px-4 py-4 md:inset-x-auto md:top-1/2 md:right-5 md:bottom-auto md:block md:max-h-[calc(100dvh-16rem)] md:w-44 md:-translate-y-1/2 ${
        sheetOpen ? 'block' : 'hidden'
      }`}
    >
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="label-caps text-white/85">Light rig</h2>
        <div className="flex gap-1" aria-hidden="true">
          {[lights.key, lights.fill, lights.rim].map((color, index) => (
            <span
              key={index}
              className="h-2 w-2 rounded-full transition-colors duration-1000"
              style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 md:grid-cols-1">
        <Dial label="Intensity" value={lights.intensity} range={LIGHT_INTENSITY_RANGE} onChange={tuneLightIntensity} />
        {OPTIC_DIALS.map(({ key, label }) => (
          <Dial key={key} label={label} value={optics[key]} range={OPTIC_RANGES[key]} onChange={(value) => tuneOptic(key, value)} />
        ))}
      </div>
      <MorphControl />
    </GlassPanel>
  )
}
