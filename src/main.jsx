import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { EmployesProvider } from './EmployesContext.jsx'
import { ThemeProvider } from './ThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <EmployesProvider>
        <App />
      </EmployesProvider>
    </ThemeProvider>
  </StrictMode>,
)
