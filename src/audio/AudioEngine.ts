import type { SynthPatch } from './AmbientSynth'
import { createAudioGraph, disposeAudioGraph, recordingStream, type AudioGraph } from './audioGraph'
import { BandDynamics } from './BandDynamics'
import { BandTracker, type AudioBands } from './BandTracker'
import { FilePlayer, type PlaybackOptions } from './FilePlayer'
import { SpectrumGate } from './SpectrumGate'
import { StrikeVoice } from './strikeVoice'

export type AudioSourceKind = 'synth' | 'file' | 'microphone' | 'tab'

const FFT_SIZE = 4096
const FADE_SECONDS = 0.35
const RESUME_TIMEOUT_MS = 400
const DEFAULT_PATCH: SynthPatch = {
  rootHz: 55,
  intervals: [0, 7, 12, 16],
  filterCutoff: 1400,
  resonance: 4,
  lfoRate: 0.12,
  subLevel: 0.7,
}

export class AudioEngine {
  readonly spectrum = new Uint8Array(FFT_SIZE / 2)

  private readonly spectrumDb = new Float32Array(FFT_SIZE / 2)
  private readonly waveform = new Float32Array(FFT_SIZE)
  private readonly tracker = new BandTracker()
  private readonly bandDynamics = new BandDynamics()
  private readonly gate = new SpectrumGate(FFT_SIZE / 2)
  private graph: AudioGraph | null = null
  private filePlayer: FilePlayer | null = null
  private strikeVoice: StrikeVoice | null = null
  private streamNode: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private patch: SynthPatch = DEFAULT_PATCH
  private volume = 0.8

  get bands(): AudioBands {
    return this.tracker.bands
  }

  /** Per-band levels and accents for the sculpture. */
  get dynamics(): BandDynamics {
    return this.bandDynamics
  }

  get gainDb(): number {
    return this.tracker.gainDb
  }

  get sampleRate(): number {
    return this.graph?.context.sampleRate ?? 48000
  }

  get binHz(): number {
    return this.sampleRate / FFT_SIZE
  }

  /** The file transport, or null while no file has been loaded. */
  get player(): FilePlayer | null {
    return this.filePlayer?.loaded ? this.filePlayer : null
  }

  async engage(): Promise<void> {
    await this.ensureGraph()
    this.useSynth()
  }

  useSynth(): void {
    this.releaseExternalSources()
    this.recalibrate()
    this.fadeSynth(1)
  }

  async playFile(file: Blob, options: PlaybackOptions = { loop: true }): Promise<void> {
    const { context, bus } = await this.ensureGraph()
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    this.releaseExternalSources()
    this.recalibrate()
    this.fadeSynth(0)
    this.filePlayer ??= new FilePlayer(context, bus)
    this.filePlayer.load(buffer, options)
  }

  async useMicrophone(): Promise<void> {
    await this.ensureGraph()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    })
    this.attachStream(stream)
  }

  /** Captures the audio of another tab or window. The browser asks the user what to share. */
  async useTab(onEnded: () => void): Promise<void> {
    await this.ensureGraph()
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    stream.getVideoTracks().forEach((track) => track.stop())
    const [audio] = stream.getAudioTracks()
    if (!audio) throw new Error('The shared surface carries no audio')
    audio.addEventListener('ended', onEnded, { once: true })
    this.attachStream(stream)
  }

  /** Strikes the sculpture through the analysed bus, voiced to sit inside the music playing. */
  async strike(frequency: number, velocity: number): Promise<void> {
    const { context, bus } = await this.ensureGraph()
    this.strikeVoice ??= new StrikeVoice(context, bus)
    const loudness = this.tracker.bands.rms
    const brightness = loudness < 0.05 ? 0.35 : this.bandDynamics.brightness
    this.strikeVoice.play(frequency, velocity, { brightness, loudness })
  }

  applyPatch(patch: SynthPatch): void {
    this.patch = patch
    this.graph?.synth.apply(patch)
  }

  setVolume(volume: number): void {
    this.volume = volume
    this.graph?.master.gain.setTargetAtTime(volume, this.graph.context.currentTime, 0.05)
  }

  recordingStream(): MediaStream | null {
    return this.graph ? recordingStream(this.graph) : null
  }

  update(delta: number): void {
    if (!this.graph) return
    const { spectrumDb, waveform, tracker } = this
    this.graph.analyser.getFloatFrequencyData(spectrumDb)
    this.graph.analyser.getFloatTimeDomainData(waveform)
    tracker.update(spectrumDb, waveform, this.binHz, delta)
    this.bandDynamics.update(spectrumDb, this.binHz, tracker.gainDb, tracker.bands.rms, delta)
    this.gate.apply(spectrumDb, tracker.gainDb, delta, this.spectrum)
  }

  dispose(): void {
    this.releaseExternalSources()
    this.filePlayer = null
    this.strikeVoice = null
    if (this.graph) disposeAudioGraph(this.graph)
    this.graph = null
    this.spectrum.fill(0)
    this.tracker.reset()
    this.bandDynamics.reset()
    this.gate.reset()
  }

  private attachStream(stream: MediaStream): void {
    if (!this.graph) return
    this.releaseExternalSources()
    this.recalibrate()
    this.fadeSynth(0)
    this.stream = stream
    this.streamNode = this.graph.context.createMediaStreamSource(stream)
    this.streamNode.connect(this.graph.analyser)
  }

  private async ensureGraph(): Promise<AudioGraph> {
    if (!this.graph) {
      const graph = (this.graph = createAudioGraph(FFT_SIZE, this.patch, this.volume))
      // The strike hall takes a moment to build; prepare it before the first click needs it.
      window.setTimeout(() => this.graph === graph && (this.strikeVoice ??= new StrikeVoice(graph.context, graph.bus)), 1500)
    }
    const { context } = this.graph
    if (context.state === 'suspended') {
      const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, RESUME_TIMEOUT_MS))
      await Promise.race([context.resume(), timeout])
      if (context.state === 'suspended') {
        window.addEventListener('pointerdown', () => void context.resume(), { once: true })
      }
    }
    return this.graph
  }

  private recalibrate(): void {
    this.tracker.recalibrate()
    this.bandDynamics.reset()
    this.gate.reset()
  }

  private fadeSynth(level: number): void {
    if (!this.graph) return
    this.graph.synthGain.gain.setTargetAtTime(level, this.graph.context.currentTime, FADE_SECONDS)
  }

  private releaseExternalSources(): void {
    this.filePlayer?.stop()
    this.streamNode?.disconnect()
    this.streamNode = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }
}

export const audioEngine = new AudioEngine()
