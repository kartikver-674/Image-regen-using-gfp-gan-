const STAGES = ['Analyzing', 'Restoring faces', 'Upscaling', 'Finishing']

export function StepIndicator({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {STAGES.map((s, i) => (
        <div key={s} className="flex-1">
          <div
            className={`h-1 rounded-full transition-colors duration-500 ${
              i < activeIndex ? 'bg-amber/70' : i === activeIndex ? 'step-active bg-amber' : 'bg-neutral-700'
            }`}
          />
          <div
            className={`mt-2 text-xs transition-colors duration-500 ${
              i === activeIndex ? 'font-medium text-amber' : i < activeIndex ? 'text-muted' : 'text-muted opacity-60'
            }`}
          >
            {s}
          </div>
        </div>
      ))}
    </div>
  )
}
