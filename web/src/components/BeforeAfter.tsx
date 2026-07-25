import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'

// Custom divider: thin amber line with a small dark grip disc + two chevrons.
// Sits inside the library's full-height, center-aligned handle-root container.
function ResultHandle() {
  return (
    <div className="flex h-full w-10 flex-col items-center" aria-hidden="true">
      <div className="w-px flex-1 bg-amber/70 shadow-[0_0_6px_rgba(232,163,61,0.5)]" />
      <div className="my-2 grid h-9 w-9 grid-flow-col place-content-center gap-1 rounded-full bg-canvas-dark/80 text-amber ring-1 ring-amber/70 backdrop-blur-sm">
        <span className="text-xs leading-none">‹</span>
        <span className="text-xs leading-none">›</span>
      </div>
      <div className="w-px flex-1 bg-amber/70 shadow-[0_0_6px_rgba(232,163,61,0.5)]" />
    </div>
  )
}

const labelCls =
  'absolute top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-sans uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm'

export function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="relative max-h-[min(72vh,640px)] overflow-hidden rounded-card border border-amber/20 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
      {/* Cap height so a tall portrait can't dominate/overflow the fold. The frame
          clips; images keep their aspect (object-cover) so before/after stay aligned. */}
      <ReactCompareSlider
        handle={<ResultHandle />}
        itemOne={<ReactCompareSliderImage src={before} alt="Before restoration" />}
        itemTwo={<ReactCompareSliderImage src={after} alt="After restoration" />}
      />
      <span className={`${labelCls} left-3`}>Before</span>
      <span className={`${labelCls} right-3`}>After</span>
    </div>
  )
}
