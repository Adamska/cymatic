import { useRef, useState, type FormEvent } from 'react'
import { PROMPT_CHIPS } from '../../ai/presets'
import { useStudioStore } from '../../store/useStudioStore'
import { useUiStore } from '../../store/useUiStore'
import { GlassPanel } from './GlassPanel'

export function CommandBar() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState('')
  const [focused, setFocused] = useState(false)
  const directing = useStudioStore((state) => state.directing)
  const direct = useStudioStore((state) => state.direct)
  const showcase = useUiStore((state) => state.showcase && state.panel === null)
  const chipsVisible = focused || showcase

  const submit = (text: string) => {
    setPrompt(text)
    void direct(text)
    inputRef.current?.blur()
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit(prompt)
  }

  return (
    <form onSubmit={onSubmit} className="pointer-events-none flex w-full max-w-xl flex-col items-center gap-3">
      <div
        className={`flex flex-wrap justify-center gap-1.5 transition-all duration-500 ease-optic ${
          chipsVisible ? 'pointer-events-auto translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
        aria-hidden={!chipsVisible}
      >
        {PROMPT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            tabIndex={chipsVisible ? 0 : -1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => submit(chip)}
            className="glass-edge cursor-pointer rounded-full bg-[#0b0d14]/45 px-3 py-1.5 text-[0.7rem] font-light text-white/65 backdrop-blur-xl transition-colors duration-300 hover:text-white"
          >
            {chip}
          </button>
        ))}
      </div>
      <GlassPanel
        className={`flex h-12 w-full items-center gap-3 rounded-full pr-1.5 pl-5 transition-shadow duration-500 ${
          focused ? 'shadow-[0_0_0_1px_rgb(255_255_255/0.14),0_18px_60px_-18px_var(--color-accent)]' : ''
        }`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent transition-colors duration-1000 ${directing ? 'animate-ping' : ''}`}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur()
          }}
          maxLength={240}
          placeholder="Direct the scene: describe a light and a sound"
          aria-label="Scene director prompt"
          autoComplete="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-sm font-light text-white/90 outline-none placeholder:text-white/35"
        />
        <button
          type="submit"
          disabled={directing || prompt.trim().length === 0}
          className="label-caps h-9 cursor-pointer rounded-full bg-white/10 px-4 text-white/85 transition-colors duration-300 hover:bg-white/18 disabled:cursor-default disabled:text-white/30 disabled:hover:bg-white/10"
        >
          {directing ? 'Directing' : 'Direct'}
        </button>
      </GlassPanel>
    </form>
  )
}
