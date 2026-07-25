import { useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { resolveUrl } from '../api'
import { useHistory } from '../hooks/useHistory'
import { BeforeAfter } from '../components/BeforeAfter'
import { Chips, whatWeDid } from '../components/Chips'
import { reducedMotion, useReveal } from '../lib/motion'

export default function Result() {
  const { jobId } = useParams()
  const { entries } = useHistory()
  const nav = useNavigate()
  const [dlErr, setDlErr] = useState('')
  const scope = useReveal<HTMLElement>([jobId])
  const hero = useRef<HTMLDivElement>(null)

  const entry = entries.find(e => e.jobId === jobId)

  // The payoff: the restored print resolves out of a soft blur as it lands.
  useLayoutEffect(() => {
    if (!hero.current || !entry) return
    if (reducedMotion()) { gsap.set(hero.current, { opacity: 1 }); return }
    const ctx = gsap.context(() => {
      gsap.fromTo(hero.current,
        { opacity: 0, scale: 0.97, filter: 'blur(12px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.95, ease: 'power3.out', delay: 0.08, clearProps: 'filter,transform' })
    }, hero)
    return () => ctx.revert()
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return <Navigate to="/gallery" replace />

  const before = resolveUrl(entry.beforeUrl)
  const after = resolveUrl(entry.afterUrl)

  // Money path: cross-origin <a download> is unreliable, so fetch the image as a
  // blob and download the object URL instead.
  const download = async () => {
    setDlErr('')
    try {
      const r = await fetch(after)
      if (!r.ok) throw new Error(String(r.status))
      const a = document.createElement('a')
      a.href = URL.createObjectURL(await r.blob())
      a.download = `restored-${entry.name.replace(/\.[^.]+$/, '')}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch {
      setDlErr('Download failed — please try again.')
    }
  }

  return (
    <main ref={scope} className="mx-auto max-w-5xl px-6 py-10">
      {/* Instrument readout: filename left, restoration telemetry right */}
      <div data-reveal className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-sans text-sm text-muted">{entry.name}</span>
        <span className="eyebrow shrink-0">
          <span className="text-amber">Restored</span> · {Math.round(entry.elapsedS)}s · {entry.device.toUpperCase()}
        </span>
      </div>

      {/* Hero — drag the divider to compare */}
      <div className="relative mt-4">
        <div className="result-glow" />
        <div ref={hero}>
          <BeforeAfter before={before} after={after} />
        </div>
      </div>

      <div data-reveal className="mt-6">
        <Chips items={whatWeDid(entry)} />
      </div>

      {/* Studio caption — the restorer's note on why the AI routed this way */}
      <p data-reveal className="mt-4 max-w-2xl font-serif text-lg italic text-muted">{entry.routing.rationale}</p>

      <div data-reveal className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={download} className="btn-primary">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth={1.8} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
          </svg>
          Download
        </button>
        <button type="button" onClick={() => nav('/')} className="btn-secondary">Restore another</button>
        <button type="button" onClick={() => nav('/gallery')} className="btn-tertiary">View in gallery</button>
      </div>

      {dlErr && <p className="mt-3 text-sm text-coral">{dlErr}</p>}
    </main>
  )
}
