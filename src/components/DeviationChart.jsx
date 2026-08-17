import { HI_LO_DEVIATIONS } from '../utils/deviations';

const DEALER_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const ROWS = [
  ['16', 'Hard 16'], ['15', 'Hard 15'], ['14', 'Hard 14'], ['13', 'Hard 13'], ['12', 'Hard 12'],
  ['10', 'Hard 10'], ['9', 'Hard 9'], ['8', 'Hard 8'],
  ['A,8', 'Soft 19'], ['A,6', 'Soft 17'],
  ['10,10', 'Pair 10s'],
  ['insurance', 'Insurance'],
];

const ACTION_BY_CODE = { D: 'double', H: 'hit', P: 'split', R: 'surrender', S: 'stand' };

const cellsFor = (hand, dealer, surrenderOffered) => {
  if (hand === 'insurance') {
    return dealer === 11 ? [{ code: 'Take ≥ +3', action: 'insurance', context: null }] : [];
  }
  return HI_LO_DEVIATIONS
    .filter(deviation => deviation.cell.hand === hand && deviation.cell.dealer === dealer)
    .filter(deviation => surrenderOffered || deviation.cell.surrender !== 'with')
    .map(deviation => ({
      action: ACTION_BY_CODE[deviation.cell.code[0]] || 'hit',
      code: deviation.cell.code,
      context: deviation.cell.surrender,
    }))
    // With surrender on the table, show the surrender-game index first and
    // the no-surrender index (for split or three-card hands) as a footnote.
    .sort((a, b) => (a.context === 'with' ? -1 : 0) - (b.context === 'with' ? -1 : 0));
};

export default function DeviationChart({ rules }) {
  const surrenderOffered = rules?.lateSurrender !== false;

  return (
    <div className="strategy-charts deviation-charts">
      <div className="chart-legend" aria-label="Deviation legend">
        <span className="is-stand">S Stand</span>
        <span className="is-hit">H Hit</span>
        <span className="is-double">D Double</span>
        <span className="is-split">P Split</span>
        <span className="is-surrender">R Surrender</span>
        <span className="is-insurance">Take insurance</span>
      </div>
      <p className="section-intro">
        Each cell is the true count at which the play changes from basic strategy — “S ≥ +3” means stand at TC +3 or higher, “H ≤ −1” means hit at TC −1 or lower. RC marks the running-count (index 0) plays.
        {surrenderOffered && ' Grey footnotes are the indices for hands where surrender is not available (split or three-card hands).'}
      </p>
      <div className="chart-scroll">
        <table className="strategy-chart deviation-chart">
          <thead>
            <tr>
              <th aria-label="Your hand" />
              {DEALER_UPCARDS.map(value => <th key={value}>{value === 11 ? 'A' : value}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([hand, label]) => (
              <tr key={hand}>
                <th scope="row">{label}</th>
                {DEALER_UPCARDS.map((dealer) => {
                  const cells = cellsFor(hand, dealer, surrenderOffered);
                  const primary = cells[0];
                  const secondary = cells.slice(1);
                  return (
                    <td key={dealer} className={primary ? `is-${primary.action}` : 'is-empty'}>
                      {primary && <span className="deviation-primary">{primary.code}</span>}
                      {secondary.map(cell => (
                        <small key={cell.code} className="deviation-secondary" title="When surrender is unavailable">
                          {cell.code}
                        </small>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
