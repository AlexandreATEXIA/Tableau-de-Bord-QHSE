import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { EmployesProvider } from './EmployesContext.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import { ConfigProvider } from './ConfigContext.jsx'
import { ToastProvider } from './Toast.jsx'
import { ParametresProvider } from './ParametresContext.jsx'
import { AnneeProvider } from './AnneeContext.jsx'
import { AlertesProvider } from './AlertesContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ConfigProvider>
        <EmployesProvider>
          <ToastProvider>
            <ParametresProvider>
              <AnneeProvider>
                <AlertesProvider>
                  <App />
                </AlertesProvider>
              </AnneeProvider>
            </ParametresProvider>
          </ToastProvider>
        </EmployesProvider>
      </ConfigProvider>
    </ThemeProvider>
  </StrictMode>,
)
