import { useState } from 'react';
import { Card } from '../models/Card';
import PlayingCard from './PlayingCard';
import { calculateTotal, getDetailedPlay, isSoftHand } from '../utils/strategyEngine';

const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

const randomItem = items => items[Math.floor(Math.random() * items.length)];
const randomCard = value => new Card(randomItem(SUITS), value ?? randomItem(VALUES));

const buildScenario = (rules) => {
  for (;;) {
    const trueCount = Math.floor(Math.random() * 9) - 3;
    const dealerCard = randomCard();
    const roll = Math.random();
    let cards;
    if (roll < 0.25) {
      const value = randomItem(VALUES);
      cards = [randomCard(value), randomCard(value)];
    } else if (roll < 0.5) {
      cards = [randomCard('A'), randomCard(randomItem(['2', '3', '4', '5', '6', '7', '8', '9']))];
    } else {
      cards = [randomCard(), randomCard()];
    }
    if (calculateTotal(cards) === 21) continue;

    const evaluation = getDetailedPlay(cards, dealerCard, trueCount, { rules });
    return { cards, dealerCard, evaluation, trueCount };
  }
};

export default function StrategyQuiz({ rules }) {
  const [scenario, setScenario] = useState(() => buildScenario(rules));
  const [answer, setAnswer] = useState(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const { cards, dealerCard, evaluation, trueCount } = scenario;
  const isPair = cards[0].numericValue === cards[1].numericValue;
  const total = calculateTotal(cards);
  const soft = isSoftHand(cards);
  const isCorrect = answer === evaluation.action;

  const choices = [
    ['hit', 'Hit'],
    ['stand', 'Stand'],
    ['double', 'Double'],
    ...(isPair ? [['split', 'Split']] : []),
    ...(rules?.lateSurrender === false ? [] : [['surrender', 'Surrender']]),
  ];

  const choose = (action) => {
    if (answer) return;
    setAnswer(action);
    const correct = action === evaluation.action;
    setStreak(current => (correct ? current + 1 : 0));
    setScore(current => ({
      correct: current.correct + (correct ? 1 : 0),
      total: current.total + 1,
    }));
  };

  const nextHand = () => {
    setScenario(buildScenario(rules));
    setAnswer(null);
  };

  return (
    <div className="quiz-drill">
      <div className="quiz-scoreline" aria-label={`Score ${score.correct} of ${score.total}, streak ${streak}`}>
        <span><em>Score</em><b>{score.correct}/{score.total}</b></span>
        <span><em>Streak</em><b>{streak}</b></span>
      </div>

      <div className="quiz-table">
        <div className="quiz-count-badge">
          True count <b>{trueCount > 0 ? `+${trueCount}` : trueCount}</b>
        </div>
        <div className="quiz-row">
          <span className="quiz-row-label">Dealer shows</span>
          <div className="quiz-cards">
            <PlayingCard card={dealerCard} compact animateDeal={false} />
          </div>
        </div>
        <div className="quiz-row">
          <span className="quiz-row-label">
            You have {soft ? `soft ${total}` : isPair ? `a pair (${total})` : total}
          </span>
          <div className="quiz-cards">
            {cards.map((card, index) => (
              <PlayingCard key={`${card.value}${card.suit}${index}`} card={card} compact animateDeal={false} />
            ))}
          </div>
        </div>
      </div>

      {!answer ? (
        <div className="quiz-choices">
          {choices.map(([action, label]) => (
            <button key={action} onClick={() => choose(action)}>{label}</button>
          ))}
        </div>
      ) : (
        <div className={`quiz-feedback ${isCorrect ? 'is-correct' : 'is-missed'}`}>
          <strong>
            {isCorrect
              ? `Correct — ${evaluation.action}.`
              : `Not quite. The play is ${evaluation.action}.`}
          </strong>
          <span className="quiz-rule"><b>{evaluation.type}:</b> {evaluation.rule}</span>
          <button className="quiz-next" autoFocus onClick={nextHand}>Next hand</button>
        </div>
      )}
    </div>
  );
}
