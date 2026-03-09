/**
 * cartel-atlas news scraper
 *
 * SETUP (one-time, in this folder):
 *   npm install
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *
 * USAGE:
 *   npm run scrape              # full run, writes output file
 *   npm run scrape:dry          # prints without writing
 *   npm run scrape:quick        # only 10 articles (fast test)
 *   node scrape.js --limit 20   # custom limit
 *
 * OUTPUT:
 *   new-entries-YYYY-MM-DD.ts   ← review & paste into cartel-atlas/lib/data.ts
 *   scrape-log-YYYY-MM-DD.json  ← full run log
 */

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import RSSParser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? parseInt(args[i + 1]) : 40;
})();
const TODAY = new Date().toISOString().slice(0, 10);

// ─── PATH TO YOUR cartel-atlas DATA FILE ─────────────────────────────────────
// Adjust this if your project is in a different location
const DATA_TS_PATH = path.join(__dirname, '..', 'cartel-atlas', 'lib', 'data.ts');

// ─── NEWS SOURCES ─────────────────────────────────────────────────────────────

const SOURCES = [
  // RSS feeds — most reliable, no scraping needed
  { name: 'InSight Crime',        type: 'rss',    url: 'https://insightcrime.org/feed/',                                   lang: 'en' },
  { name: 'El Universal',         type: 'rss',    url: 'https://www.eluniversal.com.mx/rss.xml',                          lang: 'es' },
  { name: 'Milenio Nacional',     type: 'rss',    url: 'https://www.milenio.com/rss',                                     lang: 'es' },
  { name: 'Proceso',              type: 'rss',    url: 'https://www.proceso.com.mx/rss/',                                 lang: 'es' },
  { name: 'Animal Político',      type: 'rss',    url: 'https://animalpolitico.com/feed',                                 lang: 'es' },
  { name: 'Sin Embargo',          type: 'rss',    url: 'https://www.sinembargo.mx/feed',                                  lang: 'es' },
  { name: 'Zeta Tijuana',         type: 'rss',    url: 'https://zetatijuana.com/feed/',                                   lang: 'es' },
  { name: 'El Sol de México',     type: 'rss',    url: 'https://www.elsoldemexico.com.mx/rss.xml',                        lang: 'es' },
  { name: 'Reforma Policiaca',    type: 'rss',    url: 'https://gruporeforma.com/rss/reforma/policiaca.xml',              lang: 'es' },
  { name: 'NTR Guadalajara',      type: 'rss',    url: 'https://ntrgdl.com/feed/',                                       lang: 'es' },

  // Scrape fallbacks — these don't have RSS but have great cartel coverage
  {
    name: 'Borderland Beat',
    type: 'scrape',
    url: 'https://www.borderlandbeat.com',
    lang: 'en',
    articleSelector: '.post-title a, h3.post-title a',
    contentSelector: '.post-body',
  },
  {
    name: 'Riodoce (Culiacán)',
    type: 'scrape',
    url: 'https://riodoce.mx/category/seguridad/',
    lang: 'es',
    articleSelector: 'article h2 a, .entry-title a',
    contentSelector: '.entry-content',
  },
  {
    name: 'Noroeste Sinaloa',
    type: 'scrape',
    url: 'https://www.noroeste.com.mx/seguridad',
    lang: 'es',
    articleSelector: 'article a[href*="/policia"], article a[href*="/seguridad"]',
    contentSelector: '.article-body, .nota-body',
  },
  {
    name: 'El Debate Sinaloa',
    type: 'scrape',
    url: 'https://www.debate.com.mx/policiaca',
    lang: 'es',
    articleSelector: '.item-news a, .news-title a',
    contentSelector: '.content-news, .nota-texto',
  },
];

