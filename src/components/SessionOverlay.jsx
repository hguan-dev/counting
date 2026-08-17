import { useEffect, useMemo, useRef, useState } from 'react';

const WIDTH = 960;
const MAIN_HEIGHT = 300;
const COUNT_HEIGHT = 96;
const PAD = { left: 62, right: 60 };

const signedMoney = (value) => {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}$${Math.abs(rounded).toLocaleString()}`;
};

const formatWhen = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const niceTicks = (min, max, count = 4) => {
  const span = Math.max(1, max - min);
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(m => m >= rawStep) || magnitude * 10;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let value = start; value <= max + 1e-9; value += step) ticks.push(Math.round(value * 100) / 100);
  return ticks;
};

// Smooth monotone cubic path through points — no dots, no overshoot.
const smoothPath = (points) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  const n = points.length;
  const dx = [];
  const dy = [];
  const slopes = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1][0] - points[i][0]);
    dy.push(points[i + 1][1] - points[i][1]);
    slopes.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  const tangents = [slopes[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
  }
  tangents.push(slopes[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (slopes[i] === 0) { tangents[i] = 0; tangents[i + 1] = 0; continue; }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const h = Math.hypot(a, b);
    if (h > 3) { tangents[i] = 3 * a / h * slopes[i]; tangents[i + 1] = 3 * b / h * slopes[i]; }
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cx1 = x0 + dx[i] / 3;
    const cy1 = y0 + tangents[i] * dx[i] / 3;
    const cx2 = x1 - dx[i] / 3;
    const cy2 = y1 - tangents[i + 1] * dx[i] / 3;
    d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
  }
  return d;
};

const Stars = ({ stars, size = 'md' }) => (
  <span className={`stars is-${size}`} aria-label={`${stars} of 3 stars`}>
    {[1, 2, 3].map(index => <i key={index} className={index <= stars ? 'is-lit' : ''}>★</i>)}
  </span>
);

export default function SessionOverlay({ session, live = false, onClose }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);
  const hands = useMemo(() => session.hands || [], [session.hands]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const model = useMemo(() => {
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const points = [{ cumulativePnl: 0, decisions: 0, mistakes: 0, trueCount: 0, handNumber: 0 }, ...hands];
    const pnlValues = points.map(point => point.cumulativePnl);
    const pnlMin = Math.min(0, ...pnlValues);
    const pnlMax = Math.max(0, ...pnlValues);
    const pnlSpan = Math.max(pnlMax - pnlMin, 50);
    const floor = pnlMin - pnlSpan * 0.08;
    const ceiling = pnlMax + pnlSpan * 0.08;
    const mainTop = 22;
    const mainBottom = MAIN_HEIGHT - 26;
    const xFor = index => PAD.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth);
    const pnlY = value => mainTop + ((ceiling - value) / (ceiling - floor)) * (mainBottom - mainTop);
    const accuracyOf = point => (point.decisions > 0 ? (point.decisions - point.mistakes) / point.decisions : null);
    const accY = value => mainTop + (1 - value) * (mainBottom - mainTop);
    const tcLimit = Math.max(4, ...points.map(point => Math.abs(point.trueCount || 0)));
    const countMid = COUNT_HEIGHT / 2;
    const tcY = value => countMid - (value / tcLimit) * (COUNT_HEIGHT / 2 - 10);

    const pnlPoints = points.map((point, index) => [xFor(index), pnlY(point.cumulativePnl)]);
    const accPoints = points
      .map((point, index) => (accuracyOf(point) === null ? null : [xFor(index), accY(accuracyOf(point))]))
      .filter(Boolean);
    const linePath = smoothPath(pnlPoints);
    const areaPath = pnlPoints.length > 1
      ? `${linePath} L ${pnlPoints[pnlPoints.length - 1][0]} ${pnlY(0)} L ${pnlPoints[0][0]} ${pnlY(0)} Z`
      : '';
    return {
      accPoints, accY, areaPath, ceiling, countMid, floor, linePath, plotWidth, pnlPoints, pnlY,
      points, tcLimit, tcY, xFor, zeroY: pnlY(0),
      pnlTicks: niceTicks(floor, ceiling, 4),
    };
  }, [hands]);

  const onPointerMove = (event) => {
    if (!svgRef.current || model.points.length < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (x - PAD.left) / model.plotWidth;
    const index = Math.round(Math.min(1, Math.max(0, ratio)) * (model.points.length - 1));
    setHoverIndex(index);
  };

  const hovered = hoverIndex !== null ? model.points[hoverIndex] : null;
  const rating = session.rating || { stars: 0, reason: '' };
  const accuracy = session.decisions ? Math.round(((session.decisions - session.mistakes) / session.decisions) * 100) : 0;
  const pnl = hands.length ? hands[hands.length - 1].cumulativePnl : 0;

  return (
    <div className="session-overlay" role="dialog" aria-modal="true" aria-label="Session performance">
      <div className="session-overlay-inner">
        <header className="session-overlay-header">
          <div>
            <span className="eyebrow">{live ? 'Live session' : 'Session replay'}</span>
            <h2>
              {live ? 'Session performance' : `Session · ${formatWhen(session.startedAt)}`}
            </h2>
            {!live && session.endedAt && <small>Ended {formatWhen(session.endedAt)}</small>}
          </div>
          <div className="session-overlay-rating">
            <Stars stars={rating.stars} size="lg" />
            <small>{rating.stars ? rating.reason : 'Not yet rated'}{rating.score ? ` · ${rating.score}` : ''}</small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close session view">✕</button>
        </header>

        <div className="session-overlay-stats">
          <div className={pnl >= 0 ? 'is-positive' : 'is-negative'}><span>P&amp;L</span><strong>{signedMoney(pnl)}</strong></div>
          <div><span>Hands</span><strong>{hands.length}</strong></div>
          <div><span>Accuracy</span><strong>{accuracy}%</strong></div>
          <div><span>Decisions</span><strong>{session.decisions || 0}<small> · {session.mistakes || 0} miss</small></strong></div>
          <div><span>Count calls</span><strong>{session.countDrillStats?.exact || 0}/{session.countDrillStats?.attempts || 0}</strong></div>
          <div><span>Buy-ins</span><strong>${Math.round(session.buyIns || 0).toLocaleString()}</strong></div>
        </div>

        {hands.length === 0 ? (
          <div className="session-overlay-empty">
            <strong>No settled hands yet.</strong>
            <span>The graph fills in as you play — P&amp;L, running accuracy, and the true count at each hand.</span>
          </div>
        ) : (
          <div className="session-graph" onPointerLeave={() => setHoverIndex(null)}>
            <div className="session-legend">
              <span><i className="legend-pnl" /> Realized P&amp;L</span>
              <span><i className="legend-acc" /> Running accuracy</span>
              <span><i className="legend-count" /> True count</span>
              {hovered && hoverIndex > 0 && (
                <span className="session-hover">
                  Hand {hovered.handNumber}: {signedMoney(hovered.net || 0)} · cum {signedMoney(hovered.cumulativePnl)}
                  {hovered.decisions ? ` · acc ${Math.round(((hovered.decisions - hovered.mistakes) / hovered.decisions) * 100)}%` : ''}
                  {` · TC ${hovered.trueCount > 0 ? '+' : ''}${hovered.trueCount}`}
                </span>
              )}
            </div>
            <svg
              ref={svgRef}
              className="session-svg"
              viewBox={`0 0 ${WIDTH} ${MAIN_HEIGHT + COUNT_HEIGHT}`}
              role="img"
              onPointerMove={onPointerMove}
            >
              <defs>
                <linearGradient id="pnl-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f4d97b" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#f4d97b" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {model.pnlTicks.map(tick => (
                <g key={tick}>
                  <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={model.pnlY(tick)} y2={model.pnlY(tick)} />
                  <text className="chart-axis-label" x={PAD.left - 8} y={model.pnlY(tick) + 4} textAnchor="end">{signedMoney(tick)}</text>
                </g>
              ))}
              {[0.5, 0.75, 1].map(value => (
                <text key={value} className="chart-axis-label chart-axis-acc" x={WIDTH - PAD.right + 8} y={model.accY(value) + 4}>{Math.round(value * 100)}%</text>
              ))}
              <line className="chart-zero" x1={PAD.left} x2={WIDTH - PAD.right} y1={model.zeroY} y2={model.zeroY} />
              {model.areaPath && <path className="chart-area" d={model.areaPath} fill="url(#pnl-fill)" />}
              <path className="chart-line chart-line-pnl" d={model.linePath} />
              {model.accPoints.length > 1 && <path className="chart-line chart-line-acc" d={smoothPath(model.accPoints)} />}

              <g transform={`translate(0 ${MAIN_HEIGHT})`}>
                <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={model.countMid} y2={model.countMid} />
                <text className="chart-axis-label chart-axis-count" x={WIDTH - PAD.right + 8} y={model.tcY(model.tcLimit) + 4}>+{model.tcLimit}</text>
                <text className="chart-axis-label chart-axis-count" x={WIDTH - PAD.right + 8} y={model.tcY(-model.tcLimit) + 4}>−{model.tcLimit}</text>
                <text className="chart-axis-label chart-axis-count" x={PAD.left - 8} y={model.countMid + 4} textAnchor="end">TC</text>
                {model.points.slice(1).map((point, index) => {
                  const x = model.xFor(index + 1);
                  const y = model.tcY(point.trueCount);
                  const barWidth = Math.max(1.5, Math.min(10, model.plotWidth / Math.max(1, model.points.length - 1) - 1.5));
                  return (
                    <rect
                      key={point.handNumber}
                      className={`chart-count-bar ${point.trueCount > 0 ? 'is-positive' : point.trueCount < 0 ? 'is-negative' : ''}`}
                      x={x - barWidth / 2}
                      y={Math.min(y, model.countMid)}
                      width={barWidth}
                      height={Math.max(1, Math.abs(y - model.countMid))}
                    />
                  );
                })}
              </g>

              {hovered && hoverIndex > 0 && (
                <g className="chart-hover">
                  <line x1={model.xFor(hoverIndex)} x2={model.xFor(hoverIndex)} y1={16} y2={MAIN_HEIGHT + COUNT_HEIGHT - 8} />
                  <circle cx={model.xFor(hoverIndex)} cy={model.pnlY(hovered.cumulativePnl)} r="5" />
                </g>
              )}
              <text className="chart-axis-caption" x={WIDTH / 2} y={MAIN_HEIGHT - 4} textAnchor="middle">Hands ({hands.length})</text>
            </svg>
          </div>
        )}

        {hands.length > 0 && (
          <div className="session-replay">
            <h3>Hand by hand</h3>
            <div className="chart-scroll session-replay-scroll">
              <table className="spread-table replay-table">
                <thead>
                  <tr>
                    <th>#</th><th>You</th><th>Dealer</th><th>Result</th><th>Bet</th><th>Net</th><th>Cum.</th><th>TC</th><th>Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...hands].reverse().map((hand) => {
                    const acc = hand.decisions ? Math.round(((hand.decisions - hand.mistakes) / hand.decisions) * 100) : null;
                    return (
                      <tr key={hand.handNumber} className={hand.net > 0 ? 'is-win' : hand.net < 0 ? 'is-loss' : ''}>
                        <th scope="row">{hand.handNumber}</th>
                        <td>{hand.playerCards || '—'}{hand.playerTotal ? ` (${hand.playerTotal})` : ''}</td>
                        <td>{hand.dealerCards || '—'}{hand.dealerTotal ? ` (${hand.dealerTotal})` : ''}</td>
                        <td className="is-outcome">{hand.outcome || (hand.net > 0 ? 'win' : hand.net < 0 ? 'loss' : 'push')}</td>
                        <td>{hand.bet ? `$${hand.bet}` : '—'}</td>
                        <td className={hand.net > 0 ? 'is-positive' : hand.net < 0 ? 'is-negative' : ''}>{signedMoney(hand.net)}</td>
                        <td className={hand.cumulativePnl >= 0 ? 'is-positive' : 'is-negative'}>{signedMoney(hand.cumulativePnl)}</td>
                        <td>{hand.trueCount > 0 ? `+${hand.trueCount}` : hand.trueCount}</td>
                        <td>{acc === null ? '—' : `${acc}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
