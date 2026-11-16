import { useRef, useState, type PointerEvent } from 'react'
import { isFirebaseConfigured } from './lib/firebase'
import { canVibrate, flash, playHit, playShot, unlockDevice, vibrate } from './lib/device'

// ponytail: demo tuning values, the real curve gets decided in Step 3
const FILL_MS_MIN = 1200
const FILL_MS_MAX = 1800
const BASE_CHANCE = 0.1 // hit chance the moment the circle is full
const CHANCE_PER_SEC = 0.3 // added per second held after full

const R = 45
const CIRCUMFERENCE = 2 * Math.PI * R

const randomFillMs = () => FILL_MS_MIN + Math.random() * (FILL_MS_MAX - FILL_MS_MIN)
const chanceAt = (heldMs: number, fillMs: number) =>
  Math.min(1, BASE_CHANCE + ((heldMs - fillMs) / 1000) * CHANCE_PER_SEC)

type Hold = { start: number; fillMs: number; vibeAt: number; raf: number }

// Step 1 capability demo: hold-to-fill, rumble, shot sound + torch flash, hit feedback
export default function App() {
  const [device, setDevice] = useState<{ torch: boolean; wakeLock: boolean } | null>(null)
  const [progress, setProgress] = useState(0)
  const [chance, setChance] = useState(0)
  const [showIndicator, setShowIndicator] = useState(true)
  const [log, setLog] = useState<string[]>([])
  const hold = useRef<Hold | null>(null)

  const addLog = (line: string) => setLog((l) => [line, ...l].slice(0, 6))

  if (!device) {
    return (
      <main className="screen" onClick={async () => setDevice(await unlockDevice())}>
        <h1>Western Duel</h1>
        <p>Tap to start</p>
        <p className="status">Allow camera access for the flashlight</p>
      </main>
    )
  }

  function tick() {
    const h = hold.current
    if (!h) return
    const now = performance.now()
    const held = now - h.start
    setProgress(Math.min(1, held / h.fillMs))
    if (held >= h.fillMs) {
      setChance(chanceAt(held, h.fillMs))
      // Continuous rumble while full; Chrome caps one call at 10 s, so re-issue
      if (now - h.vibeAt > 9000) {
        h.vibeAt = now
        vibrate(10_000)
      }
    }
    h.raf = requestAnimationFrame(tick)
  }

  function onDown(e: PointerEvent) {
    if (hold.current) return
    e.currentTarget.setPointerCapture(e.pointerId) // keep the hold if the finger slides off
    hold.current = { start: performance.now(), fillMs: randomFillMs(), vibeAt: -Infinity, raf: 0 }
    tick()
  }

  function onUp() {
    const h = hold.current
    if (!h) return
    hold.current = null
    cancelAnimationFrame(h.raf)
    vibrate(0)
    const held = performance.now() - h.start
    if (held >= h.fillMs) {
      const c = chanceAt(held, h.fillMs)
      const hit = Math.random() < c
      playShot()
      flash()
      addLog(`Shot ${held.toFixed(0)} ms (fill ${h.fillMs.toFixed(0)}) ${(c * 100).toFixed(0)}% -> ${hit ? 'HIT' : 'miss'}`)
    } else {
      addLog(`Interrupted at ${held.toFixed(0)} ms (fill ${h.fillMs.toFixed(0)})`)
    }
    setProgress(0)
    setChance(0)
  }

  function testHit() {
    vibrate([60, 40, 60, 40, 250])
    playHit()
    addLog('Got hit (test)')
  }

  const full = progress >= 1

  return (
    <main className="screen">
      <p className="status">
        Vibration {canVibrate ? 'yes' : 'no'} · Torch {device.torch ? 'yes' : 'no'} · Wake lock{' '}
        {device.wakeLock ? 'yes' : 'no'} · Firebase {isFirebaseConfigured ? 'yes' : 'no'} · v{__APP_VERSION__}
      </p>

      <svg
        className="circle"
        viewBox="0 0 100 100"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
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
          {full ? (showIndicator ? `${Math.round(chance * 100)}%` : 'FIRE') : 'HOLD'}
        </text>
      </svg>

      <div className="buttons">
        <button onClick={testHit}>Test hit</button>
        <button onClick={() => setShowIndicator((s) => !s)}>
          Indicator: {showIndicator ? 'shown' : 'hidden'}
        </button>
      </div>

      <ol className="log">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </main>
  )
}
