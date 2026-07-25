import { useRef, useState } from 'react'

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
        className={`focus-ring group w-full rounded-card border-2 border-dashed p-16 text-center transition
          ${over ? 'border-amber bg-amber/[0.07]' : 'border-neutral-600 hover:border-neutral-500 hover:bg-white/[0.02]'}`}
      >
        <svg
          viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          className={`mx-auto h-11 w-11 transition ${over ? 'text-amber' : 'text-amber/80 group-hover:text-amber'}`}
        >
          <path stroke="currentColor" d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" />
          <path stroke="currentColor" d="M4 14v3.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V14" />
        </svg>
        <p className="mt-4 font-sans">Drag a photo here, or <span className="text-amber underline underline-offset-4">click to browse</span></p>
        <p className="mt-1.5 text-sm text-muted">JPG, PNG · up to 25 MB</p>
      </button>
      <input ref={input} type="file" accept="image/*" hidden
             onChange={e => pick(e.target.files?.[0])} />
      {err && <p role="alert" className="mt-3 text-coral text-sm">{err}</p>}
    </div>
  )
}
