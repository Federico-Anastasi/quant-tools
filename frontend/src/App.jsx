import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Docs from './pages/Docs'
import CookieBanner from './components/CookieBanner'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>

      {/* Cookie Consent Banner */}
      <CookieBanner />
    </BrowserRouter>
  )
}

export default App
