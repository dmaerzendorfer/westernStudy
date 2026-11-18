// Match settings. The host edits them in the lobby; they are stored in the lobby for both phones
// and kept on the host's phone as defaults for the next lobby.

// `group` is the heading the slider appears under on the settings panel.
// `toggle` entries are on/off checkboxes stored as 1/0.
export const SETTING_DEFS = [
  { group: 'Match', key: 'lives', label: 'Lives per player', unit: '', min: 1, max: 10, step: 1, def: 3 },
  // Rumble on the phone of the player who was hit. Nothing OS (Phone 2a) ignores the cancel, so
  // each pulse lasts at least the request length.
  { group: 'Rumble', key: 'rumbleOn', label: 'Rumble when hit', toggle: true, def: 1 },
  { group: 'Rumble', key: 'rumbleMs', label: 'Length per pulse', unit: 'ms', min: 50, max: 2000, step: 1, def: 300 },
  { group: 'Rumble', key: 'pulses', label: 'Pulses', unit: '', min: 0, max: 10, step: 1, def: 3 },
  { group: 'Rumble', key: 'gapMs', label: 'Gap between pulses', unit: 'ms', min: 20, max: 500, step: 10, def: 200 },
  // Calibration: Nothing OS drops vibration requests of 1000 ms or less; lowest value that still rumbles is best
  { group: 'Rumble', key: 'requestMs', label: 'Vibration request length', unit: 'ms', min: 1000, max: 2000, step: 1, def: 1001 },
  { group: 'Flash', key: 'flashOn', label: 'Torch flash on shot', toggle: true, def: 1 },
  { group: 'Flash', key: 'flashMs', label: 'Flash length', unit: 'ms', min: 0, max: 500, step: 10, def: 120 },
  { group: 'Sound', key: 'soundOn', label: 'Shot and hit sounds', toggle: true, def: 1 },
  { group: 'Fill time', key: 'fillMs', label: 'Time to fill the circle', unit: 'ms', min: 0, max: 4000, step: 100, def: 1500 },
  { group: 'Hit chance', key: 'showIndicator', label: 'Show hit chance indicator', toggle: true, def: 1 },
  { group: 'Hit chance', key: 'baseChance', label: 'Hit chance when full', unit: '%', min: 0, max: 100, step: 5, def: 10 },
  // Time from full to 100%, drawn anew for every shot from a normal distribution
  { group: 'Hit chance', key: 'rampMeanMs', label: 'Time to 100%, mean', unit: 'ms', min: 500, max: 10000, step: 100, def: 5000 },
  { group: 'Hit chance', key: 'rampSdMs', label: 'Time to 100%, SD', unit: 'ms', min: 0, max: 5000, step: 100, def: 2000 },
  // Match logging to Firebase, off by default (e.g. for practice rounds)
  { group: 'Logging', key: 'logMatches', label: 'Log matches', toggle: true, def: 0 },
] as const

export type Settings = Record<(typeof SETTING_DEFS)[number]['key'], number>

export const DEFAULT_SETTINGS = Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.def])) as Settings

// ponytail: normal distribution cut off at 500 ms, so no draw is near-instant or negative.
// With mean 5 s / SD 2 s that affects ~1.2% of draws; log shows the value actually used.
const MIN_RAMP_MS = 500
export function drawRampMs(s: Settings) {
  const u = 1 - Math.random() // (0, 1], so log() never sees 0
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()) // Box-Muller
  return Math.max(MIN_RAMP_MS, s.rampMeanMs + z * s.rampSdMs)
}

const STORAGE_KEY = 'demo-settings'

export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // storage blocked, settings just reset on next start
  }
}
