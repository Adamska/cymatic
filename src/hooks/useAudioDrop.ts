import { useEffect, useState } from 'react'
import { useStudioStore } from '../store/useStudioStore'

const carriesFiles = (event: DragEvent): boolean => event.dataTransfer?.types.includes('Files') ?? false

export function useAudioDrop(): boolean {
  const loadFile = useStudioStore((state) => state.loadFile)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let depth = 0

    const onEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth += 1
      setDragging(true)
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onOver = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file) void loadFile(file)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [loadFile])

  return dragging
}
