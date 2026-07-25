import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useUpload } from '../UploadContext'
import { buildOptions, createJob, type UiOptions } from '../api'
import { ScannerFrame } from '../components/ScannerFrame'
import { useReveal } from '../lib/motion'

const MODELS = [
  { id: 'gfpgan', label: 'GFPGAN', hint: 'Natural, lifelike faces' },
  { id: 'codeformer', label: 'CodeFormer', hint: 'Robust on heavy damage' },
] as const

function summary(ui: UiOptions): string {
  if (ui.mode === 'auto') return 'Auto · smart routing'
  const bits = ['Manual', ui.model === 'codeformer' ? 'CodeFormer' : 'GFPGAN', `${ui.upscale}×`]
  if (ui.model === 'codeformer') bits.push(`fidelity ${ui.fidelity.toFixed(2)}`)
  return bits.join(' · ')
}

export default function Options() {
  const { upload } = useUpload()
  const nav = useNavigate()
  const scope = useReveal<HTMLElement>()
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
    <main ref={scope} className="mx-auto grid max-w-6xl items-start gap-8 px-6 py-12 md:grid-cols-[1.1fr_1fr] md:gap-10">
      {/* The source print under the loupe — an idle scan reads it. */}
      <div data-reveal className="md:sticky md:top-24">
        <ScannerFrame scan="idle">
          <img src={upload.previewUrl} alt="Selected photo" className="block max-h-[70vh] w-full object-contain" />
        </ScannerFrame>
        <p className="eyebrow mt-3 text-center md:text-left">Source · ready to restore</p>
      </div>

      <div data-reveal className="card p-6 sm:p-7">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Restore options</h1>
        <p className="mt-1.5 text-sm text-muted">We pick sensible defaults. Adjust them if you like.</p>

        {/* Auto / Manual — sliding indicator */}
        <div className="relative mt-6 grid grid-cols-2 rounded-full text-sm" style={{ border: '1px solid var(--hairline-strong)' }}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-full bg-amber transition-transform duration-300 ease-resolve"
            style={{ transform: ui.mode === 'manual' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          {(['auto', 'manual'] as const).map(m => (
            <button key={m} type="button" aria-pressed={ui.mode === m}
              onClick={() => setUi(u => ({ ...u, mode: m }))}
              className="focus-ring relative z-10 rounded-full py-2.5 font-medium capitalize transition-colors"
              style={{ color: ui.mode === m ? '#000' : 'var(--muted)' }}>
              {m === 'auto' ? 'Auto (recommended)' : 'Manual'}
            </button>
          ))}
        </div>

        {ui.mode === 'manual' && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {MODELS.map(m => (
                <button key={m.id} type="button" aria-pressed={ui.model === m.id}
                  onClick={() => setUi(u => ({ ...u, model: m.id }))}
                  className="focus-ring card relative p-4 text-left transition"
                  style={ui.model === m.id ? { borderColor: 'var(--amber)', boxShadow: '0 0 0 1px var(--amber)' } : undefined}>
                  {ui.model === m.id && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-amber" aria-hidden="true" />}
                  <div className="font-serif text-lg">{m.label}</div>
                  <div className="mt-0.5 text-xs text-muted">{m.hint}</div>
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted">
                <span className="eyebrow">Natural</span>
                <span className="eyebrow">Faithful</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={ui.fidelity} aria-label="Fidelity"
                disabled={ui.model !== 'codeformer'}
                onChange={e => setUi(u => ({ ...u, fidelity: Number(e.target.value) }))}
                className="slider focus-ring mt-3 w-full" />
              {ui.model !== 'codeformer' && (
                <p className="mt-2 text-xs text-muted">Fidelity is available with CodeFormer.</p>
              )}
            </div>

            <div>
              <div className="eyebrow mb-2">Upscale</div>
              <div className="flex w-fit gap-1 rounded-full p-1" style={{ border: '1px solid var(--hairline-strong)' }}>
                {([2, 4] as const).map(x => (
                  <button key={x} type="button" aria-pressed={ui.upscale === x}
                    onClick={() => setUi(u => ({ ...u, upscale: x }))}
                    className={`focus-ring rounded-full px-5 py-1.5 text-sm font-medium transition ${ui.upscale === x ? 'bg-amber text-black' : 'text-muted hover:text-amber'}`}>
                    {x}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Colorize — clearly a future feature, quietly disabled */}
        <div className="mt-6 flex items-center justify-between rounded-card p-4 opacity-70" style={{ border: '1px solid var(--hairline)' }}>
          <div>
            <div className="flex items-center gap-2 font-medium">
              Colorize
              <span className="chip !px-2 !py-0.5 !text-[10px] uppercase tracking-label">Soon</span>
            </div>
            <div className="mt-0.5 text-xs text-muted">Automatic colour for black-and-white photos</div>
          </div>
          <input type="checkbox" checked={false} disabled readOnly aria-label="Colorize (coming soon)" />
        </div>

        <p className="eyebrow mt-6">{summary(ui)}</p>

        {err && <p className="mt-3 text-sm text-coral">{err}</p>}

        <button type="button" onClick={onRestore} disabled={busy} className="btn-primary mt-4 w-full">
          {busy ? 'Sending to the AI…' : 'Restore photo'}
        </button>
        <button type="button" onClick={() => nav('/')} className="btn-tertiary mt-3 w-full">
          Choose a different photo
        </button>
      </div>
    </main>
  )
}
