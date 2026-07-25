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

const labelCls =
  'absolute top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-white/90 backdrop-blur-sm'

export function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="frame max-h-[min(72vh,640px)]">
      {/* Cap height so a tall portrait can't dominate/overflow the fold. The frame
          clips; images keep their aspect (object-cover) so before/after stay aligned. */}
      <ReactCompareSlider
        handle={<ResultHandle />}
        itemOne={<ReactCompareSliderImage src={before} alt="Before restoration" />}
        itemTwo={<ReactCompareSliderImage src={after} alt="After restoration" />}
      />
      <span className={`${labelCls} left-3`}>Before</span>
      <span className={`${labelCls} right-3`}>After</span>
      <span className="frame-corner tl" aria-hidden="true" />
      <span className="frame-corner tr" aria-hidden="true" />
      <span className="frame-corner bl" aria-hidden="true" />
      <span className="frame-corner br" aria-hidden="true" />
    </div>
  )
}
