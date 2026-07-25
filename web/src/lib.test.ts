import { describe, expect, it, beforeEach } from 'vitest'
import { buildOptions, resolveUrl } from './api'
import { addEntry, loadHistory, removeEntry } from './historyStore'
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
