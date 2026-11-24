import { useState } from 'react'
import { SAMPLE_TRACKS } from '../../audio/sampleTracks'
import { useStudioStore } from '../../store/useStudioStore'

/**
 * First contact. The main button plays a mastered sample track, which shows the full range
 * of motion at once; the procedural synth stays one click away for a calmer start.
 */
export function EngagePrompt() {
  const engaged = useStudioStore((state) => state.engaged)
  const { engage, loadTrack } = useStudioStore.getState()
  const [starting, setStarting] = useState(false)

  if (engaged) return null

  const playSample = async () => {
    const track = SAMPLE_TRACKS[0]
    if (!track) return void engage()
    setStarting(true)
    await loadTrack(track)
    setStarting(false)
  }

  return (
    <div className="absolute inset-x-0 bottom-28 flex flex-col items-center gap-4 px-6 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => void playSample()}
          disabled={starting}
          className="glass-edge label-caps pointer-events-auto h-12 cursor-pointer rounded-full bg-white/12 px-8 text-[0.7rem] text-white backdrop-blur-xl transition-all duration-500 ease-optic hover:bg-white/20 hover:tracking-[0.3em] disabled:cursor-wait"
        >
          {starting ? '[ Loading ]' : '[ Play a track ]'}
        </button>
        <button
          type="button"
          onClick={() => void engage()}
          className="glass-edge label-caps pointer-events-auto h-12 cursor-pointer rounded-full bg-[#0b0d14]/40 px-6 text-[0.7rem] text-white/70 backdrop-blur-xl transition-colors duration-500 hover:text-white"
        >
          Start the synth
        </button>
      </div>
      <p className="text-xs font-light text-white/45 [text-shadow:0_1px_14px_rgb(0_0_0/0.7)]">
        Or drop an audio file anywhere, then click the sculpture to strike it.
      </p>
    </div>
  )
}
