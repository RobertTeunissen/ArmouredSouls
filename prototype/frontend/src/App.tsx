import { useState, useEffect } from 'react'

function App() {
  const [status, setStatus] = useState<string>('Connecting...')

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(() => setStatus('Unable to connect to backend'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4">Armoured Souls</h1>
        <p className="text-xl text-gray-300 mb-8">Phase 1 - Local Prototype</p>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Status</h2>
          <p className="text-green-400">{status}</p>
        </div>
      </div>
    </div>
  )
}

export default App
