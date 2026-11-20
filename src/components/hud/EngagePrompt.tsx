import { useStudioStore } from '../../store/useStudioStore'

export function EngagePrompt() {
  const engaged = useStudioStore((state) => state.engaged)
  const engage = useStudioStore((state) => state.engage)

  if (engaged) return null

  return (
    <div className="absolute inset-x-0 bottom-28 flex flex-col items-center gap-4 px-6 text-center">
      <button
        type="button"
        onClick={() => void engage()}
        className="glass-edge label-caps pointer-events-auto h-12 cursor-pointer rounded-full bg-[#0b0d14]/40 px-8 text-[0.7rem] text-white backdrop-blur-xl transition-all duration-500 ease-optic hover:bg-white/12 hover:tracking-[0.3em]"
      >
        [ Engage engine ]
      </button>
      <p className="text-xs font-light text-white/45 [text-shadow:0_1px_14px_rgb(0_0_0/0.7)]">
        Starts the procedural synth. Or drop an audio file anywhere.
      </p>
    </div>
  )
}
