import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ModalHost } from './shared/modals'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalHost />
    <App />
  </StrictMode>,
)
