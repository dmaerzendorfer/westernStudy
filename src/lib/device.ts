// Device feedback for the capability demo: audio, vibration, torch, wake lock

let audio: AudioContext | null = null
let torchTrack: MediaStreamTrack | null = null

export const canVibrate = 'vibrate' in navigator

// Returns false when the browser refused the call (no user activation, pattern rejected)
export function vibrate(pattern: number | number[]) {
  if (canVibrate) return navigator.vibrate(pattern)
  console.debug('[vibrate]', pattern) // desktop has no vibration, log instead
  return false
}

// Nothing OS (Phone 2a) silently drops short vibrations (<= 500 ms) but plays a 2 s one,
// so each pulse requests a long vibration (`requestMs`) and cancels it after `ms`.
function pulse(ms: number, requestMs: number) {
  const ok = vibrate(requestMs)
  setTimeout(() => vibrate(0), ms)
  return ok
}

// Short rumble: `pulses` buzzes of `ms` each, `gapMs` apart.
// ponytail: timer-based, can jitter a few ms; the Vibration API has no intensity control
export function rumble(ms: number, pulses: number, gapMs: number, requestMs: number) {
  if (pulses < 1) return true // nothing to send
  for (let i = 1; i < pulses; i++) setTimeout(() => pulse(ms, requestMs), i * (ms + gapMs))
  return pulse(ms, requestMs)
}

// Call from a tap: audio and vibration need a user gesture first
export async function unlockDevice() {
  audio = new AudioContext() // created synchronously inside the gesture
  void audio.resume()
  const [torch, wakeLock] = await Promise.all([initTorch(), keepAwake()])

  // Wake lock is dropped and the camera may stop when the app goes to the background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    void keepAwake()
    if (torchTrack?.readyState === 'ended') void initTorch()
  })

  return { torch, wakeLock }
}

async function keepAwake() {
  try {
    await navigator.wakeLock.request('screen')
    return true
  } catch {
    return false
  }
}

// The torch is only reachable through an open back-camera stream, so keep it open
async function initTorch() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    const track = stream.getVideoTracks()[0]
    if (!(track.getCapabilities() as { torch?: boolean }).torch) {
      track.stop()
      return false
    }
    torchTrack = track
    return true
  } catch {
    return false
  }
}

function setTorch(on: boolean) {
  return torchTrack
    ?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
    .catch(() => {})
}

export function flash(ms: number) {
  if (ms <= 0) return
  void setTorch(true)
  setTimeout(() => void setTorch(false), ms)
}

// ponytail: synthesized sounds, swap for real .mp3 files in public/ during polish
export function playShot() {
  if (!audio) return
  const t = audio.currentTime
  const noise = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  const src = audio.createBufferSource()
  src.buffer = noise
  const filter = audio.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(4000, t)
  filter.frequency.exponentialRampToValueAtTime(200, t + 0.4)
  const gain = audio.createGain()
  gain.gain.setValueAtTime(1, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
  src.connect(filter).connect(gain).connect(audio.destination)
  src.start(t)
}

export function playHit() {
  if (!audio) return
  const t = audio.currentTime
  const osc = audio.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(330, t)
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.35)
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.4, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  osc.stop(t + 0.4)
}
