# Blackjack Trainer

A responsive blackjack basic-strategy and card-counting trainer built with React and Vite.

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

The test suite covers hand totals, shoe behavior, strategy decisions, split eligibility,
split-ace behavior, post-split turn order, and natural-blackjack classification.

## Card artwork

Card faces are bundled from [Webisso Playing Cards](https://github.com/Webisso/playing-cards),
an MIT-licensed set of SVG playing-card assets. The original license is included at
`public/cards/LICENSE.txt`. Assets are self-hosted so play does not depend on a third-party
image server, and the UI still includes a built-in text-card fallback.
