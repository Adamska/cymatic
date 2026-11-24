export type MidiDial = 'intensity' | 'bloom' | 'turbulence' | 'displacement' | 'flow' | 'iridescence' | 'aberration'

export interface MidiHandlers {
  onControl: (dial: MidiDial, value: number) => void
  onNote: (note: number, velocity: number) => void
  onProgram: () => void
  onDevices: (names: readonly string[]) => void
}

const DIAL_ORDER: readonly MidiDial[] = ['intensity', 'bloom', 'turbulence', 'displacement', 'flow', 'iridescence', 'aberration']
const CONTROL_CHANGE = 0xb0
const NOTE_ON = 0x90
const PROGRAM_CHANGE = 0xc0

/**
 * Connects every MIDI input. Knobs are learned on first touch: the first controller
 * moved drives intensity, the next one bloom, and so on down the light rig.
 * Notes strike the sculpture, program changes step to the next cue.
 */
export async function connectMidi(handlers: MidiHandlers): Promise<() => void> {
  const access = await navigator.requestMIDIAccess()
  const learned = new Map<number, MidiDial>()

  const onMessage = (event: MIDIMessageEvent) => {
    const data = event.data
    if (!data || data.length < 2) return
    const status = (data[0] ?? 0) & 0xf0
    const first = data[1] ?? 0
    const second = data[2] ?? 0

    if (status === CONTROL_CHANGE) {
      let dial = learned.get(first)
      if (!dial && learned.size < DIAL_ORDER.length) {
        dial = DIAL_ORDER[learned.size]
        if (dial) learned.set(first, dial)
      }
      if (dial) handlers.onControl(dial, second / 127)
    } else if (status === NOTE_ON && second > 0) {
      handlers.onNote(first, second / 127)
    } else if (status === PROGRAM_CHANGE) {
      handlers.onProgram()
    }
  }

  const bind = () => {
    const names: string[] = []
    access.inputs.forEach((input) => {
      input.onmidimessage = onMessage
      names.push(input.name ?? 'MIDI input')
    })
    handlers.onDevices(names)
  }

  bind()
  access.onstatechange = bind

  return () => {
    access.onstatechange = null
    access.inputs.forEach((input) => {
      input.onmidimessage = null
    })
  }
}
