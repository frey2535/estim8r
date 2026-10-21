import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { restoreRefreshRoute } from '@/lib/appRefresh'
import { startUpdateChecks } from '@/lib/update-check'
import '@/index.css'

startUpdateChecks()
restoreRefreshRoute()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
