export const BET_UNIT = 25;
export const TABLE_MAX_BET = 10000;

export const isValidTableWager = wager => (
  Number.isFinite(wager)
  && wager >= BET_UNIT
  && wager <= TABLE_MAX_BET
  && wager % BET_UNIT === 0
);

export const getRecommendedWager = (trueCount) => {
  if (trueCount >= 5) return 200;
  if (trueCount === 4) return 150;
  if (trueCount === 3) return 100;
  if (trueCount === 2) return 50;
  return BET_UNIT;
};

export const BET_RAMP_GUIDE_ROWS = [
  ['+1 or lower', '$25', '1 unit'],
  ['+2', '$50', '2 units'],
  ['+3', '$100', '4 units'],
  ['+4', '$150', '6 units'],
  ['+5 or higher', '$200', '8 units'],
];
