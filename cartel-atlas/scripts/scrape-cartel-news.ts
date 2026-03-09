#!/usr/bin/env npx ts-node
/**
 * cartel-atlas news scraper
 *
 * Fetches recent cartel-related news from Mexican and international sources,
 * uses Claude to translate + structure each article into typed database entries,
 * deduplicates against existing data.ts, then writes ready-to-paste new entries.
 *
 * Usage:
 *   npx ts-node scripts/scrape-cartel-news.ts
 *   npx ts-node scripts/scrape-cartel-news.ts --dry-run   # print entries, don't write
 *   npx ts-node scripts/scrape-cartel-news.ts --limit 20  # cap articles processed
 *
 * Requirements:
 *   npm install -D ts-node typescript
 *   npm install axios cheerio @anthropic-ai/sdk rss-parser
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *
 * Output:
 *   scripts/new-entries-YYYY-MM-DD.ts   ← paste into data.ts
 *   scripts/scrape-log-YYYY-MM-DD.json  ← full run log
 */

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import RSSParser from 'rss-parser';
import * as fs from 'fs';
import * as path from 'path';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? parseInt(args[i + 1]) : 40;
})();

const TODAY = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(__dirname);

// ─── NEWS SOURCES ─────────────────────────────────────────────────────────────
// Mix of Spanish-language Mexican news + English cartel-beat specialists

const SOURCES: Array<{
  name: string;
  type: 'rss' | 'scrape';
  url: string;
  lang: 'es' | 'en';
  articleSelector?: string;   // CSS selector for article links on scrape pages
  contentSelector?: string;   // CSS selector for article body text
}> = [
  // ── RSS feeds (most reliable) ──────────────────────────────────────────
  {
    name: 'El Universal — Seguridad',
    type: 'rss',
    url: 'https://www.eluniversal.com.mx/rss.xml',
    lang: 'es',
  },
  {
    name: 'Milenio — Nacional',
    type: 'rss',
    url: 'https://www.milenio.com/rss',
    lang: 'es',
  },
  {
    name: 'InSight Crime',
    type: 'rss',
    url: 'https://insightcrime.org/feed/',
    lang: 'en',
  },
  {
    name: 'Proceso',
    type: 'rss',
    url: 'https://www.proceso.com.mx/rss/',
    lang: 'es',
  },
  {
    name: 'Animal Político',
    type: 'rss',
    url: 'https://animalpolitico.com/feed',
    lang: 'es',
  },
  {
    name: 'Sin Embargo',
    type: 'rss',
    url: 'https://www.sinembargo.mx/feed',
    lang: 'es',
  },
  {
    name: 'Zeta Tijuana',
    type: 'rss',
    url: 'https://zetatijuana.com/feed/',
    lang: 'es',
  },
  {
    name: 'El Sol de México',
    type: 'rss',
    url: 'https://www.elsoldemexico.com.mx/rss.xml',
    lang: 'es',
  },
  {
    name: 'Reforma (Policiaca)',
    type: 'rss',
    url: 'https://gruporeforma.com/rss/reforma/policiaca.xml',
    lang: 'es',
  },
  // ── Scrape fallbacks ───────────────────────────────────────────────────
  {
    name: 'Noroeste Sinaloa',
    type: 'scrape',
    url: 'https://www.noroeste.com.mx/seguridad',
    lang: 'es',
    articleSelector: 'article a[href*="/policia"], article a[href*="/seguridad"]',
    contentSelector: '.article-body, .nota-body, .content-body',
  },
  {
    name: 'El Debate (Sinaloa)',
    type: 'scrape',
    url: 'https://www.debate.com.mx/policiaca',
    lang: 'es',
    articleSelector: '.item-news a, .news-title a',
    contentSelector: '.content-news, .nota-texto',
  },
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
    name: 'NTR Guadalajara',
    type: 'scrape',
    url: 'https://ntrgdl.com/local/seguridad',
    lang: 'es',
    articleSelector: '.news-title a, h2 a',
    contentSelector: '.news-body, .article-content',
  },
];

