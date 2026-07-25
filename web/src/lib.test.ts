import { describe, expect, it } from 'vitest'
import { buildOptions, resolveUrl } from './api'

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
