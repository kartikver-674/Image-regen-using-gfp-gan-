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
    <main className="mx-auto grid max-w-5xl items-start gap-10 px-6 py-12 md:grid-cols-2">
      {/* The print under the loupe — framed like the result + gallery prints */}
      <div className="overflow-hidden rounded-card border border-amber/20 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.7)]">
        <img src={upload.previewUrl} alt="Selected photo" className="h-full w-full object-cover" />
      </div>

      <div className="card p-6">
        <h1 className="font-serif text-2xl tracking-tight">Restore options</h1>
        <p className="mt-1 text-sm text-muted">We pick sensible defaults — adjust them if you like.</p>

        <div className="mt-6 flex rounded-full border border-neutral-600 p-1 text-sm">
          <button type="button" aria-pressed={ui.mode === 'auto'}
            onClick={() => setUi(u => ({ ...u, mode: 'auto' }))}
            className={`focus-ring flex-1 rounded-full py-2 font-medium transition ${ui.mode === 'auto' ? 'bg-amber text-black' : 'text-muted'}`}>
            Auto (recommended)
          </button>
          <button type="button" aria-pressed={ui.mode === 'manual'}
            onClick={() => setUi(u => ({ ...u, mode: 'manual' }))}
            className={`focus-ring flex-1 rounded-full py-2 font-medium transition ${ui.mode === 'manual' ? 'bg-amber text-black' : 'text-muted'}`}>
            Manual
          </button>
        </div>

        {ui.mode === 'manual' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {MODELS.map(m => (
                <button key={m.id} type="button" aria-pressed={ui.model === m.id}
                  onClick={() => setUi(u => ({ ...u, model: m.id }))}
                  className={`focus-ring card relative p-4 text-left transition ${ui.model === m.id ? '!border-amber ring-1 ring-amber' : 'hover:!border-neutral-500'}`}>
                  {ui.model === m.id && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-amber" aria-hidden="true" />}
                  <div className="font-serif text-lg">{m.label}</div>
                  <div className="text-sm text-muted">{m.hint}</div>
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-sm text-muted">
                <span>Natural ←</span>
                <span>→ Faithful</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={ui.fidelity} aria-label="Fidelity"
                disabled={ui.model !== 'codeformer'}
                onChange={e => setUi(u => ({ ...u, fidelity: Number(e.target.value) }))}
                className="focus-ring mt-2 w-full rounded-full accent-amber disabled:opacity-40" />
              {ui.model !== 'codeformer' && (
                <p className="mt-1.5 text-xs text-muted">Fidelity is available with CodeFormer.</p>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm text-muted">Upscale</div>
              <div className="flex w-fit rounded-full border border-neutral-600 p-1 text-sm">
                {([2, 4] as const).map(x => (
                  <button key={x} type="button" aria-pressed={ui.upscale === x}
                    onClick={() => setUi(u => ({ ...u, upscale: x }))}
                    className={`focus-ring rounded-full px-5 py-2 font-medium transition ${ui.upscale === x ? 'bg-amber text-black' : 'text-muted'}`}>
                    {x}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between rounded-card border border-neutral-700 p-4 opacity-60">
          <div>
            <div className="font-medium">Colorize</div>
            <div className="text-sm text-muted">Colorization coming soon (F2)</div>
          </div>
          <input type="checkbox" checked={false} disabled readOnly aria-label="Colorize (disabled)" />
        </div>

        {err && <p className="mt-4 text-sm text-coral">{err}</p>}

        <button type="button" onClick={onRestore} disabled={busy}
          className="btn-primary mt-6 w-full">
          {busy ? 'Restoring…' : 'Restore photo'}
        </button>

        <button type="button" onClick={() => nav('/')}
          className="btn-tertiary mt-3 w-full">
          Choose a different photo
        </button>
      </div>
    </main>
  )
}
