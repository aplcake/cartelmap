import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseArgs(argv) {
  const args = { urls: [], outdir: 'output', maxChars: 24000, model: process.env.SCRAPER_MODEL_OPENAI || 'gpt-4o-mini' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--url') args.urls.push(argv[++i]);
    else if (a === '--file') args.file = argv[++i];
    else if (a === '--outdir') args.outdir = argv[++i];
    else if (a === '--maxChars') args.maxChars = Number(argv[++i]);
    else if (a === '--model') args.model = argv[++i];
  }
  return args;
}

function slugify(s) {
  return s.toLowerCase().replace(/https?:\/\//g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'result';
}

async function readUrlsFromFile(file) {
  const raw = await fs.readFile(file, 'utf8');
  return raw.split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#'));
}

async function fetchArticleText(url, maxChars) {
  const { data } = await axios.get(url, { timeout: 30000, maxRedirects: 5, headers: { 'User-Agent': 'cartel-scraper/2.0 (+local research tool)' } });
  const $ = cheerio.load(data);
  $('script,style,noscript,svg,canvas,header,footer').remove();
  const title = $('title').first().text().trim() || null;
  const articleText = $('article').text().trim();
  const fallbackText = $('body').text().trim();
  const text = (articleText || fallbackText).replace(/\s+/g, ' ').slice(0, maxChars);
  return { title, text };
}

function promptFor(url, title, text) {
  return `Extract structured intelligence from the article below and return ONLY valid JSON:\n{\n  "source_url": string,\n  "headline": string|null,\n  "event_date": string|null,\n  "locations": string[],\n  "actors": string[],\n  "organizations": string[],\n  "summary": string,\n  "key_claims": string[],\n  "confidence": "low"|"medium"|"high"\n}\n\nConstraints:\n- No markdown\n- No extra keys\n- summary <= 120 words\n\nURL: ${url}\nTitle: ${title ?? 'null'}\nText:\n${text}`;
}

async function run() {
  const args = parseArgs(process.argv);
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('Missing OPENAI_API_KEY in .env');
    process.exit(1);
  }

  if (args.file) args.urls.push(...(await readUrlsFromFile(args.file)));
  args.urls = [...new Set(args.urls.filter(Boolean))];
  if (args.urls.length === 0) {
    console.error('Provide at least one --url or --file');
    process.exit(1);
  }

  await fs.mkdir(args.outdir, { recursive: true });
  const client = new OpenAI({ apiKey: key });
  const summary = [];

  for (const url of args.urls) {
    try {
      const { title, text } = await fetchArticleText(url, args.maxChars);
      const response = await client.chat.completions.create({
        model: args.model,
        temperature: 0,
        messages: [
          { role: 'system', content: 'You are a strict JSON extraction engine.' },
          { role: 'user', content: promptFor(url, title, text) },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      const outPath = path.join(args.outdir, `${slugify(url)}.json`);
      await fs.writeFile(outPath, JSON.stringify(parsed, null, 2));
      summary.push({ url, ok: true, outPath });
      console.log(`✓ ${url} -> ${outPath}`);
    } catch (err) {
      summary.push({ url, ok: false, error: String(err?.message || err) });
      console.error(`✗ ${url} -> ${String(err?.message || err)}`);
    }
  }

  const summaryPath = path.join(args.outdir, '_run-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Run summary: ${summaryPath}`);
}

run();
