// Device feedback for the capability demo: audio, vibration, torch, wake lock
import shotUrl from '../assets/revolver-shot.mp3'
import hitUrl from '../assets/hit.mp3'
import cockUrl from '../assets/cock.mp3'

let audio: AudioContext | null = null
// Decoded once on the first tap, so each sound starts without delay
const SAMPLE_URLS = { shot: shotUrl, hit: hitUrl, cock: cockUrl }
type Sample = { buffer: AudioBuffer; start: number; duration: number } // seconds, silence trimmed
const samples: Partial<Record<keyof typeof SAMPLE_URLS, Sample>> = {}

// Finds where the sound actually starts and ends, so silence padding in a file (cock.mp3 has
// 0.7 s before the click) doesn't delay playback
function trimSilence(buffer: AudioBuffer, threshold = 0.02): Sample {
  const data = buffer.getChannelData(0)
  let first = data.findIndex((v) => Math.abs(v) > threshold)
  if (first < 0) first = 0
  let last = data.length - 1
  while (last > first && Math.abs(data[last]) <= threshold) last--
  const rate = buffer.sampleRate
  const start = Math.max(0, first / rate - 0.01) // keep 10 ms so the attack isn't clipped
  const end = Math.min(buffer.duration, last / rate + 0.1) // and a short natural tail
  return { buffer, start, duration: end - start }
}
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

// Call from a tap: audio and vibration need a user gesture first. Only the first call does anything.
export async function unlockDevice() {
  if (audio) return
  audio = new AudioContext() // created synchronously inside the gesture
  void audio.resume()
  void loadSamples(audio)
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

function loadSamples(ctx: AudioContext) {
  return Promise.all(
    Object.entries(SAMPLE_URLS).map(async ([name, url]) => {
      try {
        const buffer = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
        samples[name as keyof typeof SAMPLE_URLS] = trimSilence(buffer)
      } catch {
        // keeps the synthesized fallback for that sound
      }
    }),
  )
}

// Returns false while the sample isn't loaded yet, so the caller can synthesize instead
function playSample(name: keyof typeof SAMPLE_URLS) {
  const sample = samples[name]
  if (!audio || !sample) return false
  const src = audio.createBufferSource()
  src.buffer = sample.buffer
  src.connect(audio.destination)
  src.start(0, sample.start, sample.duration)
  return true
}

// Hammer being cocked when the circle is full (src/assets/cock.mp3, freesound community); silent until loaded
export function playCock() {
  playSample('cock')
}

// Revolver sample (src/assets/revolver-shot.mp3); synthesized bang until it has loaded
export function playShot() {
  if (!audio || playSample('shot')) return
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

// Countdown tick (3, 2, 1) and a higher, longer tone for "Draw!"
export function playBeep(final: boolean) {
  if (!audio) return
  const t = audio.currentTime
  const len = final ? 0.5 : 0.15
  const osc = audio.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(final ? 1320 : 660, t)
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.5, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + len)
  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  osc.stop(t + len)
}

// Played on the phone of the player who was hit (src/assets/hit.mp3); synthesized until loaded
export function playHit() {
  if (!audio || playSample('hit')) return
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
