import { LIGHT_INTENSITY_RANGE, OPTIC_RANGES } from '../ai/directiveSchema'
import { PRESETS } from '../ai/presets'
import { audioEngine } from '../audio/AudioEngine'
import { captureName, downloadBlob, recordClip, requestStill } from '../capture/capture'
import { useStudioStore } from '../store/useStudioStore'
import { useUiStore } from '../store/useUiStore'
import { connectMidi, type MidiDial } from './midiBridge'
import { copyText, shareUrl } from './shareLink'

const CLIP_SECONDS = 10
let disconnectMidi: (() => void) | null = null

const studio = () => useStudioStore.getState()
const ui = () => useUiStore.getState()

/** Steps through the preset library from the cue on stage. */
export function stepCue(direction: 1 | -1): void {
  const { directive, setDirective } = studio()
  const current = PRESETS.findIndex((preset) => preset.directive.title === directive.title)
  const next = current < 0 ? (direction > 0 ? 0 : PRESETS.length - 1) : (current + direction + PRESETS.length) % PRESETS.length
  const preset = PRESETS[next]
  if (preset) setDirective(preset.directive, 'preset')
}

export function togglePlayback(): void {
  audioEngine.player?.toggle()
}

export async function shareCue(): Promise<void> {
  const url = shareUrl(studio().directive)
  window.history.replaceState(null, '', url)
  const copied = await copyText(url)
  studio().notify(copied ? 'Link copied. It reopens this exact cue.' : 'The link is in the address bar, ready to copy.')
}

export async function takeStill(): Promise<void> {
  const blob = await requestStill()
  if (blob) downloadBlob(blob, captureName(studio().directive.title, 'png'))
  else studio().notify('The still could not be captured.')
}

export async function recordVideo(): Promise<void> {
  if (ui().recording) return
  ui().setRecording(true)
  const clip = await recordClip(audioEngine.recordingStream(), CLIP_SECONDS)
  ui().setRecording(false)
  if (clip) downloadBlob(clip.blob, captureName(studio().directive.title, clip.extension))
  else studio().notify('Video recording is not supported in this browser.')
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.().catch(() => undefined)
}

function tuneDial(dial: MidiDial, value: number): void {
  const [min, max] = dial === 'intensity' ? LIGHT_INTENSITY_RANGE : OPTIC_RANGES[dial]
  const scaled = min + (max - min) * value
  if (dial === 'intensity') studio().tuneLightIntensity(scaled)
  else studio().tuneOptic(dial, scaled)
}

/** Loaded on demand so the 3D runtime stays out of the interface bundle. */
async function strikeFromNote(note: number, velocity: number): Promise<void> {
  void audioEngine.strike(440 * 2 ** ((note - 69) / 12), velocity)
  const [{ Vector3 }, { strike }] = await Promise.all([import('three'), import('../scene/motionState')])
  const angle = ((note % 12) / 12) * Math.PI * 2
  strike(new Vector3(Math.cos(angle) * 0.7, ((note % 24) / 24 - 0.5) * 1.4, 0.8), 0.4 + velocity * 0.8)
}

/** Requests Web MIDI access. Knobs learn the light rig dials, keys strike the sculpture. */
export async function connectMidiDevice(): Promise<void> {
  if (!('requestMIDIAccess' in navigator)) {
    studio().notify('Web MIDI is not available in this browser.')
    return
  }
  try {
    disconnectMidi?.()
    disconnectMidi = await connectMidi({
      onControl: tuneDial,
      onNote: (note, velocity) => void strikeFromNote(note, velocity),
      onProgram: () => stepCue(1),
      onDevices: (names) => {
        ui().setMidiDevice(names[0] ?? null)
        studio().notify(names.length > 0 ? `MIDI: ${names.join(', ')}. Turn a knob to map it.` : 'No MIDI device found yet.')
      },
    })
  } catch {
    studio().notify('MIDI access was declined.')
  }
}
