import { useNavigate } from 'react-router-dom'
import { UploadZone } from '../components/UploadZone'
import { useUpload } from '../UploadContext'

export default function Upload() {
  const nav = useNavigate()
  const { setUpload } = useUpload()
  return (
    <main className="grain mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="font-serif text-5xl leading-tight">Bring old photos back to life</h1>
      <p className="mt-4 text-neutral-400">Upload a faded, blurry, or damaged photo — we’ll restore it.</p>
      <div className="mt-10">
        <UploadZone onFile={f => { setUpload({ file: f, previewUrl: URL.createObjectURL(f) }); nav('/options') }} />
      </div>
    </main>
  )
}
