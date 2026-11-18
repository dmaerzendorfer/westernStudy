// Tuning values for the capability demo, editable on the settings panel and kept per phone

// `group` is the heading the slider appears under on the settings panel
export const SETTING_DEFS = [
  // Rumble when the circle is full. Nothing OS (Phone 2a) ignores the cancel, so each pulse
  // lasts the full request length; pulse length = request length keeps the gaps real.
  { group: 'Rumble', key: 'rumbleMs', label: 'Length per pulse', unit: 'ms', min: 50, max: 2000, step: 1, def: 1001 },
  { group: 'Rumble', key: 'pulses', label: 'Pulses', unit: '', min: 1, max: 3, step: 1, def: 3 },
  { group: 'Rumble', key: 'gapMs', label: 'Gap between pulses', unit: 'ms', min: 20, max: 500, step: 10, def: 200 },
  // Calibration: Nothing OS drops vibration requests of 1000 ms or less; lowest value that still rumbles is best
  { group: 'Rumble', key: 'requestMs', label: 'Vibration request length', unit: 'ms', min: 1000, max: 2000, step: 1, def: 1001 },
  { group: 'Flash', key: 'flashMs', label: 'Torch flash on shot', unit: 'ms', min: 0, max: 500, step: 10, def: 120 },
  { group: 'Fill time', key: 'fillMs', label: 'Time to fill the circle', unit: 'ms', min: 300, max: 4000, step: 100, def: 1500 },
  { group: 'Hit chance', key: 'baseChance', label: 'Hit chance when full', unit: '%', min: 0, max: 100, step: 5, def: 10 },
  // Time from full to 100%, drawn at random between min and max on every hold
  { group: 'Hit chance', key: 'rampMinMs', label: 'Time to 100%, min', unit: 'ms', min: 500, max: 10000, step: 100, def: 3000 },
  { group: 'Hit chance', key: 'rampMaxMs', label: 'Time to 100%, max', unit: 'ms', min: 500, max: 10000, step: 100, def: 5000 },
] as const

export type Settings = Record<(typeof SETTING_DEFS)[number]['key'], number>

export const DEFAULT_SETTINGS = Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.def])) as Settings

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
