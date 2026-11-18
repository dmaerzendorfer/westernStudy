// Tuning values for the capability demo, editable on the settings panel and kept per phone

export const SETTING_DEFS = [
  // Rumble when the circle is full (10% reached); motors need ~50 ms to be felt at all
  { key: 'rumbleMs', label: 'Rumble length per pulse', unit: 'ms', min: 50, max: 500, step: 10, def: 150 },
  { key: 'pulses', label: 'Rumble pulses', unit: '', min: 1, max: 3, step: 1, def: 1 },
  { key: 'gapMs', label: 'Gap between pulses', unit: 'ms', min: 20, max: 300, step: 10, def: 80 },
  { key: 'flashMs', label: 'Torch flash on shot', unit: 'ms', min: 0, max: 500, step: 10, def: 120 },
  { key: 'fillMinMs', label: 'Fill time min', unit: 'ms', min: 300, max: 4000, step: 100, def: 1200 },
  { key: 'fillMaxMs', label: 'Fill time max', unit: 'ms', min: 300, max: 4000, step: 100, def: 1800 },
  { key: 'baseChance', label: 'Hit chance when full', unit: '%', min: 0, max: 100, step: 5, def: 10 },
  { key: 'chancePerSec', label: 'Hit chance per extra second', unit: '%', min: 0, max: 100, step: 5, def: 30 },
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
