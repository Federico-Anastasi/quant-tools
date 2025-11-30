import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Docs from './pages/Docs'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
