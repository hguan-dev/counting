import { Card } from './Card';

const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const PENETRATION_LIMIT = 1.5 * 52;

export class Shoe {
  constructor(decks = 6) {
    this.decks = decks;
    this.cards = [];
    this.visibleRunningCount = 0;
    this.buildAndShuffle();
  }

  buildAndShuffle() {
    this.cards = [];
    this.visibleRunningCount = 0;
    for (let i = 0; i < this.decks; i++) {
      for (let suit of SUITS) {
        for (let value of VALUES) {
          this.cards.push(new Card(suit, value));
        }
      }
    }
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length === 0) this.buildAndShuffle();
    const raw = this.cards.pop();
    return new Card(raw.suit, raw.value);
  }

  get trueCount() {
    const decksRemaining = Math.max(1, this.cards.length / 52);
    return Math.round(this.visibleRunningCount / decksRemaining);
  }

  needsShuffle() {
    return this.cards.length <= PENETRATION_LIMIT;
  }
}
