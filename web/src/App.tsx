import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useTheme } from './theme'
import { Background } from './components/Background'
import Upload from './routes/Upload'
import Options from './routes/Options'
import Processing from './routes/Processing'
import Result from './routes/Result'
import Gallery from './routes/Gallery'

export default function App() {
  const { theme, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative z-10 min-h-full">
      <Background />

      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b backdrop-blur-md' : 'border-b border-transparent'
        }`}
        style={{
          borderColor: scrolled ? 'var(--hairline)' : 'transparent',
          background: scrolled ? 'color-mix(in srgb, var(--bg) 72%, transparent)' : 'transparent',
        }}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="focus-ring group inline-flex items-center gap-2.5 rounded font-serif text-2xl tracking-tight">
            <span className="relative grid h-3 w-3 place-items-center" aria-hidden="true">
              <span className="absolute inset-0 rounded-full bg-amber opacity-40 blur-[6px] transition group-hover:opacity-70" />
              <span className="relative h-2 w-2 rounded-full bg-amber" />
            </span>
            Restory
          </Link>
          <div className="flex items-center gap-1.5">
            <NavLink
              to="/gallery"
              className={({ isActive }) =>
                `focus-ring rounded-full px-3.5 py-1.5 font-mono text-xs uppercase tracking-label transition ${
                  isActive ? 'text-amber' : 'text-muted hover:text-amber'
                }`
              }
            >
              Gallery
            </NavLink>
            <button
              type="button"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="focus-ring grid h-9 w-9 place-items-center rounded-full text-base transition hover:text-amber"
              style={{ border: '1px solid var(--hairline-strong)' }}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </button>
          </div>
        </nav>
      </header>

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
