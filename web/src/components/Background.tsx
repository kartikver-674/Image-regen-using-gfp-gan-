import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { reducedMotion } from '../lib/motion'

/** Ambient depth field: one warm key light drifting over a cool room. */
export function Background() {
  const key = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (reducedMotion() || !key.current) return
    const ctx = gsap.context(() => {
      gsap.to(key.current, {
        xPercent: 5, yPercent: 4, duration: 24, ease: 'sine.inOut', yoyo: true, repeat: -1,
      })
    })
    return () => ctx.revert()
  }, [])
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div ref={key} className="bg-keylight" />
      <div className="bg-spectral" />
      <div className="bg-grain" />
    </div>
  )
}
