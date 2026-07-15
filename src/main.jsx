import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Register Chart.js components globally to avoid missing scale/controller errors
import 'chart.js/auto';
import App from './App'

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}