export class Card {
  constructor(suit, value) {
    this.suit = suit;
    this.value = value;
  }

  get numericValue() {
    if (['J', 'Q', 'K'].includes(this.value)) return 10;
    if (this.value === 'A') return 11;
    return parseInt(this.value, 10);
  }

  get countValue() {
    const val = this.numericValue;
    if (val >= 2 && val <= 6) return 1;
    if (val >= 7 && val <= 9) return 0;
    if (val >= 10) return -1;
    return 0;
  }
}
