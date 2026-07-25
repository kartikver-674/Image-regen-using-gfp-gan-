import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './theme'
import { UploadProvider } from './UploadContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <UploadProvider>
          <App />
        </UploadProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
