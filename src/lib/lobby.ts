// Lobby and match state in Firebase: lobbies/{code}, synced live to both phones
import { onValue, ref, remove, runTransaction, set, update } from 'firebase/database'
import { db } from './firebase'
import type { Settings } from '../settings'

export type Player = { name: string; lives: number; joinedAt: number }

export type Lobby = {
  hostId: string
  createdAt: number
  settings: Settings
  players: Record<string, Player>
  status: 'lobby' | 'playing' | 'over'
  startAt?: number // server time when the countdown ends and the match begins
  winnerId?: string
}

export const COUNTDOWN_MS = 3000
const MAX_PLAYERS = 2

// Per tab (sessionStorage): a reload rejoins the same lobby, and two tabs on one PC count as
// two players for local testing. ponytail: a closed and reopened app gets a new id, so it can't
// rejoin a full lobby; switch to localStorage if that matters on the phones.
export const playerId = (() => {
  try {
    const id = sessionStorage.getItem('player-id') ?? crypto.randomUUID()
    sessionStorage.setItem('player-id', id)
    return id
  } catch {
    return crypto.randomUUID()
  }
})()

// Both phones count the countdown against Firebase's clock, not their own
let serverOffset = 0
if (db) onValue(ref(db, '.info/serverTimeOffset'), (s) => (serverOffset = s.val() ?? 0))
export const serverNow = () => Date.now() + serverOffset

const lobbyRef = (code: string, ...path: string[]) => ref(db!, ['lobbies', code, ...path].join('/'))

const WESTERN_NAMES = [
  'Calamity Kate', 'Six-Gun Sam', 'Rattlesnake Rita', 'Dead-Eye Dan', 'Whiskey Joe',
  'Tumbleweed Tom', 'Prairie Pete', 'Lonesome Lou', 'Sundown Sal', 'Copper Jack',
  'Mesa Mae', 'Cactus Cole', 'Dynamite Dot', 'Buckshot Bill', 'Sagebrush Sue',
  'Coyote Carl', 'Rawhide Ruby', 'Gunsmoke Gus', 'Dusty Dolores', 'Spurs McGraw',
]

export function pickName(taken: string[]) {
  const free = WESTERN_NAMES.filter((n) => !taken.includes(n))
  return free[Math.floor(Math.random() * free.length)]
}

// No 0/O or 1/I, so the written code can't be misread
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')

export const joinUrl = (code: string) => `${location.origin}/?lobby=${code}`

const newPlayer = (name: string, lives: number): Player => ({ name, lives, joinedAt: serverNow() })

export async function createLobby(settings: Settings) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const lobby: Lobby = {
      hostId: playerId,
      createdAt: serverNow(),
      settings,
      players: { [playerId]: newPlayer(pickName([]), settings.lives) },
      status: 'lobby',
    }
    // Only claims the code if nobody uses it yet
    const res = await runTransaction(lobbyRef(code), (cur) => (cur === null ? lobby : undefined))
    if (res.committed) return code
  }
  throw new Error('No free lobby code found')
}

export async function joinLobby(code: string): Promise<'ok' | 'not-found' | 'full'> {
  // Firebase may first call this with null before it has the real value; returning
  // null then is a no-op, and it reruns with the server's data
  const res = await runTransaction(lobbyRef(code), (cur: Lobby | null) => {
    if (cur === null || cur.players?.[playerId]) return cur // missing, or already in (rejoin)
    const players = cur.players ?? {}
    if (cur.status !== 'lobby' || Object.keys(players).length >= MAX_PLAYERS) return undefined
    const taken = Object.values(players).map((p) => p.name)
    return { ...cur, players: { ...players, [playerId]: newPlayer(pickName(taken), cur.settings.lives) } }
  })
  if (!res.committed) return 'full'
  return res.snapshot.exists() ? 'ok' : 'not-found'
}

export function watchLobby(code: string, cb: (lobby: Lobby | null) => void) {
  return onValue(lobbyRef(code), (s) => cb(s.val()))
}

export const setName = (code: string, name: string) => set(lobbyRef(code, 'players', playerId, 'name'), name)

export const setLobbySettings = (code: string, settings: Settings) => set(lobbyRef(code, 'settings'), settings)

export function startMatch(code: string, lobby: Lobby) {
  const lives = Object.fromEntries(Object.keys(lobby.players).map((id) => [`players/${id}/lives`, lobby.settings.lives]))
  return update(lobbyRef(code), { ...lives, status: 'playing', startAt: serverNow() + COUNTDOWN_MS, winnerId: null })
}

// The shooter's phone rolls the hit and calls this. Transaction, so two shots at the same
// moment can't both read the old lives, and a shot after the match ended does nothing.
export function hitPlayer(code: string, targetId: string) {
  return runTransaction(lobbyRef(code), (cur: Lobby | null) => {
    const target = cur?.players?.[targetId]
    if (!cur || cur.status !== 'playing' || !target || target.lives <= 0) return cur
    target.lives--
    if (target.lives === 0) {
      cur.status = 'over'
      cur.winnerId = Object.keys(cur.players).find((id) => id !== targetId)
    }
    return cur
  })
}

export const backToLobby = (code: string) => update(lobbyRef(code), { status: 'lobby', startAt: null, winnerId: null })

// The host leaving closes the lobby for both; a guest leaving frees the spot
export const leaveLobby = (code: string, isHost: boolean) =>
  remove(isHost ? lobbyRef(code) : lobbyRef(code, 'players', playerId))
