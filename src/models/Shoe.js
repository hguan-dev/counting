import { Card } from './Card';

const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class Shoe {
  constructor(decks = 6, penetration = 0.75) {
    this.decks = decks;
    this.penetration = penetration;
    this.cards = [];
    this.visibleRunningCount = 0;
    this.buildAndShuffle();
  }

  configure(decks, penetration) {
    if (decks === this.decks && penetration === this.penetration) return false;
    this.decks = decks;
    this.penetration = penetration;
    this.buildAndShuffle();
    return true;
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

  get totalCards() {
    return this.decks * 52;
  }

  get trueCount() {
    return Math.round(this.visibleRunningCount / Math.max(1, this.decksRemaining));
  }

  get decksRemaining() {
    return this.cards.length / 52;
  }

  get cutCardPosition() {
    return Math.round((1 - this.penetration) * this.totalCards);
  }

  needsShuffle() {
    return this.cards.length <= this.cutCardPosition;
  }
}
