const STAGES = ['Analyse', 'Restore faces', 'Upscale', 'Finish']

export function StepIndicator({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-start gap-2.5">
      {STAGES.map((s, i) => (
        <div key={s} className="flex-1">
          <div
            className={`h-1 rounded-full transition-colors duration-500 ${
              i < activeIndex
                ? 'bg-amber/70'
                : i === activeIndex
                  ? 'bg-amber motion-safe:animate-pulse'
                  : 'bg-white/10'
            }`}
          />
          <div
            className={`mt-2.5 font-mono text-[10px] uppercase tracking-label transition-colors duration-500 ${
              i === activeIndex ? 'text-amber' : i < activeIndex ? 'text-muted' : 'text-muted opacity-50'
            }`}
          >
            {s}
          </div>
        </div>
      ))}
    </div>
  )
}
