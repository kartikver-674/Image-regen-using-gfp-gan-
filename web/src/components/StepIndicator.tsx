const STAGES = ['Analyzing', 'Restoring faces', 'Upscaling', 'Finishing']

export function StepIndicator({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-center gap-2">
      {STAGES.map((s, i) => (
        <div key={s} className="flex-1">
          <div className={`h-1 rounded ${i <= activeIndex ? 'bg-amber' : 'bg-neutral-700'}`} />
          <div className={`mt-1 text-xs ${i === activeIndex ? 'text-amber' : 'text-neutral-500'}`}>{s}</div>
        </div>
      ))}
    </div>
  )
}
