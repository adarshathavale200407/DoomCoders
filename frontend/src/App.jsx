import { useEffect, useState } from 'react'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-emerald-700">Civic Fix</h1>
        <p className="mt-2 text-slate-600">
          Report civic issues. Track fixes. Hold the city accountable.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 p-4 text-sm">
          <p className="font-medium">Backend status</p>
          {error && <p className="mt-1 text-red-600">Unreachable: {error}</p>}
          {!error && !health && <p className="mt-1 text-slate-500">Checking…</p>}
          {health && (
            <p className="mt-1 text-emerald-700">
              API: {health.status} · Database: {health.database}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
