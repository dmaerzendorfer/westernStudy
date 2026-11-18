import { Fragment, useRef, useState, type PointerEvent } from 'react'
import { isFirebaseConfigured } from './lib/firebase'
import { canVibrate, flash, playHit, playShot, rumble, unlockDevice, vibrate } from './lib/device'
import { DEFAULT_SETTINGS, SETTING_DEFS, loadSettings, saveSettings, type Settings } from './settings'

const R = 45
const CIRCUMFERENCE = 2 * Math.PI * R

// rampMs: time from full to 100% hit chance, random per hold
type Hold = { start: number; fillMs: number; rampMs: number; full: boolean; raf: number }

// Step 1 capability demo: hold anywhere to fill, short rumble when full, shot sound + torch flash
export default function App() {
  const [device, setDevice] = useState<{ torch: boolean; wakeLock: boolean } | null>(null)
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [progress, setProgress] = useState(0)
  const [chance, setChance] = useState(0)
  const [showIndicator, setShowIndicator] = useState(true)
  const [log, setLog] = useState<string[]>([])
  const hold = useRef<Hold | null>(null)

  const addLog = (line: string) => setLog((l) => [line, ...l].slice(0, 6))
  // Linear from the base chance (at full) to 100% after rampMs more holding
  const chanceAt = (heldMs: number, h: Hold) => {
    const base = settings.baseChance / 100
    return base + (1 - base) * Math.min(1, (heldMs - h.fillMs) / h.rampMs)
  }

  function updateSettings(next: Settings) {
    setSettings(next)
    saveSettings(next)
  }

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
    const held = performance.now() - h.start
    setProgress(h.fillMs ? Math.min(1, held / h.fillMs) : 1) // 0 ms fill = full on touch
    if (held >= h.fillMs) {
      setChance(chanceAt(held, h))
      if (!h.full) {
        h.full = true
        if (settings.rumbleOn) testRumble('full')
      }
    }
    h.raf = requestAnimationFrame(tick)
  }

  function onDown(e: PointerEvent<HTMLElement>) {
    if (hold.current || (e.target as Element).closest('button, .settings')) return
    e.currentTarget.setPointerCapture(e.pointerId) // keep the hold if the finger slides
    const { fillMs, rampMinMs: min, rampMaxMs: max } = settings
    hold.current = { start: performance.now(), fillMs, rampMs: min + Math.random() * (max - min), full: false, raf: 0 }
    tick()
  }

  function onUp() {
    const h = hold.current
    if (!h) return
    hold.current = null
    cancelAnimationFrame(h.raf)
    const held = performance.now() - h.start
    if (h.full) {
      const c = chanceAt(held, h)
      const hit = Math.random() < c
      if (settings.soundOn) playShot()
      if (settings.flashOn) flash(settings.flashMs)
      addLog(`Shot ${held.toFixed(0)} ms (to 100% in ${h.rampMs.toFixed(0)}) ${(c * 100).toFixed(0)}% -> ${hit ? 'HIT' : 'miss'}`)
    } else {
      addLog(`Interrupted at ${held.toFixed(0)} ms (fill ${h.fillMs})`)
    }
    setProgress(0)
    setChance(0)
  }

  // ponytail: debug log of every vibrate call, drop once rumble is confirmed on the phones
  function testRumble(source: string) {
    const { rumbleMs, pulses, gapMs, requestMs } = settings
    const ok = rumble(rumbleMs, pulses, gapMs, requestMs)
    addLog(`Rumble (${source}) ${ok ? 'sent' : 'REFUSED'} ${pulses}x ${rumbleMs} ms, gap ${gapMs} ms, request ${requestMs} ms`)
  }

  function testHit() {
    if (settings.soundOn) playHit()
    addLog('Got hit (test)')
  }

  const full = progress >= 1

  return (
    <main className="screen" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()}>
      <p className="status">
        Vibration {canVibrate ? 'yes' : 'no'} · Torch {device.torch ? 'yes' : 'no'} · Wake lock{' '}
        {device.wakeLock ? 'yes' : 'no'} · Firebase {isFirebaseConfigured ? 'yes' : 'no'} · v{__APP_VERSION__}
      </p>

      <svg className="circle" viewBox="0 0 100 100">
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
        <button onClick={() => setShowIndicator((s) => !s)}>Indicator: {showIndicator ? 'shown' : 'hidden'}</button>
        <button onClick={() => setShowSettings(true)}>Settings</button>
      </div>

      <ol className="log">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>

      {showSettings && (
        <div className="settings">
          <h2>Settings</h2>
          {SETTING_DEFS.map((d, i) => (
            <Fragment key={d.key}>
              {d.group !== SETTING_DEFS[i - 1]?.group && <h3>{d.group}</h3>}
              {'toggle' in d ? (
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings[d.key] === 1}
                    onChange={(e) => updateSettings({ ...settings, [d.key]: e.target.checked ? 1 : 0 })}
                  />
                  {d.label}
                </label>
              ) : (
                <label>
                  <span>
                    {d.label}: {settings[d.key]} {d.unit}
                  </span>
                  <input
                    type="range"
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    value={settings[d.key]}
                    onChange={(e) => updateSettings({ ...settings, [d.key]: Number(e.target.value) })}
                  />
                </label>
              )}
            </Fragment>
          ))}
          <div className="buttons">
            <button onClick={() => testRumble('button')}>Test rumble</button>
            {/* ponytail: diagnostic, same long call as the version that worked; drop once rumble is fixed */}
            <button onClick={() => addLog(`Rumble 2 s ${vibrate(2000) ? 'sent' : 'REFUSED'}`)}>Test 2 s</button>
            <button onClick={() => updateSettings(DEFAULT_SETTINGS)}>Reset</button>
            <button onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
  )
}
