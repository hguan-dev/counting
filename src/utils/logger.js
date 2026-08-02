const CSV_COLUMNS = [
  ['timestamp', 'Timestamp'],
  ['round', 'Round'],
  ['action', 'Event'],
  ['spot', 'Spot'],
  ['hand', 'Hand'],
  ['playerCards', 'Player Cards'],
  ['playerTotal', 'Player Total'],
  ['dealerCards', 'Dealer Cards'],
  ['dealerTotal', 'Dealer Total'],
  ['wager', 'Wager'],
  ['insurance', 'Insurance'],
  ['outcome', 'Outcome'],
  ['returnAmount', 'Return'],
  ['net', 'Net'],
  ['runningCount', 'Running Count'],
  ['trueCount', 'True Count'],
  ['decksRemaining', 'Decks Remaining'],
  ['bankroll', 'Bankroll'],
  ['details', 'Details'],
];

const escapeCSV = value => (
  `"${String(value ?? '').replace(/"/g, '""')}"`
);

export class GameLogger {
  constructor(now = () => new Date().toISOString()) {
    this.logs = [];
    this.currentRound = 0;
    this.now = now;
  }

  log(action, details, context = {}) {
    if (action === 'DEAL') this.currentRound += 1;
    const entry = {
      timestamp: this.now(),
      round: context.round ?? this.currentRound,
      action,
      details,
      ...context,
    };
    this.logs.push(entry);
    return entry;
  }

  toCSV() {
    const headers = CSV_COLUMNS.map(([, label]) => escapeCSV(label)).join(',');
    const rows = this.logs.map(entry => (
      CSV_COLUMNS.map(([key]) => escapeCSV(entry[key])).join(',')
    ));
    return [headers, ...rows].join('\n');
  }

  downloadCSV() {
    const blob = new Blob([this.toCSV()], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.setAttribute('href', url);
    anchor.setAttribute('download', 'blackjack_session_log.csv');
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
}
