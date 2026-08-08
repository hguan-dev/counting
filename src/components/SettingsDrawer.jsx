import { useEffect } from 'react';

function SettingRow({ label, description, checked, onChange }) {
  return (
    <label className="setting-row">
      <span className="setting-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className={`switch ${checked ? 'is-on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <i aria-hidden="true" />
      </span>
    </label>
  );
}

export default function SettingsDrawer({
  onClose,
  warnStrategy,
  onWarnStrategyChange,
  showStrategyPopups,
  onStrategyPopupsChange,
  soundEnabled,
  onSoundChange,
  speechEnabled,
  onSpeechChange,
  kokoroVoices,
  selectedVoiceName,
  onVoiceChange,
  voiceModelStatus,
  voiceModelProgress,
  onPreviewVoice,
  onExportLog,
}) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const voiceStatusLabel = voiceModelStatus === 'loading'
    ? `Loading voice model ${voiceModelProgress ? `· ${voiceModelProgress}%` : '…'}`
    : voiceModelStatus === 'warming'
      ? 'AI voice retrying — using system voice'
      : 'AI voice ready';

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="study-drawer settings-drawer" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="study-header">
          <h2>Settings</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-content">
          <section>
            <h3>Coaching</h3>
            <SettingRow
              label="Strategy guard"
              description="Checks every play against basic strategy before it happens."
              checked={warnStrategy}
              onChange={() => onWarnStrategyChange(!warnStrategy)}
            />
            <SettingRow
              label="Correction popups"
              description="Pause on mistakes with the rule you missed. Off = silent tracking."
              checked={showStrategyPopups}
              onChange={() => onStrategyPopupsChange(!showStrategyPopups)}
            />
          </section>

          <section>
            <h3>Dealer voice</h3>
            <SettingRow
              label="Spoken announcements"
              description="The dealer calls cards, totals, and results out loud."
              checked={speechEnabled}
              onChange={() => onSpeechChange(!speechEnabled)}
            />
            {speechEnabled && kokoroVoices.length > 0 && (
              <div className="voice-settings">
                <label className="setting-field">
                  <span>AI voice</span>
                  <select
                    value={selectedVoiceName}
                    onChange={event => onVoiceChange(event.target.value)}
                  >
                    {kokoroVoices.map(voice => (
                      <option key={voice.id} value={`kokoro:${voice.id}`}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={`voice-model-status is-${voiceModelStatus}`}>
                  <span className="voice-model-dot" aria-hidden="true" />
                  <span>{voiceStatusLabel}</span>
                  {voiceModelStatus === 'loading' && (
                    <span className="voice-model-bar" aria-hidden="true">
                      <i style={{ width: `${voiceModelProgress}%` }} />
                    </span>
                  )}
                  <button className="voice-preview" onClick={onPreviewVoice}>
                    Preview
                  </button>
                </div>
              </div>
            )}
            <SettingRow
              label="Sound effects"
              description="Card, chip, and result sounds."
              checked={soundEnabled}
              onChange={() => onSoundChange(!soundEnabled)}
            />
          </section>

          <section>
            <h3>Table rules</h3>
            <ul className="rules-list">
              <li><span>Shoe</span><strong>6 decks · 75% penetration</strong></li>
              <li><span>Dealer</span><strong>Hits soft 17</strong></li>
              <li><span>Blackjack</span><strong>Pays 3:2</strong></li>
              <li><span>Insurance</span><strong>Pays 2:1</strong></li>
              <li><span>Limits</span><strong>$5 – $10,000 · up to 2 spots</strong></li>
              <li><span>Splits</span><strong>Up to 4 hands per spot</strong></li>
            </ul>
          </section>

          <section>
            <h3>Session</h3>
            <button className="settings-export" onClick={onExportLog}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
              </svg>
              Export session log (CSV)
            </button>
            <p className="settings-note">
              Every deal, decision, and count is logged for review.
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}
