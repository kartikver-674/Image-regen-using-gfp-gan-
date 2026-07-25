import type { JobStatus, RestoreOptions } from './types'

const BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000'

export function resolveUrl(rel: string): string {
  if (/^https?:\/\//.test(rel)) return rel
  return BASE + rel
}

export type UiOptions = {
  mode: 'auto' | 'manual'
  model: 'gfpgan' | 'codeformer' | 'hybrid'
  fidelity: number
  upscale: 2 | 4
  colorize: boolean // cosmetic — never sent
}

// Hybrid runs GFPGAN then a CodeFormer refine pass, so it uses the fidelity knob too.
const USES_FIDELITY = new Set(['codeformer', 'hybrid'])

export function buildOptions(o: UiOptions): RestoreOptions {
  if (o.mode === 'auto') return { mode: 'auto' }
  const out: RestoreOptions = { mode: 'manual', model: o.model, upscale: o.upscale }
  if (USES_FIDELITY.has(o.model)) out.fidelity = o.fidelity
  return out
}

export async function createJob(file: File, opts: RestoreOptions): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(opts))
  const r = await fetch(`${BASE}/jobs`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(`upload failed (${r.status}): ${await r.text()}`)
  return (await r.json()).job_id as string
}

export async function getJob(id: string): Promise<JobStatus> {
  const r = await fetch(`${BASE}/jobs/${id}`)
  if (!r.ok) throw new Error(`status failed (${r.status})`)
  return r.json()
}
