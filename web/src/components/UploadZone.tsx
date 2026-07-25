import { useRef, useState } from 'react'
import { ScanLine } from './ScanLine'

const MAX = 26214400
export function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const pick = (f?: File | null) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr('Please choose an image file.')
    if (f.size > MAX) return setErr('That image is over the 25 MB limit.')
    setErr(''); onFile(f)
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]) }}
        className="focus-ring group relative block w-full overflow-hidden rounded-frame px-8 py-16 text-center transition duration-300 ease-resolve"
        style={{
          border: `1px solid ${over ? 'var(--amber)' : 'var(--hairline-strong)'}`,
          background: over
            ? 'radial-gradient(60% 80% at 50% 30%, rgba(232,163,61,0.12), transparent 70%), var(--surface)'
            : 'linear-gradient(180deg, var(--sheen), transparent 60%), var(--surface)',
          boxShadow: over
            ? '0 0 0 1px rgba(232,163,61,0.4), 0 30px 70px -30px rgba(232,163,61,0.35)'
            : '0 30px 70px -40px rgba(0,0,0,0.8)',
        }}
      >
        <span className="frame-corner tl transition-opacity group-hover:opacity-100" style={{ opacity: over ? 1 : 0.6 }} aria-hidden="true" />
        <span className="frame-corner tr transition-opacity group-hover:opacity-100" style={{ opacity: over ? 1 : 0.6 }} aria-hidden="true" />
        <span className="frame-corner bl transition-opacity group-hover:opacity-100" style={{ opacity: over ? 1 : 0.6 }} aria-hidden="true" />
        <span className="frame-corner br transition-opacity group-hover:opacity-100" style={{ opacity: over ? 1 : 0.6 }} aria-hidden="true" />
        <ScanLine active={over} />

        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl transition duration-300"
          style={{ border: '1px solid var(--hairline-strong)', background: 'var(--sheen)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className={`h-7 w-7 transition-colors duration-300 ${over ? 'text-amber' : 'text-amber/80 group-hover:text-amber'}`}>
            <path stroke="currentColor" d="M12 16V5m0 0L8 9m4-4 4 4" />
            <path stroke="currentColor" d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
        </span>

        <p className="mt-5 font-sans text-base">
          Drop a photo to restore, or <span className="text-amber underline decoration-amber/40 underline-offset-4">browse</span>
        </p>
        <p className="eyebrow mt-2.5">JPG · PNG · up to 25 MB</p>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
      {err && <p role="alert" className="mt-3 text-sm text-coral">{err}</p>}
    </div>
  )
}
