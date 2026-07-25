import { Link, Route, Routes } from 'react-router-dom'
import { useTheme } from './theme'
import Upload from './routes/Upload'
import Options from './routes/Options'
import Processing from './routes/Processing'
import Result from './routes/Result'
import Gallery from './routes/Gallery'

export default function App() {
  const { theme, toggle } = useTheme()
  return (
    <div className="relative z-10 min-h-full">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="focus-ring group inline-flex items-center gap-2 rounded font-serif text-2xl tracking-tight">
          <span className="h-2 w-2 rounded-full bg-amber ring-2 ring-amber/25 transition group-hover:ring-amber/50" aria-hidden="true" />
          Restory
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/gallery"
            className="focus-ring rounded-full px-3 py-1.5 text-sm text-muted transition hover:text-amber"
          >
            Gallery
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-neutral-700 text-base transition hover:border-neutral-500"
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/options" element={<Options />} />
        <Route path="/processing/:jobId" element={<Processing />} />
        <Route path="/result/:jobId" element={<Result />} />
        <Route path="/gallery" element={<Gallery />} />
      </Routes>
    </div>
  )
}
