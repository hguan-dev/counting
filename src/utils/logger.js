export class GameLogger {
  constructor() {
    this.logs = [];
  }

  log(action, details) {
    this.logs.push({ timestamp: new Date().toISOString(), action, details });
  }

  downloadCSV() {
    const headers = "Timestamp,Action,Details\n";
    const rows = this.logs.map(l => `"${l.timestamp}","${l.action}","${l.details}"`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'blackjack_session_log.csv');
    a.click();
  }
}
