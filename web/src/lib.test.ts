import { describe, expect, it, beforeEach } from 'vitest'
import { buildOptions, resolveUrl } from './api'
import { addEntry, loadHistory, removeEntry } from './historyStore'
import { whatWeDid } from './components/Chips'
import { labelVisibility } from './components/BeforeAfter'
import type { HistoryEntry } from './types'

describe('resolveUrl', () => {
  it('prefixes relative API urls with the base', () => {
    expect(resolveUrl('/results/abc/x.png')).toBe('http://localhost:8000/results/abc/x.png')
  })
  it('passes absolute urls through', () => {
    expect(resolveUrl('http://x/y.png')).toBe('http://x/y.png')
  })
})

describe('buildOptions', () => {
  it('auto sends only mode', () => {
    expect(buildOptions({ mode: 'auto', model: 'codeformer', fidelity: 0.7, upscale: 4, colorize: true }))
      .toEqual({ mode: 'auto' })
  })
  it('manual gfpgan omits fidelity and never emits colorize', () => {
    const o = buildOptions({ mode: 'manual', model: 'gfpgan', fidelity: 0.5, upscale: 2, colorize: true })
    expect(o).toEqual({ mode: 'manual', model: 'gfpgan', upscale: 2 })
    expect('colorize' in o).toBe(false)
  })
  it('manual codeformer includes fidelity', () => {
    expect(buildOptions({ mode: 'manual', model: 'codeformer', fidelity: 0.8, upscale: 4, colorize: false }))
      .toEqual({ mode: 'manual', model: 'codeformer', fidelity: 0.8, upscale: 4 })
  })
})

const entry = (jobId: string): HistoryEntry => ({
  jobId, name: 'p.jpg', date: '2026-07-25T00:00:00Z',
  beforeUrl: `/results/${jobId}/p.jpg`, afterUrl: `/results/${jobId}/restored_imgs/p.png`,
  analysis: { is_grayscale: false, blur_score: 1, width: 8, height: 8, n_faces: 1, min_face_size: 8 },
  routing: { model_used: 'gfpgan', fidelity: null, upscale: 2, background_upscale: true, rationale: 'r' },
  elapsedS: 1, device: 'cpu',
})

describe('whatWeDid', () => {
  const withRouting = (jobId: string, r: Partial<HistoryEntry['routing']>): HistoryEntry =>
    ({ ...entry(jobId), routing: { ...entry(jobId).routing, ...r } })
  const withAnalysis = (jobId: string, a: Partial<HistoryEntry['analysis']>): HistoryEntry =>
    ({ ...entry(jobId), analysis: { ...entry(jobId).analysis, ...a } })

  it('gfpgan: model + upscale + face chip, no fidelity chip', () => {
    // base entry is gfpgan / fidelity null / n_faces 1 / not grayscale
    expect(whatWeDid(entry('g'))).toEqual(['GFPGAN', 'Upscaled 2×', '1 face restored'])
  })
  it('codeformer with fidelity emits the Fidelity chip', () => {
    const chips = whatWeDid(withRouting('c', { model_used: 'codeformer', fidelity: 0.5, upscale: 4 }))
    expect(chips).toContain('CodeFormer')
    expect(chips).toContain('Upscaled 4×')
    expect(chips).toContain('Fidelity 0.5')
  })
  it('unknown model → "Background only", never a fidelity chip', () => {
    const chips = whatWeDid(withRouting('b', { model_used: 'none', fidelity: 0.9 }))
    expect(chips[0]).toBe('Background only')
    expect(chips.some(c => c.startsWith('Fidelity'))).toBe(false)
  })
  it('n_faces 0 → no face chip; n_faces 2 → pluralized', () => {
    expect(whatWeDid(withAnalysis('z', { n_faces: 0 })).some(c => c.includes('face'))).toBe(false)
    expect(whatWeDid(withAnalysis('t', { n_faces: 2 }))).toContain('2 faces restored')
  })
  it('is_grayscale adds the B&W chip', () => {
    expect(whatWeDid(withAnalysis('bw', { is_grayscale: true }))).toContain('B&W detected')
  })
})

describe('labelVisibility', () => {
  // A 600px frame with pills roughly the size the mono/tracking type renders at.
  const frame = { width: 600, beforeWidth: 62, afterWidth: 54 }
  const at = (position: number) => labelVisibility({ ...frame, position })

  it('shows both labels while the divider sits clear of either pill', () => {
    expect(at(50)).toEqual({ before: true, after: true })
  })

  it('hides "Before" at 0% — the before image is fully clipped away', () => {
    expect(at(0).before).toBe(false)
  })

  it('hides "After" at 100% — the after image is fully clipped away', () => {
    expect(at(100).after).toBe(false)
  })

  it('hides "Before" before the grip column can cover it', () => {
    // Pill occupies x 12..74; the w-10 grip reaches 20px left of the divider,
    // so the label must go by the time the divider passes x=94 (≈15.7%).
    expect(at(14).before).toBe(false)
    expect(at(20).before).toBe(true)
  })

  it('hides "After" before the grip column can cover it', () => {
    // Pill occupies x 534..588; the grip reaches 20px right of the divider,
    // so the label must go once the divider passes x=514 (≈85.7%).
    expect(at(87).after).toBe(false)
    expect(at(80).after).toBe(true)
  })

  it('keeps the opposite label visible when one side collapses', () => {
    expect(at(0).after).toBe(true)
    expect(at(100).before).toBe(true)
  })

  it('hides both before the frame has been measured', () => {
    expect(labelVisibility({ width: 0, position: 50, beforeWidth: 0, afterWidth: 0 }))
      .toEqual({ before: false, after: false })
  })
})

describe('historyStore', () => {
  beforeEach(() => localStorage.clear())
  it('prepends newest first', () => {
    addEntry(entry('a')); addEntry(entry('b'))
    expect(loadHistory().map(e => e.jobId)).toEqual(['b', 'a'])
  })
  it('dedupes by jobId (re-add moves to front, no dupes)', () => {
    addEntry(entry('a')); addEntry(entry('b')); addEntry(entry('a'))
    expect(loadHistory().map(e => e.jobId)).toEqual(['a', 'b'])
  })
  it('removes by jobId', () => {
    addEntry(entry('a')); addEntry(entry('b'))
    expect(removeEntry('a').map(e => e.jobId)).toEqual(['b'])
  })
})
