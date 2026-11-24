import { AmbientSynth, type SynthPatch } from './AmbientSynth'

export interface AudioGraph {
  context: AudioContext
  analyser: AnalyserNode
  bus: GainNode
  limiter: DynamicsCompressorNode
  master: GainNode
  synth: AmbientSynth
  synthGain: GainNode
  recorder: MediaStreamAudioDestinationNode | null
}

/** Builds the shared signal chain: sources -> bus -> analyser, and bus -> limiter -> master -> speakers. */
export function createAudioGraph(fftSize: number, patch: SynthPatch, volume: number): AudioGraph {
  const context = new AudioContext({ latencyHint: 'playback' })
  const analyser = context.createAnalyser()
  analyser.fftSize = fftSize
  analyser.smoothingTimeConstant = 0.6

  const bus = context.createGain()
  const limiter = context.createDynamicsCompressor()
  limiter.threshold.value = -9
  limiter.knee.value = 12
  limiter.ratio.value = 8
  limiter.attack.value = 0.004
  limiter.release.value = 0.25
  const master = context.createGain()
  master.gain.value = volume
  bus.connect(analyser)
  bus.connect(limiter).connect(master).connect(context.destination)

  const synthGain = context.createGain()
  synthGain.gain.value = 0
  const synth = new AmbientSynth(context, patch)
  synth.output.connect(synthGain).connect(bus)

  return { context, analyser, bus, limiter, master, synth, synthGain, recorder: null }
}

/** A stream of the master output, created on first use, for recording video with sound. */
export function recordingStream(graph: AudioGraph): MediaStream {
  if (!graph.recorder) {
    graph.recorder = graph.context.createMediaStreamDestination()
    graph.master.connect(graph.recorder)
  }
  return graph.recorder.stream
}

export function disposeAudioGraph(graph: AudioGraph): void {
  const { context, analyser, bus, limiter, master, synth, synthGain, recorder } = graph
  synth.dispose()
  for (const node of [synthGain, bus, analyser, limiter, master, recorder]) node?.disconnect()
  void context.close()
}
