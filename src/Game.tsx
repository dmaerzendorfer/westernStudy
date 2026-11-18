import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { flash, playBeep, playCock, playHit, playShot, rumble } from './lib/device'
import { backToLobby, hitPlayer, playerId, serverNow, type Lobby } from './lib/lobby'
import { drawRampMs, type Settings } from './settings'
import { logInterrupted, logShot } from './lib/study'
import revolverUrl from './assets/revolver.webp'

type Props = { code: string; lobby: Lobby }

const R = 45
const CIRCUMFERENCE = 2 * Math.PI * R

// HIT!/Miss text that pops out from behind the gun and drifts away; x/y in % of the screen
type Particle = { id: number; hit: boolean; x: number; y: number; dx: number; rot: number }
const PARTICLE_MS = 1400

// rampMs: time from full to 100% hit chance, drawn at random for every hold (= every shot)
type Hold = { start: number; rampMs: number; full: boolean; raf: number }

// Hit chance: base when the circle is full, then linear to 100% after rampMs more holding
function chanceAt(s: Settings, heldMs: number, rampMs: number) {
  const base = s.baseChance / 100
  return base + (1 - base) * Math.min(1, Math.max(0, (heldMs - s.fillMs) / rampMs))
}

// Red screen flash, hit sound and rumble, only on the phone of the player who was hit. Rendered
// by App above every screen, so the final hit still lands while the win screen comes in.
export function HitFeedback({ lobby }: { lobby: Lobby | null }) {
  const lives = lobby?.players?.[playerId]?.lives ?? 0
  const prev = useRef(lives)
  const [flashes, setFlashes] = useState(0)
  useEffect(() => {
    const s = lobby?.settings
    if (s && lives < prev.current) {
      setFlashes((n) => n + 1)
      if (s.soundOn) playHit()
      if (s.rumbleOn) rumble(s.rumbleMs, s.pulses, s.gapMs, s.requestMs)
    }
    prev.current = lives
  }, [lives])
  return flashes > 0 ? <div key={flashes} className="hit-flash" /> : null
}

// Countdown, then the duel: hold anywhere to fill, cocking sound when full, release to shoot
export function GameScreen({ code, lobby }: Props) {
  const s = lobby.settings
  const [now, setNow] = useState(serverNow)
  const [progress, setProgress] = useState(0)
  const [chance, setChance] = useState(0)
  const [shots, setShots] = useState(0) // bumps the revolver's key to replay the recoil animation
  const [particles, setParticles] = useState<Particle[]>([])
  const hold = useRef<Hold | null>(null)

  const startAt = lobby.startAt ?? 0
  const counting = now < startAt
  const secondsLeft = counting ? Math.ceil((startAt - now) / 1000) : 0
  const opponentId = Object.keys(lobby.players).find((id) => id !== playerId)

  useEffect(() => {
    if (!counting) return
    const id = setInterval(() => setNow(serverNow()), 100)
    return () => clearInterval(id)
  }, [counting])

  // Beep on each new number, final tone when the match begins
  useEffect(() => {
    if (s.soundOn) playBeep(secondsLeft === 0)
  }, [secondsLeft])

  // Match can end mid-hold (screen unmounts): stop the animation loop
  useEffect(() => () => cancelAnimationFrame(hold.current?.raf ?? 0), [])

  function tick() {
    const h = hold.current
    if (!h) return
    const held = performance.now() - h.start
    setProgress(s.fillMs ? Math.min(1, held / s.fillMs) : 1)
    if (held >= s.fillMs) {
      setChance(chanceAt(s, held, h.rampMs))
      if (!h.full) {
        h.full = true
        if (s.soundOn) playCock()
      }
    }
    h.raf = requestAnimationFrame(tick)
  }

  function onDown(e: PointerEvent<HTMLElement>) {
    if (counting || hold.current) return
    e.currentTarget.setPointerCapture(e.pointerId) // keep the hold if the finger slides
    hold.current = { start: performance.now(), rampMs: drawRampMs(s), full: false, raf: 0 }
    tick()
  }

  // Release when full = shot. Released early = no shot, only logged as interrupted.
  function onUp() {
    const h = hold.current
    if (!h) return
    hold.current = null
    cancelAnimationFrame(h.raf)
    setProgress(0)
    setChance(0)
    const holdMs = performance.now() - h.start
    if (!h.full) return logInterrupted(lobby, holdMs)

    const hitChance = chanceAt(s, holdMs, h.rampMs)
    const hit = Math.random() < hitChance
    logShot(lobby, { holdMs, rampMs: h.rampMs, hitChance, hit })
    if (s.soundOn) playShot()
    if (s.flashOn) flash(s.flashMs)
    setShots((n) => n + 1)
    // Spawns behind the trigger area and drifts left into the empty space under the barrel
    // (the top is too short in landscape, and the left belongs to the hit chance)
    const p = { id: performance.now(), hit, x: 52 + Math.random() * 14, y: 55 + Math.random() * 15, dx: -10 - Math.random() * 15, rot: (Math.random() - 0.5) * 30 }
    setParticles((ps) => [...ps, p])
    setTimeout(() => setParticles((ps) => ps.filter((q) => q !== p)), PARTICLE_MS)
    if (hit && opponentId) void hitPlayer(code, opponentId)
  }

  if (counting) {
    return (
      <main className="screen">
        <p className="status">Get ready</p>
        <p className="countdown">{secondsLeft}</p>
      </main>
    )
  }

  const me = lobby.players[playerId]
  const other = opponentId ? lobby.players[opponentId] : undefined // names show in lobby and win screen
  const full = progress >= 1

  // Landscape layout from the mockup: barrel points left (at the opponent), hit chance big on
  // the left, hold ring over the cylinder
  return (
    <main className="screen game" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()}>
      <PlayerLives className="enemy" label="enemy" lives={other?.lives ?? 0} max={s.lives} />
      <PlayerLives className="you" label="you" lives={me.lives} max={s.lives} />

      <div className="readout">
        {full && s.showIndicator === 1 && <p className="chance">{Math.round(chance * 100)}%</p>}
      </div>

      {particles.map((p) => (
        <span
          key={p.id}
          className={p.hit ? 'particle hit' : 'particle'}
          style={{ left: `${p.x}%`, top: `${p.y}%`, '--dx': `${p.dx}vw`, '--rot': `${p.rot}deg` } as CSSProperties}
        >
          {p.hit ? 'HIT!' : 'miss'}
        </span>
      ))}

      {/* key bumps on every shot so the recoil animation replays */}
      <div key={shots} className={shots > 0 ? 'gun fire' : 'gun'}>
        <Revolver />
        <svg className="circle" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={R} className="bg" />
          <circle cx="50" cy="50" r={R} className="track" />
          <circle
            cx="50"
            cy="50"
            r={R}
            className={full ? 'fill full' : 'fill'}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="50" className="label">
            {full ? 'fire' : 'hold'}
          </text>
        </svg>
      </div>
    </main>
  )
}

// Photo cut-out, barrel already pointing left; the muzzle flash sits at the barrel tip
function Revolver() {
  return (
    <>
      <img className="revolver" src={revolverUrl} alt="" draggable={false} />
      <svg className="muzzle" viewBox="0 0 50 30" aria-hidden="true">
        <polygon points="50,15 22,0 28,11 0,15 28,19 22,30" fill="#ffd34d" />
      </svg>
    </>
  )
}

function PlayerLives({ className, label, lives, max }: { className: string; label: string; lives: number; max: number }) {
  return (
    <div className={`lives ${className}`}>
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
