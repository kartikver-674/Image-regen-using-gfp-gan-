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
        className={`w-full rounded-card border-2 border-dashed p-16 text-center transition
          ${over ? 'border-amber bg-amber/5' : 'border-neutral-600'}`}
      >
        <div className="text-amber text-4xl">⬆</div>
        <p className="mt-3">Drag a photo here, or click to browse</p>
        <p className="mt-1 text-sm text-neutral-400">JPG, PNG · up to 25 MB</p>
      </button>
      <input ref={input} type="file" accept="image/*" hidden
             onChange={e => pick(e.target.files?.[0])} />
      {err && <p className="mt-3 text-coral text-sm">{err}</p>}
    </div>
  )
}
