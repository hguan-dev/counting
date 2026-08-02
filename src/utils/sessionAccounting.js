export const STARTING_BANKROLL = 1000;

export const getUnresolvedHandWager = (spots = []) => spots.reduce(
  (spotTotal, spot) => spotTotal + (spot.subHands || []).reduce(
    (handTotal, hand) => handTotal + (hand.outcome ? 0 : Number(hand.bet) || 0),
    0,
  ),
  0,
);

export const calculateRealizedPnl = ({
  bankroll,
  buyIns = 0,
  unresolvedWager = 0,
  startingBankroll = STARTING_BANKROLL,
}) => (
  Number(bankroll) + Number(unresolvedWager)
  - (Number(startingBankroll) + Number(buyIns))
);