// Keywords to filter relevant articles (Spanish + English)
const RELEVANT_KEYWORDS = [
  // Spanish
  'cártel', 'cartel', 'narco', 'sicario', 'masacre', 'enfrentamiento',
  'decapitado', 'ejecutado', 'secuestro', 'desaparecido', 'fosa', 'fentanilo',
  'droga', 'decomiso', 'operativo', 'detenido', 'capturado', 'abatido',
  'balacera', 'ataque', 'explosión', 'mina', 'dron', 'bloqueo',
  'plaza', 'extorsión', 'robo', 'homicidio',
  // English
  'cartel', 'massacre', 'gunmen', 'drug lord', 'kingpin', 'fentanyl',
  'trafficker', 'seizure', 'extradition', 'arrest', 'killed', 'bodies found',
  'shootout', 'ambush', 'beheaded', 'missing', 'disappeared', 'mass grave',
  'roadblock', 'drone attack', 'explosion',
  // Cartel names
  'CJNG', 'Jalisco', 'Sinaloa', 'Zetas', 'Chapitos', 'Mayista',
  'Gulf Cartel', 'Cártel del Golfo', 'Templarios', 'Familia Michoacana',
  'Beltrán Leyva', 'Santa Rosa de Lima', 'Cártel del Noreste',
];

// ─── EXISTING ID SET (to dedup) ───────────────────────────────────────────────

function loadExistingIds(): Set<string> {
  const dataPath = path.join(__dirname, '..', 'lib', 'data.ts');
  const src = fs.readFileSync(dataPath, 'utf8');
  const ids = new Set<string>();
  // Match id:'something' or id:"something"
  for (const m of src.matchAll(/id:['"]([^'"]+)['"]/g)) {
    ids.add(m[1]);
  }
  return ids;
}

// ─── FETCHERS ─────────────────────────────────────────────────────────────────

interface RawArticle {
  title: string;
  url: string;
  date?: string;
  snippet?: string;
  fullText?: string;
  lang: 'es' | 'en';
  source: string;
}

async function fetchRSS(source: typeof SOURCES[0]): Promise<RawArticle[]> {
  try {
    const parser = new RSSParser({ timeout: 10000 });
    const feed = await parser.parseURL(source.url);
    return feed.items
      .slice(0, 30)
      .map(item => ({
        title: item.title ?? '',
        url: item.link ?? '',
        date: item.pubDate ?? item.isoDate,
        snippet: item.contentSnippet ?? item.summary ?? '',
        lang: source.lang,
        source: source.name,
      }))
      .filter(a => isRelevant(a.title + ' ' + (a.snippet ?? '')));
  } catch (err) {
    console.warn(`  ⚠ RSS failed for ${source.name}: ${(err as Error).message}`);
    return [];
  }
}

async function fetchScrape(source: typeof SOURCES[0]): Promise<RawArticle[]> {
  if (!source.articleSelector) return [];
  try {
    const res = await axios.get(source.url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CartelAtlasBot/1.0)' },
    });
    const $ = cheerio.load(res.data as string);
    const articles: RawArticle[] = [];
    $(source.articleSelector).each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      const url = href.startsWith('http') ? href : new URL(href, source.url).href;
      if (title && url && isRelevant(title)) {
        articles.push({ title, url, lang: source.lang, source: source.name });
      }
    });
    return articles.slice(0, 20);
  } catch (err) {
    console.warn(`  ⚠ Scrape failed for ${source.name}: ${(err as Error).message}`);
    return [];
  }
}

