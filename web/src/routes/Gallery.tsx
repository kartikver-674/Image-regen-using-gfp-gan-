import { useNavigate } from 'react-router-dom'
import { resolveUrl } from '../api'
import { useHistory } from '../hooks/useHistory'
import { whatWeDid } from '../components/Chips'
import type { HistoryEntry } from '../types'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'

export default function Gallery() {
  const { entries, remove } = useHistory()
  const nav = useNavigate()

  if (entries.length === 0) {
    return (
      <main className="grain mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <div className="gallery-frame" aria-hidden="true" />
        <h1 className="mt-10 font-serif text-4xl">No restorations yet</h1>
        <p className="mt-3 font-sans text-neutral-400">
          Your restored prints gather here, like a darkroom archive.
        </p>
        <button
          type="button"
          onClick={() => nav('/')}
          className={`mt-8 rounded-full bg-amber px-7 py-3 font-medium text-black transition hover:brightness-105 ${focusRing}`}
        >
          Restore your first photo
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-4xl">Your restorations</h1>
        <p className="mt-1 font-sans text-sm text-neutral-400">
          {entries.length} photo{entries.length > 1 ? 's' : ''}
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {entries.map(e => (
          <li key={e.jobId}>
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
      onClick={onOpen}
      // keydown bubbles up from the remove button too — only navigate when the card itself is focused
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`gallery-card group cursor-pointer rounded-card text-left ${focusRing}`}
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
          className={`gallery-remove absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full text-base leading-none opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${focusRing}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* Caption strip below the frame */}
      <div className="px-1 pt-3">
        <div className="truncate font-sans text-sm">{entry.name}</div>
        <div className="mt-0.5 font-sans text-xs text-neutral-500">
          {new Date(entry.date).toLocaleDateString()}
        </div>
        <span className="gallery-chip mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
          {model}
        </span>
      </div>
    </div>
  )
}
