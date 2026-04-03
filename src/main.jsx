import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { EmployesProvider } from './EmployesContext.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import { ConfigProvider } from './ConfigContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ConfigProvider>
        <EmployesProvider>
          <App />
        </EmployesProvider>
      </ConfigProvider>
    </ThemeProvider>
  </StrictMode>,
)
