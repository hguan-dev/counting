import { useState } from 'react';
import PlayingCard from './PlayingCard';
import { calculateTotal, isSoftHand } from '../utils/strategyEngine';
import { buildQuizScenario } from '../utils/quizScenarios';
import { computeActionEvs, formatEv } from '../utils/actionEv';

export default function StrategyQuiz({ rules }) {
  const [scenario, setScenario] = useState(() => buildQuizScenario(rules));
  const [answer, setAnswer] = useState(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const { cards, dealerCard, evaluation, trueCount } = scenario;
  const isPair = cards[0].numericValue === cards[1].numericValue;
  const total = calculateTotal(cards);
  const soft = isSoftHand(cards);
  const isCorrect = answer === evaluation.action;
  const evReport = answer
    ? computeActionEvs({
      canDouble: true,
      canSplit: isPair,
      canSurrender: rules?.lateSurrender !== false,
      dealerUpCard: dealerCard,
      doubleAfterSplit: rules?.doubleAfterSplit !== false,
      hitsSoft17: rules?.dealerHitsSoft17 !== false,
      playerCards: cards,
      trueCount,
    })
    : null;

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
    setScenario(buildQuizScenario(rules));
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
          {evReport && (
            <ul className="quiz-evs" aria-label="Expected value of each action at this count">
              {Object.entries(evReport.evs)
                .sort((a, b) => b[1] - a[1])
                .map(([action, value]) => (
                  <li key={action} className={action === evReport.best ? 'is-best' : ''}>
                    <span>{action}</span>
                    <b>{formatEv(value)}</b>
                  </li>
                ))}
              <li className="is-note"><span>Dealer busts</span><b>{Math.round(evReport.dealerBust * 100)}%</b></li>
            </ul>
          )}
          <button className="quiz-next" autoFocus onClick={nextHand}>Next hand</button>
        </div>
      )}
    </div>
  );
}
