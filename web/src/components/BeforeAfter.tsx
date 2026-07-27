import { useLayoutEffect, useRef, useState } from 'react'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'

// Custom divider: a spectral line with a dark grip disc + two chevrons.
function ResultHandle() {
  return (
    <div className="flex h-full w-10 flex-col items-center" aria-hidden="true">
      <div className="w-px flex-1" style={{ background: 'linear-gradient(180deg, transparent, var(--amber))', boxShadow: '0 0 8px rgba(232,163,61,0.6)' }} />
      <div className="my-2 grid h-9 w-9 grid-flow-col place-content-center gap-1 rounded-full text-amber backdrop-blur-sm"
        style={{ background: 'var(--scrim)', border: '1px solid var(--amber)' }}>
        <span className="text-xs leading-none">‹</span>
        <span className="text-xs leading-none">›</span>
      </div>
      <div className="w-px flex-1" style={{ background: 'linear-gradient(180deg, var(--amber), transparent)', boxShadow: '0 0 8px rgba(232,163,61,0.6)' }} />
    </div>
  )
}

/** Half of ResultHandle's `w-10` column — how far the grip reaches past the divider. */
const HANDLE_REACH = 20
/** The `left-3` / `right-3` inset of the label pills. */
const EDGE_INSET = 12
/** ReactCompareSlider's own `defaultPosition`; it doesn't fire onPositionChange on mount. */
const START_POSITION = 50

export type LabelMetrics = { width: number; position: number; beforeWidth: number; afterWidth: number }

/**
 * Each label belongs to one pane, so it may only show while that pane both survives the
 * clip and is wide enough to hold the pill clear of the grip column. The library clips
 * itemOne from the right and itemTwo from the left, so a pane vanishing at 0%/100% falls
 * out of the same arithmetic — the divider simply reaches the label's own edge.
 */
export function labelVisibility({ width, position, beforeWidth, afterWidth }: LabelMetrics) {
  const divider = (position / 100) * width
  return {
    before: divider - HANDLE_REACH >= EDGE_INSET + beforeWidth,
    after: divider + HANDLE_REACH <= width - EDGE_INSET - afterWidth,
  }
}

// z-[2] is load-bearing: the library gives itemOne (the *before* image) `z-index: 1` as a
// grid item while itemTwo gets none, and neither .frame nor the slider root opens a stacking
// context — so at z-auto the before image paints straight over the "Before" pill everywhere
// that image is visible, while "After" looks fine. Stays under .frame-corner (z-6) to keep
// the existing corner-bracket layering.
const labelCls =
  'pointer-events-none absolute top-3 z-[2] rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-white/90 backdrop-blur-sm transition-opacity duration-200 ease-resolve'

export function BeforeAfter({ before, after }: { before: string; after: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const beforeLabel = useRef<HTMLSpanElement>(null)
  const afterLabel = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState(START_POSITION)
  const [size, setSize] = useState({ width: 0, beforeWidth: 0, afterWidth: 0 })

  // The pills are measured rather than assumed: they size to their text and to whenever
  // the mono face finishes loading, and the hide threshold has to stay exact through both.
  // Hiding uses opacity only, so the boxes keep their layout and stay measurable.
  useLayoutEffect(() => {
    const measure = () => setSize({
      width: frame.current?.clientWidth ?? 0,
      beforeWidth: beforeLabel.current?.offsetWidth ?? 0,
      afterWidth: afterLabel.current?.offsetWidth ?? 0,
    })
    measure()
    const ro = new ResizeObserver(measure)
    for (const el of [frame.current, beforeLabel.current, afterLabel.current]) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const shown = labelVisibility({ ...size, position })

  return (
    <div ref={frame} className="frame max-h-[min(72vh,640px)]">
      {/* Cap height so a tall portrait can't dominate/overflow the fold. The frame
          clips; images keep their aspect (object-cover) so before/after stay aligned. */}
      <ReactCompareSlider
        handle={<ResultHandle />}
        onPositionChange={setPosition}
        itemOne={<ReactCompareSliderImage src={before} alt="Before restoration" />}
        itemTwo={<ReactCompareSliderImage src={after} alt="After restoration" />}
      />
      <span ref={beforeLabel} aria-hidden={!shown.before} style={{ opacity: shown.before ? 1 : 0 }}
        className={`${labelCls} left-3`}>Before</span>
      <span ref={afterLabel} aria-hidden={!shown.after} style={{ opacity: shown.after ? 1 : 0 }}
        className={`${labelCls} right-3`}>After</span>
      <span className="frame-corner tl" aria-hidden="true" />
      <span className="frame-corner tr" aria-hidden="true" />
      <span className="frame-corner bl" aria-hidden="true" />
      <span className="frame-corner br" aria-hidden="true" />
    </div>
  )
}
