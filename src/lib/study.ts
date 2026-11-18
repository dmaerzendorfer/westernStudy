// Match logging: one raw record per shot in events/{pushId}, written by the shooter's phone.
// Only while a logged match runs (lobby.matchId). Players are identified by their lobby name.
// events/ is write-only for clients (database.rules.json); export it from the Firebase console.
import { push, ref, serverTimestamp } from 'firebase/database'
import { db } from './firebase'
import { playerId, type Lobby } from './lobby'

type Shot = {
  holdMs: number // press to release
  rampMs: number // time from full circle to 100%, drawn for this shot
  hitChance: number // 0-1 at release
  hit: boolean
}

function log(lobby: Lobby, event: Record<string, unknown>) {
  if (!db || !lobby.matchId) return
  void push(ref(db, 'events'), {
    ...event,
    matchId: lobby.matchId,
    matchNumber: lobby.matchNumber ?? null,
    showIndicator: lobby.settings.showIndicator === 1,
    player: lobby.players[playerId]?.name ?? null,
    fillMs: lobby.settings.fillMs,
    clientTime: Date.now(),
    serverTime: serverTimestamp(),
  })
}

// Remaining lives after this shot, for both players (health over time)
export function logShot(lobby: Lobby, shot: Shot) {
  const opponentId = Object.keys(lobby.players).find((id) => id !== playerId)
  const opponentLives = opponentId ? lobby.players[opponentId].lives : null
  log(lobby, {
    type: 'shot',
    ...shot,
    livesSelf: lobby.players[playerId]?.lives ?? null,
    livesOpponent: opponentLives === null ? null : Math.max(0, opponentLives - (shot.hit ? 1 : 0)),
    opponent: opponentId ? lobby.players[opponentId].name : null,
  })
}

// A press released before the circle was full (no shot)
export function logInterrupted(lobby: Lobby, holdMs: number) {
  log(lobby, { type: 'interrupted', holdMs })
}
