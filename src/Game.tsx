import { useEffect, useRef, useState } from 'react'
import { playBeep, playHit } from './lib/device'
import { backToLobby, loseLife, playerId, serverNow, type Lobby } from './lib/lobby'

type Props = { code: string; lobby: Lobby }

// Hit sound on both phones whenever anyone loses a life
export function useHitSound(lobby: Lobby | null) {
  const total = lobby ? Object.values(lobby.players ?? {}).reduce((sum, p) => sum + p.lives, 0) : 0
  const prev = useRef(total)
  useEffect(() => {
    if (total < prev.current && lobby?.settings.soundOn) playHit()
    prev.current = total
  }, [total, lobby?.settings.soundOn])
}

// Countdown, then the match. ponytail: demo button stands in for the duel loop (Step 3)
export function GameScreen({ code, lobby }: Props) {
  const [now, setNow] = useState(serverNow)
  const startAt = lobby.startAt ?? 0
  const counting = now < startAt
  const secondsLeft = counting ? Math.ceil((startAt - now) / 1000) : 0
  const soundOn = lobby.settings.soundOn === 1

  useEffect(() => {
    if (!counting) return
    const id = setInterval(() => setNow(serverNow()), 100)
    return () => clearInterval(id)
  }, [counting])

  // Beep on each new number, final tone when the match begins
  useEffect(() => {
    if (soundOn) playBeep(secondsLeft === 0)
  }, [secondsLeft, soundOn])

  if (counting) {
    return (
      <main className="screen">
        <p className="status">Get ready</p>
        <p className="countdown">{secondsLeft}</p>
      </main>
    )
  }

  const me = lobby.players[playerId]
  const other = Object.entries(lobby.players).find(([id]) => id !== playerId)?.[1]

  return (
    <main className="screen game">
      <PlayerLives label={other?.name ?? 'Opponent'} lives={other?.lives ?? 0} max={lobby.settings.lives} />
      <p className="countdown">Draw!</p>
      <PlayerLives label={`${me.name} (you)`} lives={me.lives} max={lobby.settings.lives} />
      <button className="big" onClick={() => loseLife(code)}>
        Lose a life (demo)
      </button>
    </main>
  )
}

function PlayerLives({ label, lives, max }: { label: string; lives: number; max: number }) {
  return (
    <div className="lives">
      <span className="name">{label}</span>
      <span className="hearts" aria-label={`${lives} of ${max} lives`}>
        {'♥'.repeat(lives)}
        <span className="lost">{'♥'.repeat(Math.max(0, max - lives))}</span>
      </span>
    </div>
  )
}

export function WinScreen({ code, lobby, onMenu }: Props & { onMenu: () => void }) {
  const winner = lobby.winnerId ? lobby.players[lobby.winnerId] : undefined
  const youWon = lobby.winnerId === playerId

  return (
    <main className="screen">
      <p className="status">{youWon ? 'You won!' : 'You lost.'}</p>
      <h1 className="title">{winner?.name ?? 'Nobody'} wins</h1>
      <div className="buttons column">
        <button className="big" onClick={() => backToLobby(code)}>
          Back to lobby
        </button>
        <button onClick={onMenu}>Back to menu</button>
      </div>
    </main>
  )
}
