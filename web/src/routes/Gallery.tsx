import { useNavigate } from 'react-router-dom'
import { resolveUrl } from '../api'
import { useHistory } from '../hooks/useHistory'
import { whatWeDid } from '../components/Chips'
import { ScannerFrame } from '../components/ScannerFrame'
import { useReveal } from '../lib/motion'
import type { HistoryEntry } from '../types'

export default function Gallery() {
  const { entries, remove } = useHistory()
  const nav = useNavigate()
  const scope = useReveal<HTMLElement>([entries.length])

  if (entries.length === 0) {
    return (
      <main ref={scope} className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <div data-reveal className="w-44">
          <ScannerFrame scan="idle" className="aspect-square">
            <div className="grid h-full place-items-center">
              <span className="h-2.5 w-2.5 rounded-full bg-amber/60" aria-hidden="true" />
            </div>
          </ScannerFrame>
        </div>
        <h1 data-reveal className="mt-10 font-serif text-4xl font-medium tracking-tight">No restorations yet</h1>
        <p data-reveal className="mt-3 max-w-sm font-sans text-muted">
          Every photo you restore is kept here, ready to revisit or download again.
        </p>
        <button data-reveal type="button" onClick={() => nav('/')} className="btn-primary mt-8">
          Restore your first photo
        </button>
      </main>
    )
  }

  return (
    <main ref={scope} className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-4xl font-medium tracking-tight">Your restorations</h1>
        <p className="eyebrow mt-2">{entries.length} photo{entries.length > 1 ? 's' : ''} restored</p>
      </header>

      <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {entries.map(e => (
          <li key={e.jobId} data-reveal>
            <Card entry={e} onOpen={() => nav(`/result/${e.jobId}`)} onRemove={() => remove(e.jobId)} />
          </li>
        ))}
      </ul>
    </main>
  )
}

function Card({ entry, onOpen, onRemove }: { entry: HistoryEntry; onOpen: () => void; onRemove: () => void }) {
  const model = whatWeDid(entry)[0]
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${entry.name}`}
      onClick={onOpen}
      // keydown bubbles up from the remove button too — only navigate when the card itself is focused
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="gallery-card focus-ring group cursor-pointer rounded-card text-left"
    >
      {/* The print: restored is the face; the original peeks in on hover. */}
      <div className="gallery-print relative aspect-square overflow-hidden rounded-card">
        <img
          src={resolveUrl(entry.afterUrl)}
          alt={`Restored: ${entry.name}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* before image is stacked + preloaded so the hover peek never flashes */}
        <img
          src={resolveUrl(entry.beforeUrl)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-100"
        />

        {/* Before / After cue — crossfades with the image, static "After" under reduced motion */}
        <span className="gallery-cue opacity-90 transition-opacity duration-500 motion-safe:group-hover:opacity-0">
          After
        </span>
        <span className="gallery-cue opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-90">
          Before
        </span>

        {/* Quiet remove — appears on hover / keyboard focus */}
        <button
          type="button"
          aria-label={`Remove ${entry.name} from gallery`}
          onClick={e => {
            e.stopPropagation()
            onRemove()
          }}
          className="gallery-remove focus-ring absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full text-base leading-none opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* Caption strip below the frame */}
      <div className="px-1 pt-3">
        <div className="truncate font-sans text-sm">{entry.name}</div>
        <div className="eyebrow mt-1">{new Date(entry.date).toLocaleDateString()}</div>
        <span className="chip mt-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
          {model}
        </span>
      </div>
    </div>
  )
}
