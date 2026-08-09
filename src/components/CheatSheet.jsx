import { useState } from 'react';
import StrategyQuiz from './StrategyQuiz';
import { BET_RAMP_GUIDE_ROWS } from '../utils/betSizing';
import { DEVIATION_GUIDE_GROUPS } from '../utils/deviations';

const strategyRows = [
  ['Hard 17+', 'Stand'],
  ['Hard 13–16', 'Stand vs 2–6; hit vs 7–A'],
  ['Hard 12', 'Stand vs 4–6; otherwise hit'],
  ['Hard 11', 'Double; hit if doubling unavailable'],
  ['Hard 10', 'Double vs 2–9; otherwise hit'],
  ['Hard 9', 'Double vs 3–6; otherwise hit'],
  ['Soft 20+', 'Stand'],
  ['Soft 19 (A,8)', 'Double vs 6; otherwise stand'],
  ['Soft 18 (A,7)', 'Double vs 2–6; stand vs 7,8; hit vs 9–A'],
  ['Soft 13–17', 'Double against select 3–6 upcards; otherwise hit'],
];

const pairRows = [
  ['A,A', 'Always split'],
  ['8,8', 'Always split except surrender vs Ace'],
  ['10,10', 'Never split; stand'],
  ['9,9', 'Split vs 2–6, 8, 9'],
  ['7,7', 'Split vs 2–7'],
  ['6,6', 'Split vs 2–6'],
  ['5,5', 'Never split; play as hard 10'],
  ['4,4', 'Split vs 5–6'],
  ['2,2 / 3,3', 'Split vs 2–7'],
];

const surrenderRows = [
  ['Hard 15', 'Surrender vs 10 at RC 0+; vs Ace at TC −1+'],
  ['Hard 16 (not 8,8)', 'Surrender vs 9, 10, or Ace; use negative-count exceptions below'],
  ['Hard 17', 'Surrender vs Ace'],
  ['8,8', 'Surrender vs Ace; split against other upcards'],
];

const countRows = [
  ['2–6', '+1', 'Low cards leaving the shoe favor the player'],
  ['7–9', '0', 'Neutral'],
  ['10–A', '−1', 'High cards leaving the shoe favor the house'],
];

