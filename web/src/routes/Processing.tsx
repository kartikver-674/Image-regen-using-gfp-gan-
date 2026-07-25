import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { StepIndicator } from '../components/StepIndicator'
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
  return 'Restoring your photo — this runs on CPU, ~30–60s'
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
  useEffect(() => {
    const t = setInterval(() => setStage(s => Math.min(s + 1, 3)), 8000)
    return () => clearInterval(t)
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
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-coral">{job.error}</p>
        <Link to="/" className="mt-4 inline-block underline">Try again</Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      {upload && (
        <div className="shimmer overflow-hidden rounded-card border border-neutral-700 opacity-50">
          <img src={upload.previewUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <p className="mt-8">{statusText(state ?? {})}</p>
      <p className="mt-1 text-sm text-neutral-500">~30–60s</p>

      <div className="mt-8">
        <StepIndicator activeIndex={stage} />
      </div>

      <button type="button" onClick={() => { clear(); nav('/') }}
        className="mt-8 text-sm text-neutral-400 underline">
        Cancel
      </button>
    </main>
  )
}
