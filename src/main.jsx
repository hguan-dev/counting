import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bodoni-moda/latin-500.css'
import '@fontsource/bodoni-moda/latin-700.css'
import '@fontsource/bodoni-moda/latin-500-italic.css'
import '@fontsource/barlow-semi-condensed/latin-400.css'
import '@fontsource/barlow-semi-condensed/latin-500.css'
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