function GuideTable({ rows, headings }) {
  return (
    <div className="guide-table-wrap">
      <table className="guide-table">
        <thead>
          <tr>{headings.map(heading => <th key={heading}>{heading}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[0]}>
              {row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CheatSheet({ onClose }) {
  const [activeTab, setActiveTab] = useState('strategy');
  const tabs = [
    ['strategy', 'Strategy'],
    ['rules', 'How to play'],
    ['counting', 'Counting'],
    ['quiz', 'Quiz'],
  ];

  return (
    <aside className="study-drawer" aria-label="Blackjack study guide">
      <div className="study-header">
        <div>
          <span className="eyebrow">Table school</span>
          <h2>Blackjack Study Guide</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close study guide">✕</button>
      </div>

      <div className="study-tabs" role="tablist" aria-label="Study guide sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={activeTab === id ? 'is-active' : ''}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="study-content">
        {activeTab === 'strategy' && (
          <>
            <section className="guide-callout">
              <span className="guide-callout-icon">★</span>
              <div>
                <strong>Basic strategy is math, not instinct.</strong>
                <p>It minimizes the house edge for the exact rules shown at the table. It does not guarantee any single hand.</p>
              </div>
            </section>

            <section>
              <h3>Hard & soft totals</h3>
              <p className="section-intro">A soft hand contains an Ace currently counted as 11. A hard hand does not.</p>
              <GuideTable rows={strategyRows} headings={['Your hand', 'Best play']} />
            </section>

            <section>
              <h3>Pairs</h3>
              <GuideTable rows={pairRows} headings={['Pair', 'Best play']} />
            </section>

            <section>
              <h3>Late surrender</h3>
              <p className="section-intro">Available only on the original two-card hand after the dealer checks for blackjack. You forfeit half your wager and the hand ends.</p>
              <GuideTable rows={surrenderRows} headings={['Your hand', 'Surrender when']} />
            </section>

            <details open>
              <summary>Complete Hi-Lo deviation index</summary>
              <p className="section-intro">Six-deck H17, DAS, late surrender. RC means running count; all other indices use the rounded true count.</p>
              {DEVIATION_GUIDE_GROUPS.map(group => (
                <div className="deviation-group" key={group.title}>
                  <h4>{group.title}</h4>
                  <GuideTable rows={group.rows} headings={['Matchup', 'Deviation']} />
                </div>
              ))}
            </details>
          </>
        )}

        {activeTab === 'rules' && (
          <>
            <section className="guide-callout">
              <span className="guide-callout-icon">21</span>
              <div>
                <strong>The goal</strong>
                <p>Beat the dealer without exceeding 21. You win by finishing closer to 21, making 21 while the dealer does not, or letting the dealer bust.</p>
              </div>
            </section>

            <section>
              <h3>What each action means</h3>
              <div className="term-grid">
                <div><strong>Hit</strong><span>Take another card.</span></div>
                <div><strong>Stand</strong><span>Keep your total and end your turn.</span></div>
                <div><strong>Double</strong><span>Double the wager, take exactly one card, then stand.</span></div>
                <div><strong>Split</strong><span>Turn a pair into two separately wagered hands.</span></div>
                <div><strong>Insurance</strong><span>A side bet that the dealer has blackjack. Usually a poor bet without a count edge.</span></div>
                <div><strong>Late surrender</strong><span>After the dealer checks for blackjack, forfeit half the original wager and end the hand.</span></div>
              </div>
            </section>

            <section>
              <h3>Payoffs & outcomes</h3>
              <ul className="guide-list">
                <li><strong>Natural blackjack:</strong> Ace + ten-value card on the original two cards; pays 3:2 here.</li>
                <li><strong>Regular win:</strong> pays 1:1.</li>
                <li><strong>Push:</strong> tie; your wager is returned.</li>
                <li><strong>Bust:</strong> over 21; the wager loses immediately.</li>
                <li><strong>Split 21:</strong> counts as 21, not a natural blackjack.</li>
              </ul>
            </section>

            <details open>
              <summary>Rules used by this table</summary>
              <ul className="guide-list">
                <li>Six-deck shoe with roughly 75% penetration.</li>
                <li>Dealer hits soft 17 (H17).</li>
                <li>Blackjack pays 3:2.</li>
                <li>Double after split is allowed.</li>
                <li>Pairs may be resplit to a maximum of four hands.</li>
                <li>Split Aces receive one card each.</li>
                <li>Late surrender is allowed on an unsplit original two-card hand.</li>
              </ul>
            </details>

            <details>
              <summary>Common beginner mistakes</summary>
              <ul className="guide-list">
                <li>Taking insurance because it feels protective.</li>
                <li>Standing on 12 against a dealer 2 or 3.</li>
                <li>Splitting tens or failing to split eights.</li>
                <li>Ignoring whether a hand is soft when choosing an action.</li>
                <li>Changing bet size from emotion rather than a defined bankroll plan.</li>
              </ul>
            </details>

            <details>
              <summary>Voice mode & vision-free play</summary>
              <ul className="guide-list">
                <li>Enable <strong>Voice mode</strong> once, then say “help” at any time.</li>
                <li>Configure unequal wagers naturally: “two spots, bet 25 and 50.”</li>
                <li>Every round decision is supported: hit, stand, double, split, surrender, insurance, even money, and next round.</li>
                <li>Say “status,” “bankroll,” or “count” to hear the current table state.</li>
                <li>Say “microphone test” to confirm that speech is detected, transcribed, and matched end to end.</li>
                <li>Spoken prompts pause microphone listening while the dealer talks, then resume automatically.</li>
              </ul>
            </details>
          </>
        )}

        {activeTab === 'quiz' && (
          <>
            <section className="guide-callout">
              <span className="guide-callout-icon">?</span>
              <div>
                <strong>Drill the decision, not the memory.</strong>
                <p>Random hand, random count. Pick the play, then read the rule behind it — deviations included.</p>
              </div>
            </section>
            <StrategyQuiz />
          </>
        )}

        {activeTab === 'counting' && (
          <>
            <section className="guide-callout">
              <span className="guide-callout-icon">±</span>
              <div>
                <strong>Counting tracks composition, not the next card.</strong>
                <p>A positive count means more tens and Aces remain than usual, improving blackjacks and successful doubles.</p>
              </div>
            </section>

            <section>
              <h3>Hi‑Lo tags</h3>
              <GuideTable rows={countRows} headings={['Cards', 'Tag', 'Meaning']} />
            </section>

            <section>
              <h3>Running count → true count</h3>
              <div className="formula-card">
                <span>Running count</span>
                <b>÷</b>
                <span>Decks remaining</span>
                <b>=</b>
                <span>True count</span>
              </div>
              <p className="section-intro">Example: +8 with about 2 decks remaining is a true count of +4. Use the true count for betting and deviations.</p>
            </section>

            <section>
              <h3>Bet sizing: a practice ramp</h3>
              <p className="section-intro">This trainer uses a fixed $25 unit and warns before the deal when the wager does not match the count.</p>
              <GuideTable rows={BET_RAMP_GUIDE_ROWS} headings={['True count', 'Bet', 'Units']} />
              <div className="risk-note">
                <strong>Size from bankroll, not emotion.</strong>
                <span>A $1,000 practice bankroll contains 40 units at $25 each. This ramp is for training and does not eliminate risk of ruin.</span>
              </div>
            </section>

            <section>
              <h3>Using the ramp well</h3>
              <ul className="guide-list">
                <li>Raise or lower the wager from the <strong>true count before the deal</strong>, then leave it unchanged during the hand.</li>
                <li>Keep the base unit fixed for the session. Never increase it to chase losses.</li>
                <li>A worthwhile ramp depends on rules, penetration, accuracy, bankroll, and risk tolerance—not the count alone.</li>
                <li>Reset the running count only when the shoe is shuffled.</li>
              </ul>
            </section>

            <section>
              <h3>Practice loop</h3>
              <ol className="guide-list numbered">
                <li>Start every fresh shoe at 0.</li>
                <li>Tag every exposed card once.</li>
                <li>Estimate decks remaining before converting.</li>
                <li>Keep playing perfect basic strategy.</li>
                <li>Use deviations only at their exact index.</li>
              </ol>
            </section>

            <details>
              <summary>Reality check</summary>
              <p className="detail-copy">This ramp is a learning example, not a promise of profit or individualized financial advice. Card counting is not illegal in many jurisdictions, but casinos can refuse service and local rules vary.</p>
            </details>
          </>
        )}
      </div>

      <div className="study-footer">
        Strategy shown is tailored to this trainer’s six-deck H17 rules.
      </div>
    </aside>
  );
}
