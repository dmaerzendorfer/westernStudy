import { Fragment, useState } from 'react'
import QRCode from 'react-qr-code'
import { rumble } from './lib/device'
import { joinUrl, pickName, playerId, setLobbySettings, setName, startMatch, type Lobby } from './lib/lobby'
import { DEFAULT_SETTINGS, SETTING_DEFS, saveSettings, type Settings } from './settings'

type Props = { code: string; lobby: Lobby; onLeave: () => void }

export default function LobbyScreen({ code, lobby, onLeave }: Props) {
  const isHost = lobby.hostId === playerId
  const players = Object.entries(lobby.players).sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
  const [draft, setDraft] = useState(lobby.players[playerId].name)
  const [showSettings, setShowSettings] = useState(false)
  const url = joinUrl(code)

  // Empty name -> pick a western name the other player doesn't have
  function commitName() {
    const name = draft.trim()
    if (name) return void setName(code, name)
    const fallback = pickName(players.filter(([id]) => id !== playerId).map(([, p]) => p.name))
    setDraft(fallback)
    void setName(code, fallback)
  }

  return (
    <main className="screen lobby">
      <h2>Lobby {code}</h2>

      <div className="qr">
        <QRCode value={url} size={180} />
      </div>
      <a className="status link" href={url} target="_blank" rel="noreferrer">
        {url}
      </a>

      <ul className="players">
        {players.map(([id, p]) => (
          <li key={id}>
            {id === playerId ? (
              <input
                value={draft}
                maxLength={20}
                aria-label="Your name"
                onChange={(e) => {
                  setDraft(e.target.value)
                  if (e.target.value.trim()) void setName(code, e.target.value.trim())
                }}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            ) : (
              <span className="name">{p.name}</span>
            )}
            <span className="tags">
              {id === lobby.hostId && 'Host'}
              {id === playerId && ' (you)'}
            </span>
          </li>
        ))}
        {players.length < 2 && <li className="status">Waiting for the second player to scan the code...</li>}
      </ul>

      {isHost ? (
        <button className="big" disabled={players.length < 2} onClick={() => startMatch(code, lobby)}>
          Start match
        </button>
      ) : (
        <p className="status">Waiting for the host to start...</p>
      )}

      <div className="buttons">
        {isHost && <button onClick={() => setShowSettings(true)}>Settings</button>}
        <button onClick={onLeave}>Leave</button>
      </div>

      {isHost && showSettings && (
        <SettingsPanel code={code} settings={{ ...DEFAULT_SETTINGS, ...lobby.settings }} onClose={() => setShowSettings(false)} />
      )}
    </main>
  )
}

// Host-only side menu; changes go to the lobby (both phones) and stay on this phone as defaults
function SettingsPanel({ code, settings, onClose }: { code: string; settings: Settings; onClose: () => void }) {
  function update(next: Settings) {
    saveSettings(next)
    void setLobbySettings(code, next)
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="settings">
        <h2>Settings</h2>
        {SETTING_DEFS.map((d, i) => (
          <Fragment key={d.key}>
            {d.group !== SETTING_DEFS[i - 1]?.group && <h3>{d.group}</h3>}
            {'toggle' in d ? (
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings[d.key] === 1}
                  onChange={(e) => update({ ...settings, [d.key]: e.target.checked ? 1 : 0 })}
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
                  onChange={(e) => update({ ...settings, [d.key]: Number(e.target.value) })}
                />
              </label>
            )}
          </Fragment>
        ))}
        <div className="buttons">
          <button onClick={() => rumble(settings.rumbleMs, settings.pulses, settings.gapMs, settings.requestMs)}>
            Test rumble
          </button>
          <button onClick={() => update(DEFAULT_SETTINGS)}>Reset</button>
          <button onClick={onClose}>Close</button>
        </div>
      </aside>
    </>
  )
}
