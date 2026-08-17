import { useEffect, useState } from 'react';
import {
  DECK_OPTIONS,
  getHouseEdgePercent,
  PAYOUT_OPTIONS,
  PENETRATION_OPTIONS,
} from '../utils/tableRules';
import { ACHIEVEMENTS, getRank } from '../utils/profile';

const formatSigned = value => `${value >= 0 ? '+' : '−'}$${Math.abs(Math.round(value)).toLocaleString()}`;

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

const TABLE_PACE_OPTIONS = [
  ['manual', 'Manual', 'You sweep'],
  ['slow', 'Relaxed', '6s'],
  ['medium', 'Steady', '3.5s'],
  ['fast', 'Brisk', '2s'],
  ['pro', 'Casino', '1.2s'],
];

export default function SettingsDrawer({
  onClose,
  warnStrategy,
  onWarnStrategyChange,
  warnBetSizing = false,
  onWarnBetSizingChange,
  showStrategyPopups,
  onStrategyPopupsChange,
  tablePace,
  onTablePaceChange,
  countDrillEnabled,
  onCountDrillChange,
  drillStats,
  aiSeatCount,
  onAiSeatCountChange,
  rules,
  onRulesChange,
  rulesLocked = false,
  profile,
  sessionStatus,
  onResetSession,
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

  const [confirmReset, setConfirmReset] = useState(false);
  const rank = getRank(profile?.xp || 0);
  const lifetimeAccuracy = profile?.decisions
    ? Math.round(((profile.decisions - profile.mistakes) / profile.decisions) * 100)
    : 0;
  const unlocked = ACHIEVEMENTS.filter(achievement => achievement.unlocked(profile || {}));

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
          <section className="profile-section">
            <div className="profile-rank">
              <div className="profile-badge" aria-hidden="true">{rank.level}</div>
              <div className="profile-rank-copy">
                <span>Rank {rank.level} of 8</span>
                <strong>{rank.current.title}</strong>
                <div className="profile-xp" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(rank.progress * 100)}>
                  <i style={{ width: `${Math.round(rank.progress * 100)}%` }} />
                </div>
                <small>
                  {rank.next
                    ? `${(profile?.xp || 0).toLocaleString()} XP · ${(rank.next.minXp - (profile?.xp || 0)).toLocaleString()} to ${rank.next.title}`
                    : `${(profile?.xp || 0).toLocaleString()} XP · top rank`}
                </small>
              </div>
            </div>
            <div className="profile-stats">
              <div><span>Hands</span><strong>{(profile?.handsPlayed || 0).toLocaleString()}</strong></div>
              <div><span>Accuracy</span><strong>{lifetimeAccuracy}%</strong></div>
              <div><span>Best streak</span><strong>{profile?.bestStreak || 0}</strong></div>
              <div><span>Count calls</span><strong>{profile?.drillExact || 0}/{profile?.drillAttempts || 0}</strong></div>
              <div><span>Shoes</span><strong>{profile?.shoesCompleted || 0}</strong></div>
              <div><span>Best session</span><strong>{formatSigned(profile?.bestSessionPnl || 0)}</strong></div>
            </div>
            <div className="profile-achievements" aria-label={`${unlocked.length} of ${ACHIEVEMENTS.length} achievements unlocked`}>
              {ACHIEVEMENTS.map((achievement) => {
                const done = achievement.unlocked(profile || {});
                return (
                  <div key={achievement.id} className={`achievement ${done ? 'is-unlocked' : ''}`} title={achievement.description}>
                    <i aria-hidden="true">{done ? '★' : '☆'}</i>
                    <span>{achievement.title}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3>Session</h3>
            <div className="profile-stats is-session">
              <div><span>Bankroll</span><strong>${Math.round(sessionStatus?.bankroll || 0).toLocaleString()}</strong></div>
              <div><span>P&amp;L</span><strong className={(sessionStatus?.pnl || 0) >= 0 ? 'is-positive' : 'is-negative'}>{formatSigned(sessionStatus?.pnl || 0)}</strong></div>
              <div><span>Hands</span><strong>{sessionStatus?.hands || 0}</strong></div>
              <div><span>Accuracy</span><strong>{sessionStatus?.accuracyRate || 0}%</strong></div>
              <div><span>Buy-ins</span><strong>${Math.round(sessionStatus?.buyIns || 0).toLocaleString()}</strong></div>
              <div><span>Session #</span><strong>{profile?.sessions || 1}</strong></div>
            </div>
            {!confirmReset ? (
              <button className="settings-export is-danger" onClick={() => setConfirmReset(true)} disabled={rulesLocked}>
                Reset session
              </button>
            ) : (
              <div className="reset-confirm">
                <span>Bankroll back to $1,000, history cleared, fresh shoe. Your rank and lifetime stats stay.</span>
                <div>
                  <button className="settings-export is-danger" onClick={() => { setConfirmReset(false); onResetSession(); }}>Yes, reset</button>
                  <button className="settings-export" onClick={() => setConfirmReset(false)}>Keep playing</button>
                </div>
              </div>
            )}
            {rulesLocked && <p className="settings-note">Finish the current round to reset.</p>}
          </section>

          <section>
            <h3>Coaching</h3>
            <SettingRow
              label="Strategy guard"
              description="Checks every play against basic strategy before it happens."
              checked={warnStrategy}
              onChange={() => onWarnStrategyChange(!warnStrategy)}
            />
            <SettingRow
              label="Bet-sizing guard"
              description="Warn before the deal when your wager doesn't match your bet spread for the count."
              checked={warnBetSizing}
              onChange={() => onWarnBetSizingChange(!warnBetSizing)}
            />
            <SettingRow
              label="Correction popups"
              description="Pause on mistakes with the rule you missed. Off = silent tracking."
              checked={showStrategyPopups}
              onChange={() => onStrategyPopupsChange(!showStrategyPopups)}
            />
          </section>

          <section>
            <h3>Training</h3>
            <SettingRow
              label="Count check at shuffle"
              description={drillStats?.attempts
                ? `Quiz the running count before each new shoe. So far: ${drillStats.exact}/${drillStats.attempts} exact.`
                : 'Quiz the running count before each new shoe.'}
              checked={countDrillEnabled}
              onChange={() => onCountDrillChange(!countDrillEnabled)}
            />
            <div className="pace-field">
              <div className="setting-copy">
                <strong>Table companions</strong>
                <span>Other players at the table — more cards to count, dealt at the table pace below.</span>
              </div>
              <div className="pace-options is-seats" role="radiogroup" aria-label="Table companions">
                {[[0, 'Just you', 'Heads-up'], [2, '+2 players', 'Lena & Walt'], [4, '+4 players', 'Full table']].map(([value, label, detail]) => (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={aiSeatCount === value}
                    className={aiSeatCount === value ? 'is-selected' : ''}
                    onClick={() => onAiSeatCountChange(value)}
                  >
                    <span>{label}</span>
                    <small>{detail}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="pace-field">
              <div className="setting-copy">
                <strong>Table pace</strong>
                <span>How quickly companions act and cards are swept after payouts.</span>
              </div>
              <div className="pace-options" role="radiogroup" aria-label="Table pace">
                {TABLE_PACE_OPTIONS.map(([value, label, detail]) => (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={tablePace === value}
                    className={tablePace === value ? 'is-selected' : ''}
                    onClick={() => onTablePaceChange(value)}
                  >
                    <span>{label}</span>
                    <small>{detail}</small>
                  </button>
                ))}
              </div>
            </div>
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
            <p className="settings-note is-lead">
              House edge for these rules: <strong>{getHouseEdgePercent(rules).toFixed(2)}%</strong>
              {rulesLocked && ' · changes apply from the next round'}
            </p>
            <div className="rule-field">
              <span>Decks</span>
              <div className="pace-options is-decks" role="radiogroup" aria-label="Number of decks">
                {DECK_OPTIONS.map(decks => (
                  <button
                    key={decks}
                    role="radio"
                    aria-checked={rules.decks === decks}
                    className={rules.decks === decks ? 'is-selected' : ''}
                    onClick={() => onRulesChange({ decks })}
                  >
                    <span>{decks}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rule-field">
              <span>Penetration</span>
              <div className="pace-options is-pen" role="radiogroup" aria-label="Shoe penetration">
                {PENETRATION_OPTIONS.map(penetration => (
                  <button
                    key={penetration}
                    role="radio"
                    aria-checked={rules.penetration === penetration}
                    className={rules.penetration === penetration ? 'is-selected' : ''}
                    onClick={() => onRulesChange({ penetration })}
                  >
                    <span>{Math.round(penetration * 100)}%</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rule-field">
              <span>Dealer on soft 17</span>
              <div className="pace-options is-pair" role="radiogroup" aria-label="Dealer soft 17 rule">
                {[[true, 'Hits', 'H17'], [false, 'Stands', 'S17']].map(([value, label, detail]) => (
                  <button
                    key={detail}
                    role="radio"
                    aria-checked={rules.dealerHitsSoft17 === value}
                    className={rules.dealerHitsSoft17 === value ? 'is-selected' : ''}
                    onClick={() => onRulesChange({ dealerHitsSoft17: value })}
                  >
                    <span>{label}</span>
                    <small>{detail}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="rule-field">
              <span>Blackjack pays</span>
              <div className="pace-options is-pair" role="radiogroup" aria-label="Blackjack payout">
                {PAYOUT_OPTIONS.map(option => (
                  <button
                    key={option.label}
                    role="radio"
                    aria-checked={rules.blackjackPayout === option.value}
                    className={rules.blackjackPayout === option.value ? 'is-selected' : ''}
                    onClick={() => onRulesChange({ blackjackPayout: option.value })}
                  >
                    <span>{option.label}</span>
                    <small>{option.value === 1.5 ? 'Standard' : 'Avoid'}</small>
                  </button>
                ))}
              </div>
            </div>
            <SettingRow
              label="Double after split (DAS)"
              description="Double down on hands created by splitting a pair."
              checked={rules.doubleAfterSplit}
              onChange={() => onRulesChange({ doubleAfterSplit: !rules.doubleAfterSplit })}
            />
            <SettingRow
              label="Late surrender (LS)"
              description="Forfeit half the wager after the dealer checks for blackjack."
              checked={rules.lateSurrender}
              onChange={() => onRulesChange({ lateSurrender: !rules.lateSurrender })}
            />
            <ul className="rules-list">
              <li><span>Insurance</span><strong>Pays 2:1</strong></li>
              <li><span>Limits</span><strong>$25 – $10,000 · up to 2 spots</strong></li>
              <li><span>Splits</span><strong>Up to 4 hands · split Aces get one card</strong></li>
            </ul>
          </section>

          <section>
            <h3>Log</h3>
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
