const WIDTH = 640;
const HEIGHT = 150;
const PAD = { top: 18, right: 48, bottom: 28, left: 54 };

const signed = (value, prefix = '') => (
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${prefix}${Math.abs(value)}`
);

const pathFor = (points, xFor, yFor) => points
  .map((point, index) => `${index ? 'L' : 'M'} ${xFor(index)} ${yFor(point)}`)
  .join(' ');

export default function SessionChart({ hands }) {
  if (!hands.length) {
    return (
      <div className="session-chart-empty">
        <strong>Session performance</strong>
        <span>P&amp;L and true count begin plotting after the first settled hand.</span>
      </div>
    );
  }

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const pnlValues = [0, ...hands.map(hand => hand.cumulativePnl)];
  const pnlMin = Math.min(...pnlValues);
  const pnlMax = Math.max(...pnlValues);
  const pnlSpan = Math.max(pnlMax - pnlMin, 25);
  const pnlFloor = pnlMin - pnlSpan * 0.12;
  const pnlCeiling = pnlMax + pnlSpan * 0.12;
  const tcLimit = Math.max(5, ...hands.map(hand => Math.abs(hand.trueCount)));
  const xFor = index => PAD.left + (hands.length === 1 ? plotWidth / 2 : (index / (hands.length - 1)) * plotWidth);
  const pnlY = hand => PAD.top + ((pnlCeiling - hand.cumulativePnl) / (pnlCeiling - pnlFloor)) * plotHeight;
  const tcY = hand => PAD.top + ((tcLimit - hand.trueCount) / (tcLimit * 2)) * plotHeight;
  const zeroPnlY = PAD.top + (pnlCeiling / (pnlCeiling - pnlFloor)) * plotHeight;
  const zeroTcY = PAD.top + plotHeight / 2;

  return (
    <figure className="session-chart" aria-label="Cumulative realized profit and loss per hand with true-count overlay">
      <figcaption>
        <strong>Session performance</strong>
        <span><i className="legend-pnl" /> Realized P&amp;L · left axis</span>
        <span><i className="legend-count" /> True count · right axis</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
        <title>Cumulative realized P&amp;L by settled hand, with true count on an independent right-side scale.</title>
        <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={zeroPnlY} y2={zeroPnlY} />
        <line className="chart-count-zero" x1={PAD.left} x2={WIDTH - PAD.right} y1={zeroTcY} y2={zeroTcY} />
        <text className="chart-axis-label" x={PAD.left - 7} y={PAD.top + 4} textAnchor="end">{signed(Math.round(pnlCeiling), '$')}</text>
        <text className="chart-axis-label" x={PAD.left - 7} y={HEIGHT - PAD.bottom} textAnchor="end">{signed(Math.round(pnlFloor), '$')}</text>
        <text className="chart-axis-label chart-axis-count" x={WIDTH - PAD.right + 7} y={PAD.top + 4}>+{tcLimit} TC</text>
        <text className="chart-axis-label chart-axis-count" x={WIDTH - PAD.right + 7} y={HEIGHT - PAD.bottom}>−{tcLimit} TC</text>
        <path className="chart-line chart-line-pnl" d={pathFor(hands, xFor, pnlY)} />
        <path className="chart-line chart-line-count" d={pathFor(hands, xFor, tcY)} />
        {hands.map((hand, index) => (
          <g key={hand.handNumber}>
            <circle className="chart-point-pnl" cx={xFor(index)} cy={pnlY(hand)} r="3.6">
              <title>Hand {hand.handNumber}: cumulative P&amp;L {signed(hand.cumulativePnl, '$')}; result {signed(hand.net, '$')}</title>
            </circle>
            <circle className="chart-point-count" cx={xFor(index)} cy={tcY(hand)} r="3">
              <title>Hand {hand.handNumber}: true count {signed(hand.trueCount)}</title>
            </circle>
          </g>
        ))}
        <text className="chart-axis-caption" x={WIDTH / 2} y={HEIGHT - 4} textAnchor="middle">
          Settled hands ({hands.length})
        </text>
      </svg>
    </figure>
  );
}
