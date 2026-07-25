import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'

/** True when the user has asked the OS to minimise motion. */
export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Staggered "resolve-in" reveal. Attach the returned ref to a container; every
 * descendant marked `data-reveal` fades/rises in on mount. Under reduced motion
 * they appear instantly. Runs in useLayoutEffect so there's no flash before the
 * from-state is applied.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(deps: unknown[] = []) {
  const scope = useRef<T>(null)
  useLayoutEffect(() => {
    const el = scope.current
    if (!el) return
    const targets = el.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!targets.length) return
    if (reducedMotion()) {
      gsap.set(targets, { opacity: 1, y: 0 })
      return
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07, clearProps: 'transform' },
      )
    }, el)
    // Safety net: if the rAF ticker ever stalls (backgrounded tab, slow paint),
    // never leave content stuck invisible — force the end state after a beat.
    const safety = setTimeout(() => gsap.set(targets, { opacity: 1, y: 0 }), 1600)
    return () => { clearTimeout(safety); ctx.revert() }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return scope
}
