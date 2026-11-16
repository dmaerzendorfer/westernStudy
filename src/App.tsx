import { isFirebaseConfigured } from './lib/firebase'

// Placeholder screen — real screens (lobby → duel → result) come in later steps
export default function App() {
  return (
    <main className="screen">
      <h1>Western Duel</h1>
      <p>Setup OK — no game logic yet.</p>
      <p className="status">
        Firebase: {isFirebaseConfigured ? 'configured' : 'missing env vars (see .env.example)'}
      </p>
      <p className="status">Version {__APP_VERSION__}</p>
    </main>
  )
}
