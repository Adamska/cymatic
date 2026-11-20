import { useEffect, useRef } from 'react'
import { audioEngine } from '../../audio/AudioEngine'
import { useStudioStore } from '../../store/useStudioStore'
import { GlassPanel } from './GlassPanel'

const POINT_COUNT = 56
const MIN_HZ = 32
const MAX_HZ = 14000
const EASING = 0.3
const PADDING = 3

const SOURCE_LABELS = { synth: 'Procedural synth', microphone: 'Live microphone', file: 'Audio file' } as const

export function SpectrumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colorsRef = useRef<readonly string[]>([])
  const engaged = useStudioStore((state) => state.engaged)
  const source = useStudioStore((state) => state.source)
  const trackName = useStudioStore((state) => state.trackName)
  const lights = useStudioStore((state) => state.directive.lights)

  useEffect(() => {
    colorsRef.current = [lights.key, lights.fill, lights.rim]
  }, [lights.key, lights.fill, lights.rim])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const levels = new Float32Array(POINT_COUNT)
    let width = 0
    let height = 0
    let frame = 0
    let paintedColors: readonly string[] | null = null
    let stroke: CanvasGradient | null = null
    let fade: CanvasGradient | null = null

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      paintedColors = null
    }

    const refreshGradients = () => {
      const colors = colorsRef.current
      const gradient = context.createLinearGradient(0, 0, width, 0)
      colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color))
      paintedColors = colors
      stroke = gradient
      fade = context.createLinearGradient(0, 0, 0, height)
      fade.addColorStop(0, 'rgb(0 0 0 / 0.5)')
      fade.addColorStop(1, 'rgb(0 0 0 / 0)')
    }

    const trace = () => {
      const step = width / (POINT_COUNT - 1)
      const y = (index: number) => height - PADDING - (levels[index] ?? 0) * (height - PADDING * 2)
      context.beginPath()
      context.moveTo(0, y(0))
      for (let index = 1; index < POINT_COUNT - 1; index++) {
        context.quadraticCurveTo(index * step, y(index), (index + 0.5) * step, (y(index) + y(index + 1)) / 2)
      }
      context.lineTo(width, y(POINT_COUNT - 1))
    }

    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (paintedColors !== colorsRef.current) refreshGradients()
      if (!stroke || !fade) return

      const { spectrum, sampleRate } = audioEngine
      const binHz = sampleRate / (spectrum.length * 2)
      for (let index = 0; index < POINT_COUNT; index++) {
        const from = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, index / POINT_COUNT)
        const to = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, (index + 1) / POINT_COUNT)
        const first = Math.floor(from / binHz)
        const last = Math.max(first, Math.min(spectrum.length - 1, Math.floor(to / binHz)))
        let sum = 0
        for (let bin = first; bin <= last; bin++) sum += spectrum[bin] ?? 0
        const level = Math.pow(sum / (last - first + 1) / 255, 1.4)
        levels[index] = (levels[index] ?? 0) + (level - (levels[index] ?? 0)) * EASING
      }

      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'source-over'
      trace()
      context.lineTo(width, height)
      context.lineTo(0, height)
      context.closePath()
      context.fillStyle = stroke
      context.fill()
      context.globalCompositeOperation = 'destination-in'
      context.fillStyle = fade
      context.fillRect(0, 0, width, height)

      context.globalCompositeOperation = 'source-over'
      trace()
      context.strokeStyle = stroke
      context.lineWidth = 1.25
      context.lineJoin = 'round'
      context.stroke()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <GlassPanel className="hidden w-60 rounded-2xl px-3.5 pt-3 pb-2.5 sm:block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caps text-white/85">Spectrum</span>
        <span className="label-caps truncate text-white/40">
          {engaged ? (trackName ?? SOURCE_LABELS[source]) : 'Standby'}
        </span>
      </div>
      <canvas ref={canvasRef} className="mt-2 block h-12 w-full" aria-label="Live frequency spectrum" role="img" />
    </GlassPanel>
  )
}