async function fetchArticleText(
  url: string,
  contentSelector: string = 'article, .article-body, .entry-content, .nota-body, main p'
): Promise<string> {
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CartelAtlasBot/1.0)' },
    });
    const $ = cheerio.load(res.data as string);
    // Remove nav, ads, scripts
    $('script, style, nav, header, footer, aside, .ad, .ads, .publicidad').remove();
    const text = $(contentSelector).text().replace(/\s+/g, ' ').trim();
    return text.slice(0, 4000); // cap to keep Claude input manageable
  } catch {
    return '';
  }
}

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEVANT_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

// ─── CLAUDE EXTRACTOR ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a structured data extractor for a Mexican cartel history database.
Given a news article (in Spanish or English), extract structured data entries for:
1. ATTACKS (violence incidents: shootouts, massacres, assassinations, bombings, kidnappings)
2. MASS_VIOLENCE_SITES (locations where bodies were found, mass graves, displacement sites)
3. DRUG_BUSTS (arrests, seizures, extraditions, operations)

Return ONLY a JSON object with this exact structure:
{
  "attacks": [
    {
      "id": "a_<location>_<brief_slug>_<year>",
      "year": 2024,
      "month": 10,
      "attackerCartelId": "cjng" | "sinaloa" | "chapitos" | "zetas" | "gulf" | "beltran_leyva" | "cdg_factions" | "la_familia" | "knights_templar" | "tijuana" | "juarez" | null,
      "targetCartelId": same options | null,
      "title": "City/State — Brief English description (max 80 chars)",
      "description": "2-4 sentence English description with specific facts: who, what, how many, why significant.",
      "type": "massacre" | "ambush" | "assassination" | "bombing" | "territorial" | "retaliation" | "kidnapping",
      "lat": 0.0,
      "lng": 0.0,
      "stateCode": "JAL" | "SIN" | "GRO" | "MIC" | "CHH" | "TAM" | "VER" | "ZAC" | "GUA" | "CHP" | "COA" | "NLE" | "OAX" | "PUE" | "AGU" | "BCN" | "BCS" | "CAM" | "COL" | "CMX" | "DUR" | "HID" | "MEX" | "MOR" | "NAY" | "QUE" | "ROO" | "SLP" | "SON" | "TAB" | "TLA" | "YUC",
      "killed": 0,
      "significance": "critical" | "high" | "medium"
    }
  ],
  "sites": [
    {
      "id": "mv_<location>_<brief_slug>_<year>",
      "title": "City/State — Description (max 80 chars)",
      "description": "2-3 sentence English description.",
      "type": "mass_grave" | "body_dump" | "burn_site" | "hanging" | "dismemberment",
      "cartelId": see cartel ids above or null,
      "lat": 0.0,
      "lng": 0.0,
      "stateCode": "...",
      "year": 2024,
      "victims": 0,
      "found": "Brief source/context"
    }
  ],
  "busts": [
    {
      "id": "bust_<operation_slug>_<year>",
      "title": "Operation/Event Name — Brief description",
      "year": 2024,
      "month": 1,
      "lat": 0.0,
      "lng": 0.0,
      "stateCode": "...",
      "cartelId": "...",
      "arrests": 0,
      "significance": "critical" | "high" | "medium",
      "description": "2-3 sentence English description.",
      "agency": "SEDENA" | "SEMAR" | "PGR" | "DEA" | "DOJ" | "FGR" | "Guardia Nacional" | etc,
      "drugs": [{"type": "fentanyl" | "cocaine" | "meth" | "heroin" | "marijuana" | "fentanyl_precursors", "kg": 0}]
    }
  ]
}

