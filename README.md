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
- Same-bet next round and detailed CSV session logs.
- Cards are dealt at 0.8 seconds each by default, for the player, the dealer, and every
  companion seat, so there is time to count. Deal speed is adjustable in Settings.

## Training and analytics

- H17 basic strategy plus a complete in-app Hi-Lo deviation index, including surrender,
  hard totals, doubles, soft doubles, pair splits, insurance, and even-money indices.
- Strategy Guard warns before an off-strategy play. Its hint reveals and highlights the
  count-adjusted recommendation.
- A $25-unit bet ramp: $25 through TC +1, $50 at +2, $100 at +3, $150 at +4, and $200
  at +5 or higher.
- Optional running count, true count, and estimated decks-remaining display.
- Live realized session P&L reconciled to stack minus starting bankroll and reloads,
  with unresolved wagers excluded, plus strategy accuracy from graded decisions.
- A per-settled-hand cumulative P&L chart with true count on a labeled independent axis.
- A strategy quiz that deals only close calls and count deviations, the spots where
  the best play beats the next best by less than 0.08 units.

Asking for a hint or triggering a strategy warning counts as one mistake. A warned
decision is never double-counted if the player then reveals the hint or plays anyway.

## Keyboard shortcuts

Keyboard shortcuts are `H` hit, `S` stand, `D` double, `P` split, `R` surrender,
`I` insurance/even money, `C` count, and `F` fullscreen.

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
post-split turn order, natural blackjack, keyboard shortcuts, card assets, quiz spot
selection, and the bet spread optimizer.

## Card artwork

Card faces are bundled from [Webisso Playing Cards](https://github.com/Webisso/playing-cards),
an MIT-licensed set of SVG playing-card assets. The original license is included at
`public/cards/LICENSE.txt`. Assets are self-hosted so play does not depend on a third-party
image server, and the UI still includes a built-in text-card fallback.

## Deployment

Pushes to `main` run the GitHub Actions workflow in `.github/workflows/deploy-pages.yml`.
It builds the Vite app with the `/counting/` base path and publishes the `dist` artifact
to GitHub Pages. No backend or shared server state is required, so multiple players can
use the site simultaneously; each session stays in that player's browser.

Count Lab is a practice tool, not gambling or financial advice. Casino rules and
counting indices vary, so verify the rules of the game you are training for.
