import type { ComponentProps } from 'react'

export function GlassPanel({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={`glass-edge pointer-events-auto bg-[#0b0d14]/35 backdrop-blur-xl backdrop-saturate-150 ${className}`}
      {...props}
    />
  )
}
