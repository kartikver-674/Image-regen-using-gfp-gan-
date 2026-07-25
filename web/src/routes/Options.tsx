import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useUpload } from '../UploadContext'
import { buildOptions, createJob, type UiOptions } from '../api'

const MODELS = [
  { id: 'gfpgan', label: 'GFPGAN', hint: 'natural' },
  { id: 'codeformer', label: 'CodeFormer', hint: 'robust' },
] as const

export default function Options() {
  const { upload } = useUpload()
  const nav = useNavigate()
  const [ui, setUi] = useState<UiOptions>({ mode: 'auto', model: 'gfpgan', fidelity: 0.7, upscale: 2, colorize: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!upload) return <Navigate to="/" replace />

  const onRestore = async () => {
    setBusy(true); setErr('')
    try {
      const jobId = await createJob(upload.file, buildOptions(ui))
      nav(`/processing/${jobId}`, { state: { name: upload.file.name, mode: ui.mode, ui } })
    } catch (e) { setErr(String(e)); setBusy(false) }
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-2">
      <div className="overflow-hidden rounded-card border border-neutral-700">
        <img src={upload.previewUrl} alt="Selected photo" className="h-full w-full object-cover" />
      </div>

      <div className="rounded-card border border-neutral-700 p-6">
        <div className="flex rounded-full border border-neutral-600 p-1 text-sm">
          <button type="button" aria-pressed={ui.mode === 'auto'}
            onClick={() => setUi(u => ({ ...u, mode: 'auto' }))}
            className={`flex-1 rounded-full py-2 transition ${ui.mode === 'auto' ? 'bg-amber text-black' : ''}`}>
            Auto (recommended)
          </button>
          <button type="button" aria-pressed={ui.mode === 'manual'}
            onClick={() => setUi(u => ({ ...u, mode: 'manual' }))}
            className={`flex-1 rounded-full py-2 transition ${ui.mode === 'manual' ? 'bg-amber text-black' : ''}`}>
            Manual
          </button>
        </div>

        {ui.mode === 'manual' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {MODELS.map(m => (
                <button key={m.id} type="button" aria-pressed={ui.model === m.id}
                  onClick={() => setUi(u => ({ ...u, model: m.id }))}
                  className={`rounded-card border p-4 text-left transition ${ui.model === m.id ? 'border-amber' : 'border-neutral-600'}`}>
                  <div className="font-serif text-lg">{m.label}</div>
                  <div className="text-sm text-neutral-400">{m.hint}</div>
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-sm text-neutral-400">
                <span>Natural ←</span>
                <span>→ Faithful</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={ui.fidelity} aria-label="Fidelity"
                disabled={ui.model !== 'codeformer'}
                onChange={e => setUi(u => ({ ...u, fidelity: Number(e.target.value) }))}
                className="mt-2 w-full accent-amber disabled:opacity-40" />
            </div>

            <div className="flex w-fit rounded-full border border-neutral-600 p-1 text-sm">
              {([2, 4] as const).map(x => (
                <button key={x} type="button" aria-pressed={ui.upscale === x}
                  onClick={() => setUi(u => ({ ...u, upscale: x }))}
                  className={`rounded-full px-5 py-2 transition ${ui.upscale === x ? 'bg-amber text-black' : ''}`}>
                  {x}×
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between rounded-card border border-neutral-700 p-4 opacity-60">
          <div>
            <div>Colorize</div>
            <div className="text-sm text-neutral-400">Colorization coming soon (F2)</div>
          </div>
          <input type="checkbox" checked={false} disabled readOnly aria-label="Colorize (disabled)" />
        </div>

        {err && <p className="mt-4 text-sm text-coral">{err}</p>}

        <button type="button" onClick={onRestore} disabled={busy}
          className="mt-6 w-full rounded-full bg-amber py-3 font-medium text-black transition disabled:opacity-60">
          {busy ? 'Restoring…' : 'Restore photo'}
        </button>

        <button type="button" onClick={() => nav('/')}
          className="mt-3 w-full text-center text-sm text-neutral-400 underline">
          Choose a different photo
        </button>
      </div>
    </main>
  )
}
