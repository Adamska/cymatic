/** Mode pairs (n, m) of a free square plate, ordered roughly by pitch. Equal pairs cancel out. */
const MODES: readonly (readonly [number, number])[] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [2, 5],
  [1, 5],
  [3, 5],
  [4, 5],
  [2, 7],
  [3, 7],
  [5, 6],
]
const PI = Math.PI

export const MODE_COUNT = MODES.length

export interface PlateSample {
  value: number
  dx: number
  dy: number
}

/**
 * Chladni displacement f = cos(n pi x) cos(m pi y) + cos(m pi x) cos(n pi y) and its gradient,
 * blended between two neighbouring modes so the figure morphs instead of snapping. The
 * symmetric form gives the rings and rosettes of a struck plate; the antisymmetric one
 * always cancels on both diagonals and draws a cross over every figure.
 */
export function samplePlate(x: number, y: number, mode: number, out: PlateSample): PlateSample {
  const lower = Math.max(0, Math.min(MODE_COUNT - 1, Math.floor(mode)))
  const upper = Math.min(MODE_COUNT - 1, lower + 1)
  const weight = Math.min(1, Math.max(0, mode - lower))
  out.value = 0
  out.dx = 0
  out.dy = 0
  accumulate(x, y, MODES[lower] ?? [1, 2], 1 - weight, out)
  if (weight > 0) accumulate(x, y, MODES[upper] ?? [1, 2], weight, out)
  return out
}

function accumulate(x: number, y: number, [n, m]: readonly [number, number], weight: number, out: PlateSample): void {
  const nx = n * PI * x
  const ny = n * PI * y
  const mx = m * PI * x
  const my = m * PI * y
  const cnx = Math.cos(nx)
  const cny = Math.cos(ny)
  const cmx = Math.cos(mx)
  const cmy = Math.cos(my)
  out.value += (cnx * cmy + cmx * cny) * weight
  out.dx += (-n * PI * Math.sin(nx) * cmy - m * PI * Math.sin(mx) * cny) * weight
  out.dy += (-m * PI * cnx * Math.sin(my) - n * PI * cmx * Math.sin(ny)) * weight
}

/** Spectral centroid of the leveled byte spectrum mapped log-linearly to [0, 1]. */
export function spectralCentroid(spectrum: Uint8Array, binHz: number, fromHz: number, toHz: number): number {
  const first = Math.max(1, Math.floor(fromHz / binHz))
  const last = Math.min(spectrum.length - 1, Math.ceil(toHz / binHz))
  let weighted = 0
  let total = 0
  for (let bin = first; bin <= last; bin++) {
    const level = spectrum[bin] ?? 0
    weighted += Math.log(bin * binHz) * level
    total += level
  }
  if (total < 1) return -1
  const centroid = weighted / total
  return (centroid - Math.log(fromHz)) / (Math.log(toHz) - Math.log(fromHz))
}
