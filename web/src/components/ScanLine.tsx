import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { reducedMotion } from '../lib/motion'

/**
 * A spectral line sweeping down the frame — the AI reading the image.
 * `active` = processing (bright, brisk); otherwise idle (faint, unhurried).
 * ponytail: animates `top` in % so it self-sizes to any frame; it's one 2px
 * element, so the paint cost is negligible — not worth a ResizeObserver.
 */
export function ScanLine({ active = false }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotion()) {
      gsap.set(el, { top: '42%', opacity: active ? 0.6 : 0.35 })
      return
    }
    const dur = active ? 2.4 : 6
    const peak = active ? 0.95 : 0.5
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: active ? 0.2 : 1.2 })
      tl.fromTo(el, { top: '-4%' }, { top: '104%', duration: dur, ease: 'sine.inOut' })
        .fromTo(el, { opacity: 0 }, { opacity: peak, duration: dur * 0.22, ease: 'sine.out' }, 0)
        .to(el, { opacity: 0, duration: dur * 0.24, ease: 'sine.in' }, dur * 0.76)
    }, el)
    return () => ctx.revert()
  }, [active])
  return <div ref={ref} className="scanline" aria-hidden="true" />
}
