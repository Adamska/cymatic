const RING_SECONDS = 3.4
const PARTIALS: readonly { ratio: number; level: number; decay: number }[] = [
  { ratio: 1, level: 1, decay: RING_SECONDS },
  { ratio: 2.76, level: 0.45, decay: 1.6 },
  { ratio: 5.4, level: 0.22, decay: 0.7 },
]

/**
 * Strikes a short FM glass bell into `output`. The voice frees itself once it has rung out.
 * Routed through the analysis bus, so the sculpture also reacts to its own strike.
 */
export function strikeBell(context: AudioContext, output: AudioNode, frequency: number, velocity: number): void {
  const now = context.currentTime
  const level = 0.32 * Math.min(1, Math.max(0.1, velocity))
  const voice = context.createGain()
  voice.gain.value = level
  voice.connect(output)

  const modulator = context.createOscillator()
  modulator.frequency.value = frequency * 3.5
  const depth = context.createGain()
  depth.gain.setValueAtTime(frequency * 2.4 * velocity, now)
  depth.gain.exponentialRampToValueAtTime(1, now + 1.1)
  modulator.connect(depth)
  modulator.start(now)
  modulator.stop(now + RING_SECONDS)

  for (const { ratio, level: partialLevel, decay } of PARTIALS) {
    const carrier = context.createOscillator()
    carrier.frequency.value = frequency * ratio
    depth.connect(carrier.frequency)
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(partialLevel, now + 0.004)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay)
    carrier.connect(envelope).connect(voice)
    carrier.start(now)
    carrier.stop(now + decay + 0.05)
    carrier.onended = () => {
      carrier.disconnect()
      envelope.disconnect()
    }
  }

  modulator.onended = () => {
    modulator.disconnect()
    depth.disconnect()
    voice.disconnect()
  }
}
