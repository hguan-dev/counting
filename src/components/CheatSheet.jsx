import { useState } from 'react';

const strategyRows = [
  ['Hard 17+', 'Stand'],
  ['Hard 13–16', 'Stand vs 2–6; hit vs 7–A'],
  ['Hard 12', 'Stand vs 4–6; otherwise hit'],
  ['Hard 11', 'Double; hit if doubling unavailable'],
  ['Hard 10', 'Double vs 2–9; otherwise hit'],
  ['Hard 9', 'Double vs 3–6; otherwise hit'],
  ['Soft 19+', 'Stand'],
  ['Soft 18 (A,7)', 'Double vs 3–6; stand vs 2,7,8; hit vs 9–A'],
  ['Soft 13–17', 'Double against select 3–6 upcards; otherwise hit'],
];

const pairRows = [
  ['A,A / 8,8', 'Always split'],
  ['10,10', 'Never split; stand'],
  ['9,9', 'Split vs 2–6, 8, 9'],
  ['7,7', 'Split vs 2–7'],
  ['6,6', 'Split vs 2–6'],
  ['5,5', 'Never split; play as hard 10'],
  ['4,4', 'Split vs 5–6'],
  ['2,2 / 3,3', 'Split vs 2–7'],
];

const countRows = [
  ['2–6', '+1', 'Low cards leaving the shoe favor the player'],
  ['7–9', '0', 'Neutral'],
  ['10–A', '−1', 'High cards leaving the shoe favor the house'],
];

const betRampRows = [
  ['0 or lower', '1 unit', '$10'],
  ['+1', '1 unit', '$10'],
  ['+2', '2 units', '$20'],
  ['+3', '4 units', '$40'],
  ['+4', '6 units', '$60'],
  ['+5 or higher', '8 units', '$80'],
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

            <details>
              <summary>Key count deviations in this trainer</summary>
              <ul className="guide-list">
                <li><strong>Insurance:</strong> take at true count +3 or higher.</li>
                <li><strong>16 vs 10:</strong> stand at true count 0 or higher, except always split 8s.</li>
                <li><strong>15 vs 10:</strong> stand at true count +4 or higher.</li>
                <li><strong>10 vs 10:</strong> double at true count +4 or higher.</li>
                <li><strong>11 vs Ace:</strong> double at true count +1 or higher.</li>
              </ul>
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
                <div><strong>Surrender</strong><span>Forfeit half the wager where offered. Not available in this trainer yet.</span></div>
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
                <li>Split Aces receive one card each.</li>
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
              <p className="section-intro">Choose one fixed unit before the shoe. A 1–8 spread means your largest wager is eight times your minimum—not eight times your last bet.</p>
              <GuideTable rows={betRampRows} headings={['True count', 'Bet', '$10 unit example']} />
              <div className="risk-note">
                <strong>Size from bankroll, not emotion.</strong>
                <span>With a $1,000 practice bankroll, a $5 unit creates 200 units; a $10 unit creates 100. More units reduce bet size and volatility, but no bankroll eliminates the risk of ruin.</span>
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
