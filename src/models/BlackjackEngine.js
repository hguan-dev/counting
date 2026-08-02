// src/models/BlackjackEngine.js
import { Shoe } from './Shoe';

export class BlackjackEngine {
  constructor(decks = 6) {
    this.shoe = new Shoe(decks);
    this.bankroll = 1000;
    this.initialBankroll = 1000;
  }

  get realizedPnl() {
    return this.bankroll - this.initialBankroll;
  }
}
