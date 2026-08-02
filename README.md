# Count Lab

Count Lab is a responsive, casino-style blackjack and Hi-Lo card-counting trainer built
with React and Vite. The table uses six decks, dealer hits soft 17, blackjack pays 3:2,
insurance pays 2:1, and late surrender is available.

Play the current build at [hguan-dev.github.io/counting](https://hguan-dev.github.io/counting/).

## Game features

- One or two independently wagered spots, with splitting and resplitting up to four hands.
- Hit, stand, double face up, double face down with a peel reveal, split, late surrender,
  insurance, and per-hand even money.
- Self-hosted SVG card faces, overlapping casino-style layouts, chip stacks, sounds,
  reshuffle animation, fullscreen mode, and responsive mobile sizing.
- Practice bankroll reloads and wagers from $25 to $10,000 in $25 increments.
- Same-bet next round, doubled-bet shortcuts, detailed CSV session logs, and celebratory
  or reaction animations.

## Training and analytics

- H17 basic strategy plus a complete in-app Hi-Lo deviation index, including surrender,
  hard totals, doubles, soft doubles, pair splits, insurance, and even-money indices.
- Strategy Guard warns before an off-strategy play. Its hint reveals and highlights the
  count-adjusted recommendation.
- A $25-unit bet ramp: $25 through TC +1, $50 at +2, $100 at +3, $150 at +4, and $200
  at +5 or higher.
- Optional running count, true count, and estimated decks-remaining display.
- Live realized session P&L and strategy accuracy, calculated from graded decisions.
- A per-settled-hand cumulative P&L chart with true count on a labeled independent axis.

Asking for a hint or triggering a strategy warning counts as one mistake. A warned
decision is never double-counted if the player then reveals the hint or plays anyway.

## Voice mode and accessibility

Voice mode is off by default and asks for browser microphone permission when enabled.
It supports the same essential operations as the controls: configure one or two spots
and their wagers, deal, hit, stand, double, split, surrender, insurance, even money,
reload, move between rounds, toggle Count/Guide/dealer voice/sound/fullscreen, export,
request a hint, or ask for the count, bankroll, and status. Player speech interrupts
dealer speech.

Useful conversational aliases include:

- `run it`, `running it`, `Reddit`, or `again`: immediately deal the next round at the
  same wagers.
- `next`: return to wager selection; `stack it up`: double the previous wager and deal.
- `good`, `I'm good`, `stay`, or `Stan`: stand.
- `face up` or `face down`: choose the corresponding double treatment.
- `sorry` or `my bad`: dismiss a strategy warning and use the recommendation.
- `go back`: close the warning without revealing or highlighting the recommendation.
- `nah`: keep the warned choice and play anyway.
- `hint`: highlight and explain the count-adjusted optimal action.

Keyboard shortcuts are `H` hit, `S` stand, `D` double, `P` split, `R` surrender,
`I` insurance/even money, `C` count, `V` voice mode, and `F` fullscreen.

## Development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm test
npm run lint
npm run build
```

The test suite covers hand totals, H17 basic strategy, Hi-Lo deviation thresholds,
bet sizing, shoe behavior, split/resplit eligibility, surrender, split-ace behavior,
post-split turn order, natural blackjack, keyboard shortcuts, card assets, dealer
speech, Kokoro voice setup, and speech-recognition command routing.

## Card artwork

Card faces are bundled from [Webisso Playing Cards](https://github.com/Webisso/playing-cards),
an MIT-licensed set of SVG playing-card assets. The original license is included at
`public/cards/LICENSE.txt`. Assets are self-hosted so play does not depend on a third-party
image server, and the UI still includes a built-in text-card fallback.

## Voice model

Dealer speech uses Kokoro in the browser with the Heart voice selected by default.
Common table phrases are warmed during initialization to reduce first-use latency.
Model files are cached by the browser after their first successful load.

## Deployment

Pushes to `main` run the GitHub Actions workflow in `.github/workflows/deploy-pages.yml`.
It builds the Vite app with the `/counting/` base path and publishes the `dist` artifact
to GitHub Pages. No backend or shared server state is required, so multiple players can
use the site simultaneously; each session stays in that player's browser.

Count Lab is a practice tool, not gambling or financial advice. Casino rules and
counting indices vary, so verify the rules of the game you are training for.
