import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { StepIndicator } from '../components/StepIndicator'
import { ScannerFrame } from '../components/ScannerFrame'
import { useHistory } from '../hooks/useHistory'
import { usePollJob } from '../hooks/usePollJob'
import { useUpload } from '../UploadContext'
import type { UiOptions } from '../api'

type NavState = { name?: string; mode?: 'auto' | 'manual'; ui?: UiOptions }

// ponytail: coarse fidelity label for the status line — not the routing rationale,
// just a human-readable echo of the slider the user already set on Options.
function fidelityLabel(f: number): string {
  return f >= 0.7 ? 'high' : f >= 0.4 ? 'medium' : 'low'
}

function statusText(state: NavState): string {
  if (state.mode === 'manual' && state.ui) {
    const { ui } = state
    return ui.model === 'codeformer'
      ? `Using CodeFormer at ${fidelityLabel(ui.fidelity)} fidelity`
      : 'Using GFPGAN'
  }
  return 'Analysing the photo and choosing the best restoration'
}

export default function Processing() {
  const { jobId } = useParams()
  const { state } = useLocation() as { state?: NavState }
  const nav = useNavigate()
  const { upload, clear } = useUpload()
  const { add } = useHistory()
  const job = usePollJob(jobId ?? null)

  // ponytail: cosmetic stage ticker — the API reports no sub-stage progress, so
  // this just walks the 4 labels on a timer. It does NOT reflect real server state.
  const [stage, setStage] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const s = setInterval(() => setStage(x => Math.min(x + 1, 3)), 8000)
    const e = setInterval(() => setElapsed(x => x + 1), 1000)
    return () => { clearInterval(s); clearInterval(e) }
  }, [])

  useEffect(() => {
    if (job.status === 'done' && job.result) {
      const r = job.result
      const name = state?.name ?? 'photo'
      add({
        jobId: jobId!, name, date: new Date().toISOString(),
        beforeUrl: `/results/${jobId}/${encodeURIComponent(name)}`,
        afterUrl: r.restored_url,
        analysis: r.analysis, routing: r.routing, elapsedS: r.elapsed_s, device: r.device,
      })
      nav(`/result/${jobId}`, { replace: true })
    }
  }, [job.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (job.status === 'error') {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="font-serif text-2xl">That restoration didn't finish</p>
        <p className="mt-2 text-sm text-muted">{job.error}</p>
        <Link to="/" className="btn-primary mt-6">Try again</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      {upload && (
        <ScannerFrame scan="active">
          <img src={upload.previewUrl} alt="" className="block max-h-[52vh] w-full object-contain opacity-75" />
        </ScannerFrame>
      )}

      <h1 className="mt-9 font-serif text-3xl font-medium tracking-tight">Restoring your photo</h1>
      <p className="mt-2 text-muted">{statusText(state ?? {})}</p>
      <p className="eyebrow mt-3">Elapsed {elapsed}s · runs on CPU · ~30–60s</p>

      <div className="mt-9">
        <StepIndicator activeIndex={stage} />
      </div>

      <button type="button" onClick={() => { clear(); nav('/') }} className="btn-tertiary mt-9">
        Cancel
      </button>
    </main>
  )
}
