import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { app, db } from './lib/firebase'

function App() {
  const [status, setStatus] = useState('Not tested yet')

  const testFirestoreWrite = async () => {
    try {
      setStatus('Testing Firestore write...')
      await addDoc(collection(db, 'test_connection'), {
        message: 'Hello from React',
        createdAt: serverTimestamp(),
      })
      setStatus('Write successful. Firestore is connected.')
    } catch (error) {
      if (error.code === 'permission-denied') {
        setStatus('Connected, but blocked by Firestore rules (permission-denied).')
        return
      }
      setStatus(`Error: ${error.message}`)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-200">
          React + Vite + Tailwind + Firebase
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Your frontend + Firestore setup is complete
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          Start building by editing <code className="rounded bg-slate-800 px-2 py-1">src/App.jsx</code>.
        </p>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
          <p>Project ID: <code>{app.options.projectId}</code></p>
          <p className="mt-1">Firestore status: {status}</p>
          <button
            type="button"
            onClick={testFirestoreWrite}
            className="mt-3 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Test Firestore Write
          </button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold">Dev server</h2>
            <p className="mt-2 text-sm text-slate-300">Run <code>npm run dev</code></p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold">Production build</h2>
            <p className="mt-2 text-sm text-slate-300">Run <code>npm run build</code></p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold">Preview build</h2>
            <p className="mt-2 text-sm text-slate-300">Run <code>npm run preview</code></p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
