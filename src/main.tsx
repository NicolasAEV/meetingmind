import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode — double-invoking effects would create duplicate audio contexts
createRoot(document.getElementById('root')!).render(<App />)
