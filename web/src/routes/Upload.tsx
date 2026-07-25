import { useNavigate } from 'react-router-dom'
import { UploadZone } from '../components/UploadZone'
import { useUpload } from '../UploadContext'
import { useReveal } from '../lib/motion'

const CAPABILITIES = ['Face-aware restoration', 'Up to 4× resolution', 'Ready in under a minute']

export default function Upload() {
  const nav = useNavigate()
  const { setUpload } = useUpload()
  const scope = useReveal<HTMLElement>()

  return (
    <main ref={scope} className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-center sm:pt-24">
      <p data-reveal className="eyebrow">AI photo restoration</p>
      <h1 data-reveal className="mt-5 font-serif text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl">
        Bring old photos<br /><span className="spectral-text">back to life</span>
      </h1>
      <p data-reveal className="mx-auto mt-6 max-w-md font-sans text-lg text-muted">
        Upload a faded, blurry, or damaged photo. Our AI recovers the detail that's still latent in it — sharper, clearer, restored.
      </p>

      <div data-reveal className="mt-12">
        <UploadZone onFile={f => { setUpload({ file: f, previewUrl: URL.createObjectURL(f) }); nav('/options') }} />
      </div>

      <ul data-reveal className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {CAPABILITIES.map(c => (
          <li key={c} className="eyebrow flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-amber" aria-hidden="true" />
            {c}
          </li>
        ))}
      </ul>
    </main>
  )
}
