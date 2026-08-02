const result = (action, rule, type = 'Full Hi-Lo Deviation') => ({ action, rule, type });

const isHard = ({ isPair, isSoft }) => !isPair && !isSoft;

export const HI_LO_DEVIATIONS = [
  {
    category: 'Surrender',
    matchup: '16 vs 8',
    index: 'Surrender at TC +4+',
    when: context => context.allowSurrender && isHard(context) && context.total === 16 && context.dealer === 8 && context.trueCount >= 4,
    play: result('surrender', 'Surrender hard 16 vs 8 at TC +4 or higher.'),
  },
  {
    category: 'Surrender',
    matchup: '16 vs 9',
    index: 'Hit at TC −1 or lower',
    when: context => context.allowSurrender && isHard(context) && context.total === 16 && context.dealer === 9 && context.trueCount <= -1,
    play: result('hit', 'At TC −1 or lower, hit hard 16 vs 9 instead of surrendering.'),
  },
  {
    category: 'Surrender',
    matchup: '16 vs 10',
    index: 'Hit at TC −3 or lower',
    when: context => context.allowSurrender && isHard(context) && context.total === 16 && context.dealer === 10 && context.trueCount <= -3,
    play: result('hit', 'At the extended TC −3 index or lower, hit hard 16 vs 10 instead of surrendering.', 'Extended Hi-Lo Deviation'),
  },
  {
    category: 'Surrender',
    matchup: '15 vs 9',
    index: 'Surrender at TC +2+',
    when: context => context.allowSurrender && isHard(context) && context.total === 15 && context.dealer === 9 && context.trueCount >= 2,
    play: result('surrender', 'Surrender hard 15 vs 9 at TC +2 or higher.'),
  },
  {
    category: 'Surrender',
    matchup: '15 vs 10',
    index: 'Hit at a negative running count',
    when: context => context.allowSurrender && isHard(context) && context.total === 15 && context.dealer === 10 && context.zeroIndexCount < 0,
    play: result('hit', 'With a negative running count, hit hard 15 vs 10 instead of surrendering.'),
  },
  {
    category: 'Surrender',
    matchup: '15 vs Ace',
    index: 'Surrender at TC −1+',
    when: context => context.allowSurrender && isHard(context) && context.total === 15 && context.dealer === 11 && context.trueCount >= -1,
    play: result('surrender', 'Surrender hard 15 vs Ace at TC −1 or higher in this H17 game.'),
  },
  {
    category: 'Surrender',
    matchup: '14 vs 10',
    index: 'Surrender at TC +3+',
    when: context => context.allowSurrender && isHard(context) && context.total === 14 && context.dealer === 10 && context.trueCount >= 3,
    play: result('surrender', 'Surrender hard 14 vs 10 at TC +3 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '16 vs 9',
    index: 'Stand at TC +4+',
    when: context => !context.allowSurrender && isHard(context) && context.total === 16 && context.dealer === 9 && context.trueCount >= 4,
    play: result('stand', 'When surrender is unavailable, stand on hard 16 vs 9 at TC +4 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '16 vs 10',
    index: 'Stand at RC 0+',
    when: context => !context.allowSurrender && isHard(context) && context.total === 16 && context.dealer === 10 && context.zeroIndexCount >= 0,
    play: result('stand', 'When surrender is unavailable, stand on hard 16 vs 10 at a running count of 0 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '16 vs Ace',
    index: 'Stand at TC +3+',
    when: context => !context.allowSurrender && isHard(context) && context.total === 16 && context.dealer === 11 && context.trueCount >= 3,
    play: result('stand', 'When surrender is unavailable, stand on hard 16 vs Ace at TC +3 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '15 vs 10',
    index: 'Stand at TC +4+',
    when: context => !context.allowSurrender && isHard(context) && context.total === 15 && context.dealer === 10 && context.trueCount >= 4,
    play: result('stand', 'When surrender is unavailable, stand on hard 15 vs 10 at TC +4 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '15 vs Ace',
    index: 'Stand at TC +5+',
    when: context => !context.allowSurrender && isHard(context) && context.total === 15 && context.dealer === 11 && context.trueCount >= 5,
    play: result('stand', 'When surrender is unavailable, stand on hard 15 vs Ace at TC +5 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '13 vs 2',
    index: 'Hit at TC −1 or lower',
    when: context => isHard(context) && context.total === 13 && context.dealer === 2 && context.trueCount <= -1,
    play: result('hit', 'Hit hard 13 vs 2 at TC −1 or lower.'),
  },
  {
    category: 'Hard totals',
    matchup: '12 vs 2',
    index: 'Stand at TC +3+',
    when: context => isHard(context) && context.total === 12 && context.dealer === 2 && context.trueCount >= 3,
    play: result('stand', 'Stand on hard 12 vs 2 at TC +3 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '12 vs 3',
    index: 'Stand at TC +2+',
    when: context => isHard(context) && context.total === 12 && context.dealer === 3 && context.trueCount >= 2,
    play: result('stand', 'Stand on hard 12 vs 3 at TC +2 or higher.'),
  },
  {
    category: 'Hard totals',
    matchup: '12 vs 4',
    index: 'Hit at a negative running count',
    when: context => isHard(context) && context.total === 12 && context.dealer === 4 && context.zeroIndexCount < 0,
    play: result('hit', 'Hit hard 12 vs 4 whenever the running count is negative.'),
  },
  {
    category: 'Doubling',
    matchup: '10 vs 10',
    index: 'Double at TC +4+',
    when: context => isHard(context) && context.total === 10 && context.dealer === 10 && context.trueCount >= 4,
    play: result('double', 'Double hard 10 vs 10 at TC +4 or higher.'),
  },
  {
    category: 'Doubling',
    matchup: '10 vs Ace',
    index: 'Double at TC +3+',
    when: context => isHard(context) && context.total === 10 && context.dealer === 11 && context.trueCount >= 3,
    play: result('double', 'Double hard 10 vs Ace at TC +3 or higher.'),
  },
  {
    category: 'Doubling',
    matchup: '9 vs 2',
    index: 'Double at TC +1+',
    when: context => isHard(context) && context.total === 9 && context.dealer === 2 && context.trueCount >= 1,
    play: result('double', 'Double hard 9 vs 2 at TC +1 or higher.'),
  },
  {
    category: 'Doubling',
    matchup: '9 vs 7',
    index: 'Double at TC +3+',
    when: context => isHard(context) && context.total === 9 && context.dealer === 7 && context.trueCount >= 3,
    play: result('double', 'Double hard 9 vs 7 at TC +3 or higher.'),
  },
  {
    category: 'Doubling',
    matchup: '8 vs 6',
    index: 'Double at TC +2+',
    when: context => isHard(context) && context.total === 8 && context.dealer === 6 && context.trueCount >= 2,
    play: result('double', 'Double hard 8 vs 6 at TC +2 or higher.'),
  },
  {
    category: 'Soft totals',
    matchup: 'A,8 vs 4',
    index: 'Double at TC +3+',
    when: context => context.isSoft && context.total === 19 && context.dealer === 4 && context.trueCount >= 3,
    play: result('double', 'Double soft 19 vs 4 at TC +3 or higher.'),
  },
  {
    category: 'Soft totals',
    matchup: 'A,8 vs 5',
    index: 'Double at TC +1+',
    when: context => context.isSoft && context.total === 19 && context.dealer === 5 && context.trueCount >= 1,
    play: result('double', 'Double soft 19 vs 5 at TC +1 or higher.'),
  },
  {
    category: 'Soft totals',
    matchup: 'A,8 vs 6',
    index: 'Stand at a negative running count',
    when: context => context.isSoft && context.total === 19 && context.dealer === 6 && context.zeroIndexCount < 0,
    play: result('stand', 'Stand on soft 19 vs 6 when the running count is negative; otherwise double.'),
  },
  {
    category: 'Soft totals',
    matchup: 'A,6 vs 2',
    index: 'Double at TC +1+',
    when: context => context.isSoft && context.total === 17 && context.dealer === 2 && context.trueCount >= 1,
    play: result('double', 'Double soft 17 vs 2 at TC +1 or higher.'),
  },
  {
    category: 'Splitting',
    matchup: '10,10 vs 4',
    index: 'Split at TC +6+',
    when: context => context.isPairOfTens && context.dealer === 4 && context.trueCount >= 6,
    play: result('split', 'Split tens vs 4 at TC +6 or higher.'),
  },
  {
    category: 'Splitting',
    matchup: '10,10 vs 5',
    index: 'Split at TC +5+',
    when: context => context.isPairOfTens && context.dealer === 5 && context.trueCount >= 5,
    play: result('split', 'Split tens vs 5 at TC +5 or higher.'),
  },
  {
    category: 'Splitting',
    matchup: '10,10 vs 6',
    index: 'Split at TC +4+',
    when: context => context.isPairOfTens && context.dealer === 6 && context.trueCount >= 4,
    play: result('split', 'Split tens vs 6 at TC +4 or higher.'),
  },
];

export const getDeviationPlay = context => (
  HI_LO_DEVIATIONS.find(deviation => deviation.when(context))?.play || null
);

export const DEVIATION_GUIDE_GROUPS = [
  {
    title: 'Insurance',
    rows: [['Insurance / even money', 'Take at TC +3+']],
  },
  ...['Surrender', 'Hard totals', 'Doubling', 'Soft totals', 'Splitting'].map(category => ({
    title: category,
    rows: HI_LO_DEVIATIONS
      .filter(deviation => deviation.category === category)
      .map(deviation => [deviation.matchup, deviation.index]),
  })),
];
