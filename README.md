# Western Study – Prototype

Prototype for a uni study on the effect of a hit chance indicator on player
behaviour in an embodied two-player versus game.

## The game

- Western-styled duel for two players, each on their own phone.
- Each player has three lives and holds the phone like a pistol.
- Pressing the screen fills a circle. Once it is full the phone rumbles and
  the player can shoot at a 10% hit chance. Holding longer raises the hit chance.
- The time needed to reach 100% varies slightly between rounds.
- Players can hold and shoot as long and as often as they like.
- Rumble and sound tell both players when a hit lands. Last one standing wins.

Study conditions: the hit chance indicator is either **shown** or **hidden**.

## Tech stack

| Part             | Choice                                | Why                                                            |
| ---------------- | ------------------------------------- | -------------------------------------------------------------- |
| Client           | Vite + React + TypeScript             | Purely client-side app, fast iteration, no server code         |
| Delivery         | PWA (installable web app, fullscreen) | No browser UI, no APK builds, updates on redeploy              |
| Hosting          | Vercel (from the GitHub repo)         | Static hosting with HTTPS, needed for installing and wake lock |
| Backend stand-in | Firebase Realtime Database            | Session sync between the two phones, no dedicated server       |
| Study data       | Same Firebase database                | One record per event, exported as JSON                         |
| Devices          | Android phones (Chrome)               | iOS does not support the web Vibration API                     |

Fallback: if the PWA's vibration is not good enough, wrap the same web app
with Capacitor to get native haptics. The web code carries over unchanged.

## Hosting and installing

- The repo is imported in Vercel, which detects Vite and redeploys on every push.
- Every branch push gets its own preview URL, useful for testing on the phones.
- Install on each phone: open the Vercel URL in Chrome, then "Install app"
  from Chrome's menu. The app then opens fullscreen from its own icon.
- Redeploys reach installed apps the next time they open, no reinstall needed.

Testing during development:

- Preferred: Vercel preview deploys (close to the real study setup).
- Quick tweaks: `@vitejs/plugin-basic-ssl` and `vite --host`, then open the
  PC's local IP on the phone (same Wi-Fi, accept the certificate warning).

## Getting started

Requires Node 24+.

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase web config
npm run dev                  # http://localhost:5173
npm run dev:lan              # HTTPS on your local IP for testing on a phone
npm run build                # typecheck + production build into dist/
```

Project layout:

| Path                  | What                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| `src/main.tsx`        | Entry, registers the service worker                                    |
| `src/App.tsx`         | Main menu, join via `?lobby=CODE`, switches lobby / game / win screens |
| `src/Lobby.tsx`       | Lobby: QR code, names, host settings drawer, start match               |
| `src/Game.tsx`        | Countdown, match (demo lose-a-life button), win screen                 |
| `src/lib/lobby.ts`    | Lobby and match state in Firebase (`lobbies/{code}`)                   |
| `src/lib/device.ts`   | Rumble, sound, torch, wake lock                                        |
| `src/settings.ts`     | Match settings (lives, rumble, hit chance, indicator)                  |
| `src/lib/firebase.ts` | Firebase app + Realtime Database from `VITE_FIREBASE_*` env vars       |
| `vite.config.ts`      | React, PWA manifest (`fullscreen`), optional basic SSL for LAN         |
| `public/icons/`       | App icons (placeholder crosshair)                                      |
| `database.rules.json` | Realtime Database rules, deploy with `firebase deploy --only database` |
| `vercel.json`         | SPA rewrite, no-cache for the service worker                           |

Environment variables go in `.env.local` (git-ignored) and in Vercel under
Project → Settings → Environment Variables (same names).

## Step 1 – Capability demo (done)

Goal: find out whether a PWA is good enough before building the game.

Build a single test page and install it as a PWA on the study phones:

- [x] Vite + React + TypeScript project, `vite-plugin-pwa`, manifest with `"display": "fullscreen"`
- [ ] Repo pushed to GitHub and deployed on Vercel
- [ ] Installed as an app on both study phones from the Vercel URL
- [ ] "Tap to start" screen (vibration and audio need a first touch)
- [ ] Hold-to-fill circle that vibrates continuously while held once full
- [ ] Short, distinct vibration for "you were hit"
- [ ] Sound effect on shot and hit
- [ ] Long-press does not trigger text selection or context menu (base CSS in place, test on phone)
- [ ] Screen stays awake (Screen Wake Lock API)
- [ ] Hold duration measured with `performance.now()`
- [ ] One test write to Firebase and a live read on the second phone

Decision after the demo:

- Rumble feels strong and responsive enough -> continue with the PWA.
- Rumble too weak, laggy or too limited -> switch to Capacitor.

## Step 2 – Sessions (current step)

Lobby flow is built: menu -> Play creates `lobbies/{code}` -> QR code / link -> guest joins -> names -> host settings -> countdown -> match -> win screen. The match itself is a demo button until Step 3.

- One phone creates a session with a short code, the other joins.
- Both phones subscribe to the session state.
- Session stores the condition (indicator shown or hidden).

## Step 3 – Duel logic

- Hold, fill, rumble, shoot loop with hit chance growing over hold time.
- Time-to-100% is generated per round by one phone and written to the session.
- The shooter's phone rolls the hit and writes the result.
- Lives are updated with a Firebase transaction.
- Hit feedback (rumble and sound) on both phones, win and lose screens.

## Step 4 – Match logging (built)

Raw records, no averages. Players are identified by their name from the lobby.

- **`events/{id}`, one per shot** (written by the shooter's phone): `type: "shot"`, `player`, `opponent`, `matchId`, `matchNumber`, `showIndicator`, `holdMs`, `fillMs`, `rampMs` (time from full circle to 100%, drawn for that shot), `hitChance` (0–1 at release), `hit`, `livesSelf` / `livesOpponent` (remaining after the shot), `clientTime`, `serverTime`.
- **`events/{id}`, `type: "interrupted"`**: presses released before the circle was full (`holdMs`).
- **`matches/{matchId}`**: `matchNumber`, `showIndicator`, `players`, `startAt`, `endAt`, `winner`, settings snapshot, `appVersion`.

Logging is off by default; the host turns it on with **Log matches** in the settings drawer (leave it off for practice rounds). Match numbers count the logged matches per lobby (1, 2, 3, ...). Time to 100% is drawn per shot from a normal distribution (mean 5 s, SD 2 s by default, floor 500 ms).

`events/` is write-only for the app; export it as JSON from the Firebase console (Realtime Database → ⋮ → Export JSON).

Before real sessions: set Firebase security rules (test mode expires after 30 days), use an EU database location, and delete test data from `events/` and `matches/` in the console.

## Step 5 – Polish (if time allows)

- Western UI, audio and visuals.
- Optional 3D models via three.js / React Three Fiber (`.glb` files).

## Open questions

- What exactly is a "round" (per shot, per life or per match)? a round is a match, the time needed for 100% changes between shots.
- What happens to a hold when the player is hit mid-hold? he keeps charging
- Do both players in a match get the same condition? yes
- Between-subjects or within-subjects design? within
- Is the questionnaire built into the app or run in a separate form tool? external