const KEYWORDS = [
  // Spanish
  'cártel','cartel','narco','sicario','masacre','enfrentamiento','decapitado',
  'ejecutado','secuestro','desaparecido','fosa','fentanilo','droga','decomiso',
  'operativo','detenido','capturado','abatido','balacera','ataque','explosión',
  'mina','dron','bloqueo','extorsión','homicidio','plaza','narcotráfico',
  // English
  'cartel','massacre','gunmen','drug lord','kingpin','fentanyl','trafficker',
  'seizure','extradition','arrest','killed','bodies found','shootout','ambush',
  'beheaded','missing','disappeared','mass grave','roadblock','drone attack',
  // Cartel names
  'CJNG','Jalisco','Sinaloa','Zetas','Chapitos','Mayista','Gulf Cartel',
  'Cártel del Golfo','Templarios','Familia Michoacana','Beltrán Leyva',
  'Santa Rosa de Lima','Cártel del Noreste','Los Viagras',
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isRelevant(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

function loadExistingIds() {
  try {
    const src = fs.readFileSync(DATA_TS_PATH, 'utf8');
    const ids = new Set();
    for (const m of src.matchAll(/id:'([^']+)'/g)) ids.add(m[1]);
    return ids;
  } catch {
    console.warn(`  ⚠ Could not read ${DATA_TS_PATH} — running without dedup`);
    return new Set();
  }
}

async function fetchRSS(source) {
  try {
    const parser = new RSSParser({ timeout: 10000 });
    const feed = await parser.parseURL(source.url);
    return feed.items
      .slice(0, 30)
      .map(item => ({
        title: item.title ?? '',
        url: item.link ?? '',
        date: item.pubDate ?? item.isoDate ?? null,
        snippet: item.contentSnippet ?? item.summary ?? '',
        lang: source.lang,
        source: source.name,
      }))
      .filter(a => isRelevant(a.title + ' ' + (a.snippet ?? '')));
  } catch (err) {
    console.warn(`  ⚠  ${source.name}: ${err.message}`);
    return [];
  }
}

async function fetchScrape(source) {
  if (!source.articleSelector) return [];
  try {
    const res = await axios.get(source.url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CartelAtlasBot/1.0; research)' },
    });
    const $ = cheerio.load(res.data);
    const articles = [];
    $(source.articleSelector).each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      const url = href.startsWith('http') ? href : new URL(href, source.url).href;
      if (title && url && isRelevant(title)) articles.push({
        title, url, lang: source.lang, source: source.name, snippet: '', date: null,
      });
    });
    return articles.slice(0, 20);
  } catch (err) {
    console.warn(`  ⚠  ${source.name}: ${err.message}`);
    return [];
  }
}

async function fetchFullText(url, contentSelector = 'article, .article-body, .entry-content, .nota-body, main p') {
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CartelAtlasBot/1.0; research)' },
    });
    const $ = cheerio.load(res.data);
    $('script, style, nav, header, footer, aside, .ad, .publicidad').remove();
    return $(contentSelector).text().replace(/\s+/g, ' ').trim().slice(0, 4000);
  } catch {
    return '';
  }
}

// ─── CLAUDE EXTRACTION ────────────────────────────────────────────────────────

const SYSTEM = `You are a structured data extractor for a Mexican cartel history database (1930–present).
Given a news article (Spanish or English), extract structured data for:
  1. ATTACKS — violent incidents: shootouts, massacres, assassinations, bombings, kidnappings
  2. SITES — locations where bodies were found, mass graves, displacement events
  3. BUSTS — arrests, drug seizures, extraditions, operations

Return ONLY a raw JSON object (no markdown, no explanation):
{
  "attacks": [
    {
      "id": "a_<city_slug>_<event_slug>_<year>",
      "year": 2024,
      "month": 10,
      "attackerCartelId": "cjng"|"sinaloa"|"chapitos"|"zetas"|"gulf"|"beltran_leyva"|"cdg_factions"|"la_familia"|"knights_templar"|"tijuana"|"juarez"|null,
      "targetCartelId": same options|null,
      "title": "City/State — Short English description (max 80 chars)",
      "description": "2-3 sentence English description with specific facts.",
      "type": "massacre"|"ambush"|"assassination"|"bombing"|"territorial"|"retaliation"|"kidnapping",
      "lat": 0.0,
      "lng": 0.0,
      "stateCode": "JAL"|"SIN"|"GRO"|"MIC"|"CHH"|"TAM"|"VER"|"ZAC"|"GUA"|"CHP"|"COA"|"NLE"|"OAX"|"PUE"|"AGU"|"BCN"|"BCS"|"CAM"|"COL"|"CMX"|"DUR"|"HID"|"MEX"|"MOR"|"NAY"|"QUE"|"ROO"|"SLP"|"SON"|"TAB"|"TLA"|"YUC",
      "killed": 0,
      "significance": "critical"|"high"|"medium"
    }
  ],
  "sites": [
    {
      "id": "mv_<city_slug>_<event_slug>_<year>",
      "title": "City/State — Description (max 80 chars)",
      "description": "2-3 sentence English description.",
      "type": "mass_grave"|"body_dump"|"burn_site"|"hanging"|"dismemberment",
      "cartelId": same options as above|null,
      "lat": 0.0, "lng": 0.0, "stateCode": "...",
      "year": 2024, "victims": 0,
      "found": "Brief source/discovery context"
    }
  ],
  "busts": [
    {
      "id": "bust_<slug>_<year>",
      "title": "Operation/Event Name — Brief description",
      "year": 2024, "month": 1,
      "lat": 0.0, "lng": 0.0, "stateCode": "...",
      "cartelId": "...", "arrests": 0,
      "significance": "critical"|"high"|"medium",
      "description": "2-3 sentence English description.",
      "agency": "SEDENA"|"SEMAR"|"FGR"|"DEA"|"DOJ"|"Guardia Nacional"|etc,
      "drugs": [{"type": "fentanyl"|"cocaine"|"meth"|"heroin"|"marijuana", "kg": 0}]
    }
  ]
}

Rules:
- ONLY events from 2020 onwards
- SKIP if no specific location you can geocode (lat/lng)
- SKIP if no specific facts (deaths, kg, names, numbers)
- IDs must be snake_case lowercase, no spaces
- Return {"attacks":[],"sites":[],"busts":[]} if nothing extractable`;

