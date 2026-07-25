import { useNavigate } from 'react-router-dom'
import { UploadZone } from '../components/UploadZone'
import { useUpload } from '../UploadContext'

export default function Upload() {
  const nav = useNavigate()
  const { setUpload } = useUpload()
  return (
    <main className="grain mx-auto max-w-2xl px-6 py-20 text-center">
      <p className="font-sans text-xs uppercase tracking-[0.28em] text-amber/90">The darkroom, reopened</p>
      <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
        Bring old photos<br />back to life
      </h1>
      <p className="mx-auto mt-5 max-w-md font-sans text-lg text-muted">
        Upload a faded, blurry, or damaged photo — we’ll restore it.
      </p>
      <div className="mt-12">
        <UploadZone onFile={f => { setUpload({ file: f, previewUrl: URL.createObjectURL(f) }); nav('/options') }} />
      </div>
    </main>
  )
}
