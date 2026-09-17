import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

try {
  const redirect = window.sessionStorage.getItem('estim8r_redirect');
  if (redirect && window.location.pathname === '/') {
    window.sessionStorage.removeItem('estim8r_redirect');
    window.history.replaceState(null, '', redirect);
  }
} catch {
  // Ignore storage failures and continue with the normal app route.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
