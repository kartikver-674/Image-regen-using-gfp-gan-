import type { HistoryEntry } from '../types'

// Model is always chips[0] — Chips renders the amber dot on it.
export function whatWeDid(e: HistoryEntry): string[] {
  const r = e.routing, a = e.analysis
  const chips = [
    r.model_used === 'codeformer' ? 'CodeFormer' : r.model_used === 'gfpgan' ? 'GFPGAN' : 'Background only',
    `Upscaled ${r.upscale}×`,
  ]
  if (r.model_used === 'codeformer' && r.fidelity != null) chips.push(`Fidelity ${r.fidelity}`)
  if (a.n_faces > 0) chips.push(`${a.n_faces} face${a.n_faces > 1 ? 's' : ''} restored`)
  if (a.is_grayscale) chips.push('B&W detected')
  return chips
}

export function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c, i) => (
        <span
          key={c}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-500/40 px-3 py-1 font-sans text-sm"
        >
          {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />}
          {c}
        </span>
      ))}
    </div>
  )
}
