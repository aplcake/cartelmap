# Cartel Atlas — News Scraper

Scrapes Mexican and international news sources, extracts structured cartel event data
using Claude, and outputs ready-to-paste entries for `lib/data.ts`.

## Setup (one-time)

```bash
cd cartel-atlas

# Install scraper dependencies
npm install axios cheerio @anthropic-ai/sdk rss-parser
npm install -D ts-node typescript

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```bash
# Full run — processes up to 40 articles, writes output file
npx ts-node scripts/scrape-cartel-news.ts

# Limit to 10 articles (faster, good for testing)
npx ts-node scripts/scrape-cartel-news.ts --limit 10

# Dry run — prints entries without writing files
npx ts-node scripts/scrape-cartel-news.ts --dry-run

# Combine
npx ts-node scripts/scrape-cartel-news.ts --limit 20 --dry-run
```

## Output

Each run creates two files in `scripts/`:

| File | Contents |
|------|----------|
| `new-entries-YYYY-MM-DD.ts` | Ready-to-paste TypeScript entries |
| `scrape-log-YYYY-MM-DD.json` | Full log: articles processed, raw Claude output |

## Workflow

1. **Run the scraper** (`npm run scrape` or `npx ts-node ...`)
2. **Review** `scripts/new-entries-YYYY-MM-DD.ts`
3. **Copy-paste** verified entries into the right arrays in `lib/data.ts`
4. **Check** for any lat/lng that Claude guessed wrong (cross-check on Google Maps)
5. Run the app and verify entries appear on the map

## Sources scraped

### RSS (most reliable)
- El Universal — Seguridad
- Milenio — Nacional
- InSight Crime
- Proceso
- Animal Político
- Sin Embargo
- Zeta Tijuana
- El Sol de México
- Reforma — Policiaca

### Scraped pages (fallback)
- Noroeste (Sinaloa-focused, very good for Culiacán/Mazatlán)
- El Debate (Sinaloa)
- Borderland Beat (English cartel beat, translates Mexican sources)
- Riodoce (Culiacán — best source for Sinaloa civil war coverage)
- NTR Guadalajara (CJNG territory)

## Adding new sources

Add to the `SOURCES` array in `scrape-cartel-news.ts`:

```ts
{
  name: 'Your Source Name',
  type: 'rss',           // or 'scrape'
  url: 'https://...',
  lang: 'es',            // or 'en'
  // for type:'scrape' only:
  articleSelector: 'article a',
  contentSelector: '.article-body',
}
```

## npm script shortcut

Add to `package.json`:
```json
"scripts": {
  "scrape": "ts-node scripts/scrape-cartel-news.ts",
  "scrape:dry": "ts-node scripts/scrape-cartel-news.ts --dry-run"
}
```

## Notes

- The scraper uses `claude-opus-4-6` for extraction — the most accurate at structured data from messy Spanish-language news
- Each run costs roughly $0.10–$0.50 in API credits depending on article count
- Articles are filtered by cartel-related keywords before sending to Claude — only ~30-40% of articles from each source typically pass the filter
- Claude is prompted to skip anything without specific facts (deaths, kg, names) so you don't get vague entries
- IDs are auto-deduplicated against existing `data.ts` entries so re-running never creates duplicates
- Always verify lat/lng coordinates — Claude sometimes approximates city centers when exact locations aren't in the article
