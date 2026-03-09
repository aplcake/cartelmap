# cartel-scraper

Standalone scraper — lives completely outside the Next.js app.

## Setup (one-time)

```bash
cd cartel-scraper
npm install
export ANTHROPIC_API_KEY=sk-ant-...
```

## Run

```bash
npm run scrape          # full run, 40 articles → writes new-entries-YYYY-MM-DD.ts
npm run scrape:quick    # only 10 articles, good for testing
npm run scrape:dry      # prints output without writing files
```

## After running

1. Open `new-entries-YYYY-MM-DD.ts`
2. Review each entry — check that descriptions make sense, kill counts are right
3. ⚠️ Spot-check a few `lat`/`lng` values on Google Maps — Claude sometimes drifts slightly
4. Paste the relevant entries into `cartel-atlas/lib/data.ts` in the right array

## What it scrapes

RSS feeds from El Universal, Milenio, InSight Crime, Proceso, Animal Político, Sin Embargo, Zeta Tijuana, Reforma, NTR Guadalajara — plus page scrapes of Borderland Beat, Riodoce, Noroeste, and El Debate.

Articles are filtered by ~50 cartel-related keywords before touching Claude, so only relevant pieces get processed.

## Cost

A full 40-article run uses claude-opus-4-6 and costs roughly $0.15–$0.40 depending on article length.
