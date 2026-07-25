import { Link, Route, Routes } from 'react-router-dom'
import { useTheme } from './theme'
import Upload from './routes/Upload'
import Options from './routes/Options'

const Stub = ({ name }: { name: string }) => <div className="p-8">{name}</div>

export default function App() {
  const { theme, toggle } = useTheme()
  return (
    <div className="relative z-10 min-h-full">
      <nav className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="font-serif text-2xl">Restory</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/gallery">Gallery</Link>
          <button onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? '☾' : '☀'}</button>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/options" element={<Options />} />
        <Route path="/processing/:jobId" element={<Stub name="Processing" />} />
        <Route path="/result/:jobId" element={<Stub name="Result" />} />
        <Route path="/gallery" element={<Stub name="Gallery" />} />
      </Routes>
    </div>
  )
}