async function extractFromArticle(article, client) {
  const content = [
    `SOURCE: ${article.source}`,
    `TITLE: ${article.title}`,
    `DATE: ${article.date ?? 'unknown'}`,
    `URL: ${article.url}`,
    '',
    article.fullText
      ? `FULL TEXT:\n${article.fullText}`
      : `SNIPPET:\n${article.snippet || '(no text)'}`,
  ].join('\n');

  try {
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { attacks: [], sites: [], busts: [] };
  }
}

// ─── FORMATTERS ───────────────────────────────────────────────────────────────

function fmt(obj) {
  // Compact single-line TypeScript object string
  return JSON.stringify(obj)
    .replace(/"([a-zA-Z_]+)":/g, '$1:')   // unquote keys
    .replace(/"/g, "'");                    // double → single quotes
}

function fmtAttack(a) {
  return `  {id:'${a.id}',year:${a.year}${a.month?`,month:${a.month}`:''},attackerCartelId:${a.attackerCartelId?`'${a.attackerCartelId}'`:'null'},targetCartelId:${a.targetCartelId?`'${a.targetCartelId}'`:'null'},title:${JSON.stringify(a.title).replace(/"/g,"'")},description:${JSON.stringify(a.description).replace(/"/g,"'")},type:'${a.type}',lat:${a.lat},lng:${a.lng},stateCode:'${a.stateCode}'${a.killed?`,killed:${a.killed}`:''},significance:'${a.significance}'${a.wikipediaUrl?`,wikipediaUrl:'${a.wikipediaUrl}'`:''}},`;
}

function fmtSite(s) {
  return `  {id:'${s.id}',title:${JSON.stringify(s.title).replace(/"/g,"'")},description:${JSON.stringify(s.description).replace(/"/g,"'")},type:'${s.type}'${s.cartelId?`,cartelId:'${s.cartelId}'`:''},lat:${s.lat},lng:${s.lng},stateCode:'${s.stateCode}',year:${s.year}${s.victims!==undefined?`,victims:${s.victims}`:''}${s.found?`,found:${JSON.stringify(s.found).replace(/"/g,"'")}`:''}},`;
}

function fmtBust(b) {
  const drugs = b.drugs?.length ? `,drugs:${JSON.stringify(b.drugs)}` : '';
  return `  {id:'${b.id}',title:${JSON.stringify(b.title).replace(/"/g,"'")},year:${b.year}${b.month?`,month:${b.month}`:''},lat:${b.lat},lng:${b.lng},stateCode:'${b.stateCode}'${b.cartelId?`,cartelId:'${b.cartelId}'`:''}${b.arrests?`,arrests:${b.arrests}`:''},significance:'${b.significance}',description:${JSON.stringify(b.description).replace(/"/g,"'")},agency:${JSON.stringify(b.agency).replace(/"/g,"'")}${drugs}},`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Missing ANTHROPIC_API_KEY environment variable');
    console.error('   Run: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  console.log(`\n🔎 Cartel Atlas Scraper — ${TODAY}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'} | Limit: ${LIMIT} articles\n`);

  const client = new Anthropic();
  const existingIds = loadExistingIds();
  console.log(`   ${existingIds.size} existing IDs loaded (will skip duplicates)\n`);

  // ── 1. Collect articles ──────────────────────────────────────────────────
  console.log('📡 Fetching news sources...');
  const all = [];

  for (const src of SOURCES) {
    process.stdout.write(`   ${src.name.padEnd(25)} `);
    const arts = src.type === 'rss' ? await fetchRSS(src) : await fetchScrape(src);
    console.log(`${arts.length} relevant`);
    all.push(...arts);
  }

  // Dedup by URL
  const seen = new Set();
  const unique = all.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Sort newest first
  unique.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(b.date) - new Date(a.date);
  });

  const toProcess = unique.slice(0, LIMIT);
  console.log(`\n   ${unique.length} unique articles → processing top ${toProcess.length}\n`);

  // ── 2. Fetch full article text ───────────────────────────────────────────
  console.log('📄 Fetching article text...');
  for (let i = 0; i < toProcess.length; i++) {
    const art = toProcess[i];
    if (!art.fullText && art.url) {
      const src = SOURCES.find(s => s.name === art.source);
      art.fullText = await fetchFullText(art.url, src?.contentSelector);
    }
    process.stdout.write(art.fullText?.length > 200 ? '█' : '░');
  }
  console.log('\n');

  // ── 3. Claude extraction ─────────────────────────────────────────────────
  console.log('🤖 Extracting with Claude...\n');
  const newAttacks = [], newSites = [], newBusts = [];
  const log = [];

  for (let i = 0; i < toProcess.length; i++) {
    const art = toProcess[i];
    const label = art.title.slice(0, 55).padEnd(55);
    process.stdout.write(`   [${String(i+1).padStart(2)}/${toProcess.length}] ${label} `);

    const extracted = await extractFromArticle(art, client);

    const a = (extracted.attacks ?? []).filter(e => !existingIds.has(e.id));
    const s = (extracted.sites ?? []).filter(e => !existingIds.has(e.id));
    const b = (extracted.busts ?? []).filter(e => !existingIds.has(e.id));

    console.log(`+${a.length+s.length+b.length} (${a.length}⚔ ${s.length}💀 ${b.length}💊)`);

    newAttacks.push(...a);
    newSites.push(...s);
    newBusts.push(...b);
    log.push({ url: art.url, title: art.title, new: { a, s, b } });

    // Add to seen set to avoid intra-run duplication
    [...a, ...s, ...b].forEach(e => existingIds.add(e.id));

    await new Promise(r => setTimeout(r, 250)); // gentle rate limit
  }

  // ── 4. Output ────────────────────────────────────────────────────────────
  const total = newAttacks.length + newSites.length + newBusts.length;
  console.log(`\n✅ Done — ${total} new entries (${newAttacks.length} attacks, ${newSites.length} sites, ${newBusts.length} busts)\n`);

  const lines = [
    `// ── SCRAPED ENTRIES — ${TODAY} ────────────────────────────────────────────────`,
    `// Auto-generated by cartel-scraper. Review before pasting into lib/data.ts`,
    `// Check lat/lng accuracy on Google Maps before committing!`,
    '',
    `// ─── ATTACKS (${newAttacks.length}) ─────────────────────────────────────────`,
    ...newAttacks.map(fmtAttack),
    '',
    `// ─── MASS VIOLENCE SITES (${newSites.length}) ──────────────────────────────`,
    ...newSites.map(fmtSite),
    '',
    `// ─── DRUG BUSTS / OPERATIONS (${newBusts.length}) ──────────────────────────`,
    ...newBusts.map(fmtBust),
  ].join('\n');

  if (DRY_RUN) {
    console.log('─── DRY RUN OUTPUT ─────────────────────────────────────────\n');
    console.log(lines);
  } else {
    const outFile = path.join(__dirname, `new-entries-${TODAY}.ts`);
    const logFile = path.join(__dirname, `scrape-log-${TODAY}.json`);
    fs.writeFileSync(outFile, lines, 'utf8');
    fs.writeFileSync(logFile, JSON.stringify(log, null, 2), 'utf8');
    console.log(`📁 Written:`);
    console.log(`   ${outFile}`);
    console.log(`   ${logFile}`);
    console.log(`\n💡 Review the .ts file, then paste entries into cartel-atlas/lib/data.ts`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
