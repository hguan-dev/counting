import { useMemo, useState } from 'react';
import NumberField from './NumberField';
import { BET_UNIT, TABLE_MAX_BET } from '../utils/betSizing';
import {
  evaluateBetSpread,
  formatMoney,
  getSpreadSharpe,
  HANDS_PER_HOUR_BY_SEATS,
  normalizeBetSpread,
  optimizeBetSpread,
  optimizeSharpeSpread,
  randomBetSpread,
  SPREAD_MAX_TC,
  SPREAD_MIN_TC,
} from '../utils/betSpread';
import { describeRules, getHouseEdgePercent } from '../utils/tableRules';
import { getEdgePerTrueCount, getPlayerEdgePercent } from '../utils/advantageCurve';

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
  // Practice bankrolls are tiny; default the model to a realistic counting roll.
  const [labBankroll, setLabBankroll] = useState(() => Math.max(10000, Math.round(bankroll)));
  const [handsPerHour, setHandsPerHour] = useState(() => HANDS_PER_HOUR_BY_SEATS[aiSeatCount] ?? 130);
  const [maxBet, setMaxBet] = useState(300);
  const [sitOut, setSitOut] = useState(false);

  const result = useMemo(() => evaluateBetSpread({
    bankroll: labBankroll,
    handsPerHour,
    rules,
    spread,
  }), [labBankroll, handsPerHour, rules, spread]);

  const houseEdge = getHouseEdgePercent(rules);
  const breakEvenTc = (() => {
    for (let tc = -2; tc <= 8; tc += 0.1) {
      if (getPlayerEdgePercent(rules, tc) >= 0) return tc;
    }
    return null;
  })();
  const breakEvenLabel = breakEvenTc === null ? '> +8' : `${breakEvenTc >= 0 ? '+' : ''}${breakEvenTc.toFixed(1)}`;
  const maxSpreadBet = Math.max(...Object.values(spread));
  const minSpreadBet = Math.min(...Object.values(spread).filter(bet => bet > 0), BET_UNIT);

  const updateBet = (tc, value) => {
    onSpreadChange(normalizeBetSpread({ ...spread, [String(tc)]: value }));
  };

  const applyOptimized = () => {
    onSpreadChange(optimizeBetSpread({ maxBet, rules, sitOutBelow: sitOut ? -1 : null }));
  };

  const applySharpe = () => {
    onSpreadChange(optimizeSharpeSpread({ maxBet, rules, sitOutBelow: sitOut ? -1 : null }));
  };

  const sharpe = getSpreadSharpe(spread, rules);

  const applyRandom = () => {
    onSpreadChange(randomBetSpread({ maxBet, sitOutBelow: sitOut ? -1 : null }));
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
          <strong className="is-positive">+{getEdgePerTrueCount(rules).toFixed(2)}%</strong>
        </div>
        <div>
          <span>Break-even</span>
          <strong>TC {breakEvenLabel}</strong>
        </div>
      </section>

      <section className="spread-inputs">
        <label>
          <span>Bankroll</span>
          <NumberField
            min="500"
            step="500"
            value={labBankroll}
            onCommit={setLabBankroll}
            clamp={amount => Math.max(100, Math.round(amount))}
          />
        </label>
        <label>
          <span>Hands / hour</span>
          <NumberField
            min="30"
            max="400"
            step="10"
            value={handsPerHour}
            onCommit={setHandsPerHour}
            clamp={amount => Math.min(400, Math.max(30, Math.round(amount)))}
          />
        </label>
        <label>
          <span>Max bet</span>
          <NumberField
            min={BET_UNIT}
            max={TABLE_MAX_BET}
            step={BET_UNIT}
            value={maxBet}
            onCommit={setMaxBet}
            clamp={amount => Math.min(TABLE_MAX_BET, Math.max(BET_UNIT, Math.round(amount / BET_UNIT) * BET_UNIT))}
          />
        </label>
      </section>

      <section className="spread-optimizer">
        <label className="spread-sitout">
          <input type="checkbox" checked={sitOut} onChange={() => setSitOut(!sitOut)} />
          <span>Sit out (bet $0) at TC −1 and below</span>
        </label>
        <div className="spread-actions">
          <button className="spread-apply" onClick={applyOptimized}>
            Build ramp from these rules
          </button>
          <button
            className="spread-apply is-primary"
            onClick={applySharpe}
            title="The ramp with the highest EV per unit of risk between $25 and the max bet"
          >
            Max Sharpe ramp
          </button>
          <button className="spread-random" onClick={applyRandom} title="A random non-decreasing ramp up to the max bet">
            Random ramp
          </button>
        </div>
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
        <div className={sharpe > 0 ? 'is-positive' : 'is-negative'}>
          <span>Sharpe · per hour / hand</span>
          <strong>{(sharpe * Math.sqrt(handsPerHour)).toFixed(3)} · {sharpe.toFixed(4)}</strong>
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
          <span>Spread · N₀ (hours to 1 SD)</span>
          <strong>1 : {Math.max(1, Math.round(maxSpreadBet / minSpreadBet))} · {Number.isFinite(result.n0Hours) ? `${Math.round(result.n0Hours).toLocaleString()} h` : '—'}</strong>
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
                    <NumberField
                      min="0"
                      max={TABLE_MAX_BET}
                      step={BET_UNIT}
                      value={row.bet}
                      aria-label={`Bet at true count ${formatTc(row.trueCount)}`}
                      onCommit={amount => updateBet(row.trueCount, amount)}
                      clamp={amount => Math.min(TABLE_MAX_BET, Math.max(0, Math.round(amount / BET_UNIT) * BET_UNIT))}
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
        The frequency column comes from the count math for {rules.decks} deck{rules.decks === 1 ? '' : 's'} at {Math.round(rules.penetration * 100)}% penetration — deeper cuts and fewer decks put more hands in the high counts. The edge column is computed by the same EV engine that grades your play: it re-evaluates every starting hand for these rules at each true count (with count-aware play, naturals paid at {rules.blackjackPayout === 1.2 ? '6:5' : '3:2'}), anchored at TC 0 to the published {houseEdge.toFixed(2)}% house edge. Risk of ruin assumes no stop-loss and no bankroll growth. The max Sharpe ramp maximizes EV per unit of standard deviation between $25 and your max bet, which also makes it the ramp that earns the most at any fixed risk of ruin. The bet-sizing guard at the table uses this exact spread. Wagers you enter here are rounded to $25 units.
      </p>
    </div>
  );
}
