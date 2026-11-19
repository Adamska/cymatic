import type { SceneDirective } from './directiveSchema'

export interface DirectivePreset {
  keywords: readonly string[]
  directive: SceneDirective
}

const aurora: DirectivePreset = {
  keywords: ['aurora', 'arctic', 'polar', 'ice', 'glacier', 'frost', 'north', 'borealis', 'cold', 'winter', 'snow', 'mint'],
  directive: {
    title: 'Arctic Aurora',
    note: 'Cold green curtains fold over a slow glass tide while an open ninth hangs in the air.',
    palette: { offset: [0.2, 0.55, 0.55], amplitude: [0.2, 0.4, 0.4], frequency: [1, 1, 1], phase: [0.6, 0.25, 0.45] },
    lights: { key: '#9ff5d6', fill: '#3f6bff', rim: '#c9a6ff', intensity: 1 },
    optics: { bloom: 1.1, turbulence: 0.85, displacement: 0.36, flow: 0.45, iridescence: 0.85, aberration: 0.3 },
    synth: { rootHz: 49, intervals: [0, 7, 14, 16], filterCutoff: 1800, resonance: 3, lfoRate: 0.08, subLevel: 0.55 },
  },
}

const solarFlare: DirectivePreset = {
  keywords: ['solar', 'flare', 'crimson', 'sun', 'fire', 'ember', 'lava', 'magma', 'red', 'heat', 'inferno', 'volcano', 'blood', 'scarlet'],
  directive: {
    title: 'Crimson Flare',
    note: 'A red giant exhales: burnt orange key, crimson fill and a minor seventh grinding over deep sub.',
    palette: { offset: [0.68, 0.2, 0.08], amplitude: [0.32, 0.2, 0.08], frequency: [1, 1, 1], phase: [0, 0.1, 0.2] },
    lights: { key: '#ff8a3d', fill: '#ff1f4b', rim: '#ffd08a', intensity: 1.1 },
    optics: { bloom: 1.5, turbulence: 1.25, displacement: 0.44, flow: 0.95, iridescence: 0.35, aberration: 0.7 },
    synth: { rootHz: 36.7, intervals: [0, 7, 10, 15], filterCutoff: 900, resonance: 8, lfoRate: 0.35, subLevel: 1 },
  },
}

const abyss: DirectivePreset = {
  keywords: ['abyss', 'ocean', 'sea', 'deep', 'tide', 'underwater', 'bioluminescent', 'marine', 'wave', 'water', 'blue', 'trench', 'whale'],
  directive: {
    title: 'Luminous Abyss',
    note: 'Pressure and patience. Cyan plankton light drifts across navy while hollow fifths breathe below.',
    palette: { offset: [0.08, 0.3, 0.5], amplitude: [0.08, 0.28, 0.42], frequency: [1, 1, 1], phase: [0.5, 0.35, 0.2] },
    lights: { key: '#4fd8ff', fill: '#1b2cff', rim: '#7dffd9', intensity: 0.85 },
    optics: { bloom: 0.95, turbulence: 0.7, displacement: 0.42, flow: 0.3, iridescence: 0.6, aberration: 0.25 },
    synth: { rootHz: 41.2, intervals: [0, 7, 12, 19], filterCutoff: 600, resonance: 5, lfoRate: 0.05, subLevel: 0.85 },
  },
}

const nebula: DirectivePreset = {
  keywords: ['nebula', 'cosmic', 'galaxy', 'space', 'violet', 'purple', 'star', 'void', 'zero', 'gravity', 'astral', 'orbit', 'magenta'],
  directive: {
    title: 'Violet Nebula',
    note: 'Magenta gas against teal starlight, weightless, with a lydian shimmer suspended above the drone.',
    palette: { offset: [0.5, 0.28, 0.6], amplitude: [0.45, 0.25, 0.4], frequency: [1, 1, 1], phase: [0, 0.4, 0.2] },
    lights: { key: '#d39bff', fill: '#ff4fb8', rim: '#5ee6ff', intensity: 1.05 },
    optics: { bloom: 1.35, turbulence: 1.05, displacement: 0.48, flow: 0.55, iridescence: 0.75, aberration: 0.45 },
    synth: { rootHz: 55, intervals: [0, 4, 11, 18], filterCutoff: 2400, resonance: 4, lfoRate: 0.12, subLevel: 0.6 },
  },
}

