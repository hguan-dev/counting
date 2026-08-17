import { useMemo } from 'react';
import { Card } from '../models/Card';
import { getDetailedPlay } from '../utils/strategyEngine';

const DEALER_UPCARDS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

// Two-card hands that produce each hard total without forming a pair.
const HARD_HANDS = [
  [8, ['3', '5']], [9, ['4', '5']], [10, ['4', '6']], [11, ['5', '6']],
  [12, ['5', '7']], [13, ['6', '7']], [14, ['6', '8']], [15, ['7', '8']],
  [16, ['7', '9']], [17, ['8', '9']],
];
const SOFT_HANDS = ['2', '3', '4', '5', '6', '7', '8', '9'];
const PAIR_HANDS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

const CODES = {
  double: { label: 'D', name: 'Double' },
  hit: { label: 'H', name: 'Hit' },
  split: { label: 'P', name: 'Split' },
  stand: { label: 'S', name: 'Stand' },
  surrender: { label: 'R', name: 'Surrender' },
};

const evaluateCell = (cards, upcard, rules) => {
  const play = getDetailedPlay(cards, upcard, 0, { ignoreDeviations: true, rules });
  if (play.action === 'surrender') {
    const fallback = getDetailedPlay(cards, upcard, 0, { allowSurrender: false, ignoreDeviations: true, rules });
    return { action: 'surrender', label: `R${CODES[fallback.action]?.label.toLowerCase() || ''}` };
  }
  if (play.action === 'double') {
    const soft = cards.some(card => card.value === 'A') && cards.length === 2;
    const total = cards.reduce((sum, card) => sum + card.numericValue, 0);
    const fallbackStand = soft && total >= 18;
    return { action: 'double', label: fallbackStand ? 'Ds' : 'Dh' };
  }
  return { action: play.action, label: CODES[play.action]?.label || '?' };
};

function ChartGrid({ title, rows, rules, note }) {
  const cells = useMemo(() => rows.map(({ cards, label }) => ({
    label,
    plays: DEALER_UPCARDS.map(value => evaluateCell(cards, new Card('♠', value), rules)),
  })), [rows, rules]);

  return (
    <section className="chart-section">
      <h3>{title}</h3>
      {note && <p className="section-intro">{note}</p>}
      <div className="chart-scroll">
        <table className="strategy-chart">
          <thead>
            <tr>
              <th aria-label="Your hand" />
              {DEALER_UPCARDS.map(value => <th key={value}>{value}</th>)}
            </tr>
          </thead>
          <tbody>
            {cells.map(row => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.plays.map((play, index) => (
                  <td key={DEALER_UPCARDS[index]} className={`is-${play.action}`} title={`${row.label} vs ${DEALER_UPCARDS[index]}: ${CODES[play.action]?.name}`}>
                    {play.label}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function StrategyChart({ rules }) {
  const hardRows = useMemo(() => HARD_HANDS.map(([total, [a, b]]) => ({
    cards: [new Card('♠', a), new Card('♥', b)],
    label: String(total),
  })), []);
  const softRows = useMemo(() => SOFT_HANDS.map(value => ({
    cards: [new Card('♠', 'A'), new Card('♥', value)],
    label: `A,${value}`,
  })), []);
  const pairRows = useMemo(() => PAIR_HANDS.map(value => ({
    cards: [new Card('♠', value), new Card('♥', value)],
    label: `${value},${value}`,
  })), []);

  return (
    <div className="strategy-charts">
      <div className="chart-legend" aria-label="Chart legend">
        <span className="is-hit">H Hit</span>
        <span className="is-stand">S Stand</span>
        <span className="is-double">D Double <small>(h/s if not allowed)</small></span>
        <span className="is-split">P Split</span>
        <span className="is-surrender">R Surrender <small>(else h/s)</small></span>
      </div>
      <ChartGrid title="Hard totals" rows={hardRows} rules={rules} note="Hard 5–7: always hit. Hard 18+: always stand." />
      <ChartGrid title="Soft totals" rows={softRows} rules={rules} note="An Ace counted as 11. Soft 20+: always stand." />
      <ChartGrid title="Pairs" rows={pairRows} rules={rules} />
    </div>
  );
}
