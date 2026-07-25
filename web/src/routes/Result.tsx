import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { resolveUrl } from '../api'
import { useHistory } from '../hooks/useHistory'
import { BeforeAfter } from '../components/BeforeAfter'
import { Chips, whatWeDid } from '../components/Chips'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'

export default function Result() {
  const { jobId } = useParams()
  const { entries } = useHistory()
  const nav = useNavigate()
  const [dlErr, setDlErr] = useState('')

  const entry = entries.find(e => e.jobId === jobId)
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Quiet bar: filename left, honest real-data tag right */}
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-sans text-sm text-neutral-400">{entry.name}</span>
        <span className="shrink-0 font-sans text-[11px] uppercase tracking-[0.16em] text-neutral-500">
          Restored in {Math.round(entry.elapsedS)}s · {entry.device.toUpperCase()}
        </span>
      </div>

      {/* Hero — the fine print under darkroom light */}
      <div className="result-reveal relative mt-4">
        <div className="result-glow" />
        <BeforeAfter before={before} after={after} />
      </div>

      {/* What we did */}
      <div className="mt-6">
        <Chips items={whatWeDid(entry)} />
      </div>

      {/* Studio caption — the routing rationale */}
      <p className="mt-4 max-w-2xl font-serif text-lg italic text-neutral-400">{entry.routing.rationale}</p>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={download}
          className={`rounded-full bg-amber px-7 py-3 font-medium text-black transition hover:brightness-105 ${focusRing}`}
        >
          Download
        </button>
        <button
          type="button"
          onClick={() => nav('/')}
          className={`rounded-full border border-neutral-600 px-7 py-3 transition hover:border-neutral-400 ${focusRing}`}
        >
          Restore again
        </button>
        <button
          type="button"
          onClick={() => nav('/gallery')}
          className={`rounded px-2 py-1 text-sm text-neutral-400 underline underline-offset-4 transition hover:text-neutral-200 ${focusRing}`}
        >
          View in gallery
        </button>
      </div>

      {dlErr && <p className="mt-3 text-sm text-coral">{dlErr}</p>}
    </main>
  )
}