const goldenHour: DirectivePreset = {
  keywords: ['gold', 'golden', 'amber', 'dusk', 'sunset', 'honey', 'desert', 'dune', 'warm', 'molten', 'copper', 'bronze', 'dawn'],
  directive: {
    title: 'Molten Gold',
    note: 'Low sun through honey. Soft bronze fill, a warm major seventh and almost no hurry.',
    palette: { offset: [0.8, 0.55, 0.3], amplitude: [0.25, 0.3, 0.25], frequency: [1, 1, 1], phase: [0, 0.1, 0.25] },
    lights: { key: '#ffd9a0', fill: '#ff8a4c', rim: '#fff4d6', intensity: 1.1 },
    optics: { bloom: 1.25, turbulence: 0.8, displacement: 0.34, flow: 0.4, iridescence: 0.45, aberration: 0.2 },
    synth: { rootHz: 65.4, intervals: [0, 4, 7, 11], filterCutoff: 2000, resonance: 2, lfoRate: 0.1, subLevel: 0.5 },
  },
}

const pearl: DirectivePreset = {
  keywords: ['pearl', 'opal', 'porcelain', 'silk', 'pastel', 'milk', 'cloud', 'soap', 'bubble', 'ivory', 'prism', 'crystal', 'white'],
  directive: {
    title: 'Opaline Glass',
    note: 'A soap film catching studio light: pale spectrum, wide softboxes and a bright six-nine chord.',
    palette: { offset: [0.72, 0.7, 0.76], amplitude: [0.2, 0.2, 0.2], frequency: [1, 1, 1], phase: [0, 0.33, 0.67] },
    lights: { key: '#f4f7ff', fill: '#ffc9ec', rim: '#bff3ff', intensity: 0.95 },
    optics: { bloom: 1, turbulence: 0.65, displacement: 0.28, flow: 0.35, iridescence: 1, aberration: 0.35 },
    synth: { rootHz: 73.4, intervals: [0, 7, 9, 16], filterCutoff: 3200, resonance: 1.5, lfoRate: 0.07, subLevel: 0.35 },
  },
}

const canopy: DirectivePreset = {
  keywords: ['forest', 'moss', 'jungle', 'emerald', 'green', 'rain', 'fern', 'canopy', 'garden', 'jade', 'spring', 'leaf', 'botanical'],
  directive: {
    title: 'Emerald Canopy',
    note: 'Wet leaves under a broken sky, lime highlights on deep jade and a suspended chord that never resolves.',
    palette: { offset: [0.22, 0.5, 0.25], amplitude: [0.2, 0.38, 0.2], frequency: [1, 1, 1], phase: [0.3, 0, 0.15] },
    lights: { key: '#d8ff9a', fill: '#1fae7a', rim: '#fff2b0', intensity: 1 },
    optics: { bloom: 1.05, turbulence: 1.2, displacement: 0.4, flow: 0.5, iridescence: 0.55, aberration: 0.3 },
    synth: { rootHz: 58.3, intervals: [0, 5, 7, 14], filterCutoff: 1300, resonance: 3, lfoRate: 0.09, subLevel: 0.6 },
  },
}

const mercury: DirectivePreset = {
  keywords: ['mercury', 'chrome', 'storm', 'steel', 'silver', 'graphite', 'thunder', 'noir', 'obsidian', 'metal', 'monochrome', 'lightning', 'machine'],
  directive: {
    title: 'Mercury Storm',
    note: 'Liquid metal under strobing sky. Cold white key, electric rim and a tritone cluster with teeth.',
    palette: { offset: [0.32, 0.34, 0.38], amplitude: [0.3, 0.3, 0.32], frequency: [1, 1, 1], phase: [0, 0.03, 0.08] },
    lights: { key: '#e8f0ff', fill: '#4a5a7a', rim: '#6ea8ff', intensity: 1.3 },
    optics: { bloom: 1.4, turbulence: 1.6, displacement: 0.46, flow: 1.3, iridescence: 0.5, aberration: 0.85 },
    synth: { rootHz: 34.6, intervals: [0, 6, 7, 13], filterCutoff: 1100, resonance: 10, lfoRate: 0.6, subLevel: 0.9 },
  },
}

export const PRESETS: readonly DirectivePreset[] = [aurora, solarFlare, abyss, nebula, goldenHour, pearl, canopy, mercury]

export const DEFAULT_DIRECTIVE: SceneDirective = aurora.directive

export const PROMPT_CHIPS: readonly string[] = [
  'Arctic aurora over liquid glass',
  'Crimson solar flare with heavy sub-bass',
  'Bioluminescent abyss, slow tide',
  'Molten gold at dusk',
  'Violet nebula in zero gravity',
  'Mercury storm, violent and fast',
]
