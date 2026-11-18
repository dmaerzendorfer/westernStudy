import { useEffect, useRef, useState } from 'react'
import { isFirebaseConfigured } from './lib/firebase'
import { unlockDevice } from './lib/device'
import { createLobby, joinLobby, leaveLobby, playerId, watchLobby, type Lobby } from './lib/lobby'
import { loadSettings } from './settings'
import LobbyScreen from './Lobby'
import { GameScreen, HitFlash, WinScreen, useHitFeedback } from './Game'

// The lobby code lives in the URL (?lobby=CODE): the QR link opens it, and a reload rejoins
const codeFromUrl = () => new URLSearchParams(location.search).get('lobby')?.toUpperCase() || null
const setUrlCode = (code: string | null) => history.replaceState(null, '', code ? `/?lobby=${code}` : '/')

export default function App() {
  const [code, setCode] = useState(codeFromUrl)
  const [joined, setJoined] = useState(false)
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const leaving = useRef(false) // our own leave also fires the listener; don't report it as "closed"
  useHitFeedback(lobby)

  useEffect(() => {
    if (!joined || !code) return
    leaving.current = false
    return watchLobby(code, (l) => {
      if (leaving.current) return
      if (l && l.players?.[playerId]) return setLobby(l)
      // Lobby deleted (host left) or we were removed
      setJoined(false)
      setLobby(null)
      setCode(null)
      setUrlCode(null)
      setError('The lobby was closed.')
    })
  }, [joined, code])

  // Both buttons are taps, so they also unlock audio, vibration and the torch
  async function play() {
    void unlockDevice()
    setBusy(true)
    setError('')
    try {
      const newCode = await createLobby(loadSettings())
      setCode(newCode)
      setUrlCode(newCode)
      setJoined(true)
    } catch (e) {
      setError(`Could not create a lobby: ${(e as Error).message}`)
    }
    setBusy(false)
  }

  async function join(joinCode: string) {
    void unlockDevice()
    setBusy(true)
    setError('')
    try {
      const res = await joinLobby(joinCode)
      if (res === 'ok') setJoined(true)
      else {
        setError(res === 'full' ? 'That lobby is full or already playing.' : 'Lobby not found.')
        setCode(null)
        setUrlCode(null)
      }
    } catch (e) {
      setError(`Could not join: ${(e as Error).message}`)
    }
    setBusy(false)
  }

  function backToMenu() {
    leaving.current = true
    if (code && lobby) void leaveLobby(code, lobby.hostId === playerId)
    setJoined(false)
    setLobby(null)
    setCode(null)
    setUrlCode(null)
  }

  if (joined && code) {
    if (!lobby) return <main className="screen"><p className="status">Connecting...</p></main>
    return (
      <>
        {lobby.status === 'lobby' && <LobbyScreen code={code} lobby={lobby} onLeave={backToMenu} />}
        {lobby.status === 'playing' && <GameScreen code={code} lobby={lobby} />}
        {lobby.status === 'over' && <WinScreen code={code} lobby={lobby} onMenu={backToMenu} />}
        <HitFlash lobby={lobby} />
      </>
    )
  }

  return (
    <main className="screen menu">
      <h1 className="title">High Noon Duel</h1>
      {code ? (
        <>
          <button className="big" disabled={busy || !isFirebaseConfigured} onClick={() => join(code)}>
            Join lobby {code}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setCode(null)
              setUrlCode(null)
            }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button className="big" disabled={busy || !isFirebaseConfigured} onClick={play}>
          Play
        </button>
      )}
      {busy && <p className="status">Connecting...</p>}
      {error && <p className="error">{error}</p>}
      {!isFirebaseConfigured && <p className="error">Firebase is not configured (VITE_FIREBASE_* env vars).</p>}
      <p className="status version">v{__APP_VERSION__}</p>
    </main>
  )
}
