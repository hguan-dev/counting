import { useMemo, useState } from 'react';
import { BET_UNIT, TABLE_MAX_BET } from '../utils/betSizing';
import {
  evaluateBetSpread,
  formatMoney,
  HANDS_PER_HOUR_BY_SEATS,
  normalizeBetSpread,
  optimizeBetSpread,
  SPREAD_MAX_TC,
  SPREAD_MIN_TC,
} from '../utils/betSpread';
import { describeRules, getHouseEdgePercent } from '../utils/tableRules';

const KELLY_OPTIONS = [
  [1, 'Full Kelly', 'Max growth, wild swings'],
  [0.5, 'Half Kelly', 'The usual pro choice'],
  [0.25, 'Quarter Kelly', 'Sleep well'],
];

const formatTc = tc => (
  tc === SPREAD_MIN_TC ? `≤ ${tc}` : tc === SPREAD_MAX_TC ? `≥ +${tc}` : tc > 0 ? `+${tc}` : String(tc)
);

const formatPercent = (value, digits = 1) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}%`;

export default function BetSpreadLab({
  aiSeatCount,
  bankroll,
  rules,
  spread,
  onSpreadChange,
}) {
  const [labBankroll, setLabBankroll] = useState(() => Math.max(1000, Math.round(bankroll)));
  const [handsPerHour, setHandsPerHour] = useState(() => HANDS_PER_HOUR_BY_SEATS[aiSeatCount] ?? 130);
  const [maxBet, setMaxBet] = useState(300);
  const [kellyFraction, setKellyFraction] = useState(0.5);
  const [sitOut, setSitOut] = useState(false);

  const result = useMemo(() => evaluateBetSpread({
    bankroll: labBankroll,
    handsPerHour,
    rules,
    spread,
  }), [labBankroll, handsPerHour, rules, spread]);

  const houseEdge = getHouseEdgePercent(rules);
  const maxSpreadBet = Math.max(...Object.values(spread));
  const minSpreadBet = Math.min(...Object.values(spread).filter(bet => bet > 0), BET_UNIT);

  const updateBet = (tc, value) => {
    onSpreadChange(normalizeBetSpread({ ...spread, [String(tc)]: value }));
  };

  const applyOptimized = () => {
    onSpreadChange(optimizeBetSpread({
      bankroll: labBankroll,
      kellyFraction,
      maxBet,
      rules,
      sitOutBelow: sitOut ? -1 : null,
    }));
  };

  return (
    <div className="spread-lab">
      <section className="spread-rules-strip" aria-label="Rules driving this model">
        <div>
          <span>Table rules</span>
          <strong>{describeRules(rules)}</strong>
        </div>
        <div>
          <span>Off-the-top edge</span>
          <strong className="is-negative">−{houseEdge.toFixed(2)}%</strong>
        </div>
        <div>
          <span>Per true count</span>
          <strong className="is-positive">+0.50%</strong>
        </div>
      </section>

      <section className="spread-inputs">
        <label>
          <span>Bankroll</span>
          <input
            type="number"
            min="500"
            step="500"
            value={labBankroll}
            onChange={event => setLabBankroll(Math.max(100, Number(event.target.value) || 0))}
          />
        </label>
        <label>
          <span>Hands / hour</span>
          <input
            type="number"
            min="30"
            max="400"
            step="10"
            value={handsPerHour}
            onChange={event => setHandsPerHour(Math.min(400, Math.max(30, Number(event.target.value) || 30)))}
          />
        </label>
        <label>
          <span>Max bet</span>
          <input
            type="number"
            min={BET_UNIT}
            max={TABLE_MAX_BET}
            step={BET_UNIT}
            value={maxBet}
            onChange={event => setMaxBet(Math.min(TABLE_MAX_BET, Math.max(BET_UNIT, Number(event.target.value) || BET_UNIT)))}
          />
        </label>
      </section>

      <section className="spread-optimizer">
        <div className="spread-kelly" role="radiogroup" aria-label="Kelly fraction">
          {KELLY_OPTIONS.map(([value, label, detail]) => (
            <button
              key={value}
              role="radio"
              aria-checked={kellyFraction === value}
              className={kellyFraction === value ? 'is-selected' : ''}
              onClick={() => setKellyFraction(value)}
            >
              <span>{label}</span>
              <small>{detail}</small>
            </button>
          ))}
        </div>
        <label className="spread-sitout">
          <input type="checkbox" checked={sitOut} onChange={() => setSitOut(!sitOut)} />
          <span>Sit out (bet $0) at TC −1 and below</span>
        </label>
        <button className="spread-apply" onClick={applyOptimized}>
          Build spread for these rules
        </button>
      </section>

      <section className="spread-results" aria-live="polite">
        <div className={result.evPerHour >= 0 ? 'is-positive' : 'is-negative'}>
          <span>EV / hour</span>
          <strong>{formatMoney(result.evPerHour, { signed: true })}</strong>
        </div>
        <div>
          <span>Std dev / hour</span>
          <strong>±{formatMoney(result.sdPerHour)}</strong>
        </div>
        <div>
          <span>Avg bet · edge</span>
          <strong>{formatMoney(result.averageBet)} · {formatPercent(result.averageEdgePercent, 2)}</strong>
        </div>
        <div className={result.riskOfRuin > 0.1 ? 'is-negative' : result.riskOfRuin > 0.02 ? '' : 'is-positive'}>
          <span>Risk of ruin</span>
          <strong>{result.riskOfRuin >= 0.995 ? '~100%' : `${(result.riskOfRuin * 100).toFixed(1)}%`}</strong>
        </div>
        <div>
          <span>N₀ (hours to 1 SD)</span>
          <strong>{Number.isFinite(result.n0Hours) ? `${Math.round(result.n0Hours).toLocaleString()} h` : '—'}</strong>
        </div>
        <div>
          <span>Spread</span>
          <strong>1 : {Math.max(1, Math.round(maxSpreadBet / minSpreadBet))}</strong>
        </div>
      </section>

      <div className="chart-scroll">
        <table className="spread-table">
          <thead>
            <tr>
              <th>True count</th>
              <th>Frequency</th>
              <th>Your edge</th>
              <th>Bet</th>
              <th>EV / hand</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.trueCount} className={row.edgePercent > 0 ? 'is-positive' : ''}>
                <th scope="row">{formatTc(row.trueCount)}</th>
                <td>
                  <span className="freq-bar" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, row.probability * 250)}%` }} />
                  </span>
                  {(row.probability * 100).toFixed(1)}%
                </td>
                <td className={row.edgePercent >= 0 ? 'is-positive' : 'is-negative'}>{formatPercent(row.edgePercent, 2)}</td>
                <td>
                  <span className="bet-input">
                    <b>$</b>
                    <input
                      type="number"
                      min="0"
                      max={TABLE_MAX_BET}
                      step={BET_UNIT}
                      value={row.bet}
                      aria-label={`Bet at true count ${formatTc(row.trueCount)}`}
                      onChange={event => updateBet(row.trueCount, Number(event.target.value))}
                    />
                  </span>
                </td>
                <td className={row.ev >= 0 ? 'is-positive' : 'is-negative'}>
                  {row.bet === 0 ? 'sit out' : `${row.ev >= 0 ? '+' : '−'}$${Math.abs(row.ev).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="spread-note">
        The frequency column comes from the count math for {rules.decks} deck{rules.decks === 1 ? '' : 's'} at {Math.round(rules.penetration * 100)}% penetration — deeper cuts and fewer decks put more hands in the high counts. Edge uses the standard ~0.5% per true-count point over the {houseEdge.toFixed(2)}% house edge these rules produce. Risk of ruin assumes no stop-loss and no bankroll growth. The bet sizing guard at the table uses this exact spread. Wagers you enter here are rounded to $25 units.
      </p>
    </div>
  );
}
