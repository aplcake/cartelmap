# Cartel Scraper (Standalone, Local-Only)

A rebuilt standalone scraper that is **not integrated into the website build/runtime**.

It fetches article pages, extracts readable text, and asks an LLM to return structured intelligence JSON.

## Variants

- **Anthropic version**: `scrape-anthropic.mjs` (uses `ANTHROPIC_API_KEY`)
- **OpenAI version**: `scrape-openai.mjs` (uses `OPENAI_API_KEY`)

## Install

```bash
cd cartel-scraper
npm install
cp .env.example .env
# fill in API key(s)
```

## Usage

Single URL:

```bash
npm run anthropic -- --url "https://example.com/article"
npm run openai -- --url "https://example.com/article"
```

Multiple URLs:

```bash
npm run anthropic -- --url "https://a.com" --url "https://b.com"
npm run openai -- --url "https://a.com" --url "https://b.com"
```

From file (`urls.txt`, one URL per line):

```bash
npm run anthropic -- --file urls.txt
npm run openai -- --file urls.txt
```

Optional flags:

- `--model <id>` override default model
- `--outdir <dir>` output directory (default: `./output`)
- `--maxChars <n>` max extracted chars sent to LLM (default: `24000`)

## Output

For each URL, it writes:

- `output/<slug>.json` (structured extraction)

And always writes:

- `output/_run-summary.json`

## Notes

- This tool is intentionally separate from Next.js app code.
- No automatic deployment is performed by this script.
- Respect source terms of service when scraping.