Rules:
- Skip anything without a specific location you can geocode to lat/lng
- Skip anything older than 2022
- Only include events with SPECIFIC facts (deaths, kg seized, names, locations)
- IDs must be snake_case, lowercase, no spaces
- Prefer precise city coordinates over state capitals
- Return {"attacks":[],"sites":[],"busts":[]} if nothing extractable
- Return ONLY valid JSON, no markdown, no explanation`;

interface ExtractedEntries {
  attacks: any[];
  sites: any[];
  busts: any[];
}

async function extractFromArticle(
  article: RawArticle,
  client: Anthropic
): Promise<ExtractedEntries> {
  const content = [
    `SOURCE: ${article.source}`,
    `TITLE: ${article.title}`,
    `DATE: ${article.date ?? 'unknown'}`,
    `URL: ${article.url}`,
    '',
    article.fullText
      ? `FULL TEXT:\n${article.fullText}`
      : `SNIPPET:\n${article.snippet ?? '(no text available)'}`,
  ].join('\n');

  try {
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    // Strip potential markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned) as ExtractedEntries;
  } catch (err) {
    // Don't crash the whole run on one bad article
    return { attacks: [], sites: [], busts: [] };
  }
}

// ─── FORMATTERS ───────────────────────────────────────────────────────────────

function formatAttack(a: any): string {
  const parts: string[] = [];
  parts.push(`  {id:'${a.id}',year:${a.year}`);
  if (a.month) parts[0] += `,month:${a.month}`;
  if (a.attackerCartelId) parts[0] += `,attackerCartelId:'${a.attackerCartelId}'`;
  else parts[0] += `,attackerCartelId:null`;
  if (a.targetCartelId) parts[0] += `,targetCartelId:'${a.targetCartelId}'`;
  else parts[0] += `,targetCartelId:null`;
  parts[0] += `,title:${JSON.stringify(a.title)}`;
  parts[0] += `,description:${JSON.stringify(a.description)}`;
  parts[0] += `,type:'${a.type}'`;
  parts[0] += `,lat:${a.lat},lng:${a.lng}`;
  parts[0] += `,stateCode:'${a.stateCode}'`;
  if (a.killed) parts[0] += `,killed:${a.killed}`;
  parts[0] += `,significance:'${a.significance}'`;
  if (a.wikipediaUrl) parts[0] += `,wikipediaUrl:'${a.wikipediaUrl}'`;
  parts[0] += `},`;
  return parts.join('');
}

function formatSite(s: any): string {
  let line = `  {id:'${s.id}',title:${JSON.stringify(s.title)}`;
  line += `,description:${JSON.stringify(s.description)}`;
  line += `,type:'${s.type}'`;
  if (s.cartelId) line += `,cartelId:'${s.cartelId}'`;
  line += `,lat:${s.lat},lng:${s.lng}`;
  line += `,stateCode:'${s.stateCode}'`;
  line += `,year:${s.year}`;
  if (s.victims !== undefined) line += `,victims:${s.victims}`;
  if (s.found) line += `,found:${JSON.stringify(s.found)}`;
  line += `},`;
  return line;
}

function formatBust(b: any): string {
  let line = `  {id:'${b.id}',title:${JSON.stringify(b.title)}`;
  line += `,year:${b.year}`;
  if (b.month) line += `,month:${b.month}`;
  line += `,lat:${b.lat},lng:${b.lng}`;
  line += `,stateCode:'${b.stateCode}'`;
  if (b.cartelId) line += `,cartelId:'${b.cartelId}'`;
  if (b.arrests) line += `,arrests:${b.arrests}`;
  line += `,significance:'${b.significance}'`;
  line += `,description:${JSON.stringify(b.description)}`;
  if (b.agency) line += `,agency:${JSON.stringify(b.agency)}`;
  if (b.drugs?.length) line += `,drugs:${JSON.stringify(b.drugs)}`;
  line += `},`;
  return line;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔎 Cartel Atlas News Scraper — ${TODAY}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'} | Article limit: ${LIMIT}\n`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const existingIds = loadExistingIds();
  console.log(`   Loaded ${existingIds.size} existing IDs from data.ts\n`);

  // ── Step 1: Collect articles ─────────────────────────────────────────────
  console.log('📡 Fetching feeds & pages...');
  const allArticles: RawArticle[] = [];

  for (const src of SOURCES) {
    process.stdout.write(`   ${src.name}... `);
    const arts = src.type === 'rss' ? await fetchRSS(src) : await fetchScrape(src);
    console.log(`${arts.length} relevant articles`);
    allArticles.push(...arts);
  }

  // Dedup by URL
  const seen = new Set<string>();
  const unique = allArticles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
  console.log(`\n   Total unique relevant articles: ${unique.length}`);

  // Sort: most recent first (if date available)
  unique.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const toProcess = unique.slice(0, LIMIT);
  console.log(`   Processing top ${toProcess.length} articles...\n`);

  // ── Step 2: Fetch full text for promising articles ───────────────────────
  console.log('📄 Fetching article bodies...');
  for (const art of toProcess) {
    if (!art.fullText && art.url) {
      const src = SOURCES.find(s => s.name === art.source);
      art.fullText = await fetchArticleText(art.url, src?.contentSelector);
      process.stdout.write('.');
    }
  }
  console.log('\n');

  // ── Step 3: Extract via Claude ───────────────────────────────────────────
  console.log('🤖 Extracting structured data with Claude...');
  const allAttacks: any[] = [];
  const allSites: any[] = [];
  const allBusts: any[] = [];
  const log: any[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const art = toProcess[i];
    process.stdout.write(`   [${i + 1}/${toProcess.length}] ${art.title.slice(0, 60)}... `);
    const extracted = await extractFromArticle(art, client);

    // Filter IDs that already exist
    const newAttacks = extracted.attacks.filter(a => !existingIds.has(a.id));
    const newSites = extracted.sites.filter(s => !existingIds.has(s.id));
    const newBusts = extracted.busts.filter(b => !existingIds.has(b.id));

    const total = newAttacks.length + newSites.length + newBusts.length;
    console.log(`+${total} new (${newAttacks.length}a ${newSites.length}s ${newBusts.length}b)`);

    allAttacks.push(...newAttacks);
    allSites.push(...newSites);
    allBusts.push(...newBusts);
    log.push({ article: art.title, url: art.url, extracted, newAttacks, newSites, newBusts });

    // Add new IDs to set so we don't dup within this run
    [...newAttacks, ...newSites, ...newBusts].forEach(e => existingIds.add(e.id));

    // Small delay to be polite to rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  // ── Step 4: Output ───────────────────────────────────────────────────────
  console.log(`\n✅ Extraction complete:`);
  console.log(`   New attacks:      ${allAttacks.length}`);
  console.log(`   New sites:        ${allSites.length}`);
  console.log(`   New busts:        ${allBusts.length}`);
  console.log(`   Total new entries: ${allAttacks.length + allSites.length + allBusts.length}`);

  const outputPath = path.join(OUT_DIR, `new-entries-${TODAY}.ts`);
  const logPath = path.join(OUT_DIR, `scrape-log-${TODAY}.json`);

  const outputLines: string[] = [
    `// ── SCRAPED ENTRIES — ${TODAY} ─────────────────────────────────────────────`,
    `// Generated by scrape-cartel-news.ts`,
    `// Paste relevant sections into lib/data.ts`,
    '',
    `// ─── ATTACKS (${allAttacks.length} new) ────────────────────────────────────`,
    ...allAttacks.map(formatAttack),
    '',
    `// ─── MASS VIOLENCE SITES (${allSites.length} new) ─────────────────────────`,
    ...allSites.map(formatSite),
    '',
    `// ─── DRUG BUSTS (${allBusts.length} new) ──────────────────────────────────`,
    ...allBusts.map(formatBust),
  ];

  if (!DRY_RUN) {
    fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf8');
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
    console.log(`\n📁 Output written:`);
    console.log(`   Entries: ${outputPath}`);
    console.log(`   Log:     ${logPath}`);
  } else {
    console.log('\n📋 DRY RUN — entries that would be written:\n');
    console.log(outputLines.join('\n'));
  }

  console.log('\n💡 Next step: Review the output file, then paste entries into lib/data.ts\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
